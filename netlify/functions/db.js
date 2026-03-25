const fs = require("fs");
const path = require("path");
const { neon } = require("@neondatabase/serverless");

const databaseUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL or NETLIFY_DATABASE_URL environment variable.");
}

const sql = neon(databaseUrl);
let schemaPromise;

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS app_state (
          key TEXT PRIMARY KEY,
          value JSONB
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS checklist_history (
          id TEXT PRIMARY KEY,
          owner_key TEXT NOT NULL DEFAULT 'shared',
          saved_at TIMESTAMPTZ NOT NULL,
          payload JSONB NOT NULL
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS fault_reports (
          id TEXT PRIMARY KEY,
          owner_key TEXT NOT NULL DEFAULT 'shared',
          saved_at TIMESTAMPTZ NOT NULL,
          payload JSONB NOT NULL
        );
      `;

      await sql`
        ALTER TABLE checklist_history
        ADD COLUMN IF NOT EXISTS owner_key TEXT NOT NULL DEFAULT 'shared'
      `;

      await sql`
        ALTER TABLE fault_reports
        ADD COLUMN IF NOT EXISTS owner_key TEXT NOT NULL DEFAULT 'shared'
      `;

      await migrateLegacyJson();
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }

  return schemaPromise;
}

async function migrateLegacyJson() {
  const flag = await sql`
    SELECT value
    FROM app_state
    WHERE key = 'legacy-json-migrated'
  `;

  if (flag.length) {
    return;
  }

  const currentChecklist = readLegacyJson("current-checklist.json", null);
  if (currentChecklist) {
    await setCurrentChecklist("shared", currentChecklist);
  }

  const history = readLegacyJson("history.json", []);
  for (const entry of history) {
    await addHistoryEntry("shared", entry);
  }

  const reports = readLegacyJson("reports.json", []);
  for (const report of reports) {
    await addReport("shared", report);
  }

  await sql`
    INSERT INTO app_state (key, value)
    VALUES ('legacy-json-migrated', ${JSON.stringify({ completedAt: new Date().toISOString() })}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

function readLegacyJson(fileName, fallback) {
  try {
    const filePath = path.join(process.cwd(), "data", fileName);
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function normalizeScope(scope) {
  return String(scope || "").trim().toLowerCase() || "shared";
}

function scopedStateKey(scope, key) {
  return `${normalizeScope(scope)}:${key}`;
}

async function getCurrentChecklist(scope) {
  await ensureSchema();
  const scopedKey = scopedStateKey(scope, "current-checklist");
  const rows = await sql`
    SELECT value
    FROM app_state
    WHERE key = ${scopedKey}
  `;
  return rows[0]?.value ?? null;
}

async function setCurrentChecklist(scope, value) {
  await ensureSchema();
  const scopedKey = scopedStateKey(scope, "current-checklist");
  await sql`
    INSERT INTO app_state (key, value)
    VALUES (${scopedKey}, ${JSON.stringify(value)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

async function getHistory(scope) {
  await ensureSchema();
  const ownerKey = normalizeScope(scope);
  const rows = await sql`
    SELECT payload
    FROM checklist_history
    WHERE owner_key = ${ownerKey}
    ORDER BY saved_at DESC, id DESC
  `;
  return rows.map((row) => row.payload);
}

async function addHistoryEntry(scope, entry) {
  await ensureSchema();
  const ownerKey = normalizeScope(scope);
  const id = entry?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const savedAt = entry?.savedAt || new Date().toISOString();
  const payload = { ...entry, id, savedAt };

  await sql`
    INSERT INTO checklist_history (id, owner_key, saved_at, payload)
    VALUES (${id}, ${ownerKey}, ${savedAt}, ${JSON.stringify(payload)}::jsonb)
    ON CONFLICT (id) DO UPDATE
    SET owner_key = EXCLUDED.owner_key,
        saved_at = EXCLUDED.saved_at,
        payload = EXCLUDED.payload
  `;
}

async function clearHistory(scope) {
  await ensureSchema();
  const ownerKey = normalizeScope(scope);
  await sql`DELETE FROM checklist_history WHERE owner_key = ${ownerKey}`;
}

async function getReports(scope) {
  await ensureSchema();
  const ownerKey = normalizeScope(scope);
  const rows = await sql`
    SELECT payload
    FROM fault_reports
    WHERE owner_key = ${ownerKey}
    ORDER BY saved_at DESC, id DESC
  `;
  return rows.map((row) => row.payload);
}

async function addReport(scope, report) {
  await ensureSchema();
  const ownerKey = normalizeScope(scope);
  const id = report?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const savedAt = report?.savedAt || new Date().toISOString();
  const payload = { ...report, id, savedAt };

  await sql`
    INSERT INTO fault_reports (id, owner_key, saved_at, payload)
    VALUES (${id}, ${ownerKey}, ${savedAt}, ${JSON.stringify(payload)}::jsonb)
    ON CONFLICT (id) DO UPDATE
    SET owner_key = EXCLUDED.owner_key,
        saved_at = EXCLUDED.saved_at,
        payload = EXCLUDED.payload
  `;
}

async function clearReports(scope) {
  await ensureSchema();
  const ownerKey = normalizeScope(scope);
  await sql`DELETE FROM fault_reports WHERE owner_key = ${ownerKey}`;
}

module.exports = {
  ensureSchema,
  getCurrentChecklist,
  setCurrentChecklist,
  getHistory,
  addHistoryEntry,
  clearHistory,
  getReports,
  addReport,
  clearReports,
};
