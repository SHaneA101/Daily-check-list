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

    const path = event.path.replace(/^\/\.netlify\/functions\/api/, "") || "/";
    const method = event.httpMethod;

    if (path === "/health" && method === "GET") {
      return json(200, { ok: true });
    }

    if (path === "/checklist/current") {
      if (method === "GET") {
        return json(200, await getCurrentChecklist());
      }

      if (method === "PUT") {
        await setCurrentChecklist(readJsonBody(event));
        return json(200, { ok: true });
      }
    }

    if (path === "/history") {
      if (method === "GET") {
        return json(200, await getHistory());
      }

      if (method === "POST") {
        await addHistoryEntry(readJsonBody(event));
        return json(201, { ok: true });
      }

      if (method === "DELETE") {
        await clearHistory();
        return json(200, { ok: true });
      }
    }

    if (path === "/reports") {
      if (method === "GET") {
        return json(200, await getReports());
      }

      if (method === "POST") {
        await addReport(readJsonBody(event));
        return json(201, { ok: true });
      }

      if (method === "DELETE") {
        await clearReports();
        return json(200, { ok: true });
      }
    }

    return json(404, { error: "Not found" });
  } catch (error) {
    return json(500, { error: "Server error", detail: error.message });
  }
};

function readJsonBody(event) {
  if (!event.body) {
    return {};
  }

  return JSON.parse(event.body);
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
