const {
  ensureSchema,
  getCurrentChecklist,
  setCurrentChecklist,
  getHistory,
  addHistoryEntry,
  clearHistory,
  getReports,
  addReport,
  clearReports,
} = require("./db");

exports.handler = async (event) => {
  try {
    await ensureSchema();

    const path = normalizePath(event);
    const method = event.httpMethod;
    const userKey = readUserKey(event);

    if (path === "/health" && method === "GET") {
      return json(200, { ok: true });
    }

    if (path === "/checklist/current") {
      if (method === "GET") {
        return json(200, await getCurrentChecklist(userKey));
      }

      if (method === "PUT") {
        await setCurrentChecklist(userKey, readJsonBody(event));
        return json(200, { ok: true });
      }
    }

    if (path === "/history") {
      if (method === "GET") {
        return json(200, await getHistory(userKey));
      }

      if (method === "POST") {
        await addHistoryEntry(userKey, readJsonBody(event));
        return json(201, { ok: true });
      }

      if (method === "DELETE") {
        await clearHistory(userKey);
        return json(200, { ok: true });
      }
    }

    if (path === "/reports") {
      if (method === "GET") {
        return json(200, await getReports(userKey));
      }

      if (method === "POST") {
        await addReport(userKey, readJsonBody(event));
        return json(201, { ok: true });
      }

      if (method === "DELETE") {
        await clearReports(userKey);
        return json(200, { ok: true });
      }
    }

    return json(404, { error: "Not found" });
  } catch (error) {
    return json(500, { error: "Server error", detail: error.message });
  }
};

function normalizePath(event) {
  const rawPath = String(event.path || event.rawPath || "/");
  const normalizedPath = rawPath
    .replace(/^\/\.netlify\/functions\/api(\/|$)/, "/")
    .replace(/^\/api(\/|$)/, "/")
    .replace(/\/{2,}/g, "/");

  return normalizedPath === "" ? "/" : normalizedPath;
}

function readJsonBody(event) {
  if (!event.body) {
    return {};
  }

  return JSON.parse(event.body);
}

function readUserKey(event) {
  const headerValue = event.headers?.["x-user-key"] || event.headers?.["X-User-Key"] || "";
  const normalized = String(headerValue).trim().toLowerCase();
  return normalized || "shared";
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  };
}
