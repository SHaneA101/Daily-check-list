const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { URL } = require("url");
const Database = require("better-sqlite3");

const PORT = process.env.PORT || 8000;
const ROOT = __dirname;
const LEGACY_DATA_DIR = path.join(ROOT, "data");
const DB_FILE = process.env.DATABASE_PATH || path.join(os.tmpdir(), "daily-checklist-app.sqlite");
const DATA_DIR = path.dirname(DB_FILE);
const LEGACY_CURRENT_FILE = path.join(LEGACY_DATA_DIR, "current-checklist.json");
const LEGACY_HISTORY_FILE = path.join(LEGACY_DATA_DIR, "history.json");
const LEGACY_REPORTS_FILE = path.join(LEGACY_DATA_DIR, "reports.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

ensureDataDirectory();
prepareDatabaseFile();
const db = new Database(DB_FILE);
db.pragma("journal_mode = MEMORY");
initializeDatabase();
migrateLegacyJson();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    serveStatic(res, url);
  } catch (error) {
    sendJson(res, 500, { error: "Server error", detail: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Daily Checklist server running on http://localhost:${PORT}`);
  console.log(`SQLite database: ${DB_FILE}`);
});

async function handleApi(req, res, url) {
  if (url.pathname === "/api/health" && req.method === "GET") {
    sendJson(res, 200, { ok: true, databasePath: DB_FILE });
    return;
  }

  if (url.pathname === "/api/checklist/current") {
    if (req.method === "GET") {
      sendJson(res, 200, getCurrentChecklist());
      return;
    }

    if (req.method === "PUT") {
      const body = await readBody(req);
      setCurrentChecklist(body);
      sendJson(res, 200, { ok: true });
      return;
    }
  }

  if (url.pathname === "/api/history") {
    if (req.method === "GET") {
      sendJson(res, 200, getHistory());
      return;
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      addHistoryEntry(body);
      sendJson(res, 201, { ok: true });
      return;
    }

    if (req.method === "DELETE") {
      clearHistory();
      sendJson(res, 200, { ok: true });
      return;
    }
  }

  if (url.pathname === "/api/reports") {
    if (req.method === "GET") {
      sendJson(res, 200, getReports());
      return;
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      addReport(body);
      sendJson(res, 201, { ok: true });
      return;
    }

    if (req.method === "DELETE") {
      clearReports();
      sendJson(res, 200, { ok: true });
      return;
    }
  }

  sendJson(res, 404, { error: "Not found" });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function serveStatic(res, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        sendText(res, 404, "Not found");
        return;
      }

      sendText(res, 500, "Server error");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(content);
  });
}

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function prepareDatabaseFile() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const stats = fs.statSync(DB_FILE);
      if (stats.size === 0) {
        fs.rmSync(DB_FILE, { force: true });
      }
    }

    const journalFile = `${DB_FILE}-journal`;
    if (fs.existsSync(journalFile)) {
      fs.rmSync(journalFile, { force: true });
    }
  } catch (error) {
    console.warn(`Could not prepare database file: ${error.message}`);
  }
}

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS checklist_history (
      id TEXT PRIMARY KEY,
      saved_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fault_reports (
      id TEXT PRIMARY KEY,
      saved_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
  `);
}

function migrateLegacyJson() {
  const migrationDone = db
    .prepare("SELECT value FROM app_state WHERE key = ?")
    .get("legacy-json-migrated");

  if (migrationDone) {
    return;
  }

  const current = readLegacyJson(LEGACY_CURRENT_FILE, null);
  if (current) {
    setCurrentChecklist(current);
  }

  const history = readLegacyJson(LEGACY_HISTORY_FILE, []);
  for (const entry of history) {
    addHistoryEntry(entry);
  }

  const reports = readLegacyJson(LEGACY_REPORTS_FILE, []);
  for (const report of reports) {
    addReport(report);
  }

  db.prepare("INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)")
    .run("legacy-json-migrated", JSON.stringify({ completedAt: new Date().toISOString() }));
}

function getCurrentChecklist() {
  const row = db.prepare("SELECT value FROM app_state WHERE key = ?").get("current-checklist");
  return row ? JSON.parse(row.value) : null;
}

function setCurrentChecklist(value) {
  db.prepare("INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)")
    .run("current-checklist", JSON.stringify(value));
}

function getHistory() {
  const rows = db
    .prepare("SELECT payload FROM checklist_history ORDER BY datetime(saved_at) DESC, rowid DESC")
    .all();
  return rows.map((row) => JSON.parse(row.payload));
}

function addHistoryEntry(entry) {
  const id = entry?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const savedAt = entry?.savedAt || new Date().toISOString();
  const payload = { ...entry, id, savedAt };

  db.prepare(
    "INSERT OR REPLACE INTO checklist_history (id, saved_at, payload) VALUES (?, ?, ?)"
  ).run(id, savedAt, JSON.stringify(payload));
}

function clearHistory() {
  db.prepare("DELETE FROM checklist_history").run();
}

function getReports() {
  const rows = db
    .prepare("SELECT payload FROM fault_reports ORDER BY datetime(saved_at) DESC, rowid DESC")
    .all();
  return rows.map((row) => JSON.parse(row.payload));
}

function addReport(report) {
  const id = report?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const savedAt = report?.savedAt || new Date().toISOString();
  const payload = { ...report, id, savedAt };

  db.prepare(
    "INSERT OR REPLACE INTO fault_reports (id, saved_at, payload) VALUES (?, ?, ?)"
  ).run(id, savedAt, JSON.stringify(payload));
}

function clearReports() {
  db.prepare("DELETE FROM fault_reports").run();
}

function readLegacyJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
<<<<<<< HEAD
}
=======
}
>>>>>>> e616fd2163a2abe806a85cf9116eb136c56905ca
