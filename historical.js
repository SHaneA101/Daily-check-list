const HISTORY_ENDPOINT = "/api/history";
const REPORTS_ENDPOINT = "/api/reports";
const HOURS = ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const historyList = document.getElementById("history-list");
const reportList = document.getElementById("report-list");
const clearHistoryButton = document.getElementById("clear-history-btn");

initialize();
clearHistoryButton.addEventListener("click", clearHistory);

async function initialize() {
  await Promise.all([renderReports(), renderHistory()]);
}

async function renderReports() {
  try {
    const reports = await requestJson(REPORTS_ENDPOINT);
    if (!reports.length) {
      reportList.innerHTML = `
        <div class="history-empty">
          <h2>No fault reports yet</h2>
          <p>Use the fault reporting page to take a photo and save the first damage or fault report.</p>
        </div>
      `;
      return;
    }

    reportList.innerHTML = reports
      .map((report) => `
        <article class="report-card">
          <img class="report-image" src="${report.photo}" alt="Fault report photo for ${escapeAttribute(report.equipment || "equipment")}" />
          <div class="report-card-content">
            <div class="history-card-header">
              <div>
                <p class="eyebrow">Reported ${formatDate(report.savedAt)}</p>
                <h2>${escapeHtml(report.equipment || "Unknown equipment")}</h2>
              </div>
              <div class="history-meta">
                <span>Date: ${escapeHtml(report.reportDate || "")}</span>
                <span>Time: ${escapeHtml(report.reportTime || "")}</span>
                <span>Department: ${escapeHtml(report.department || "")}</span>
                <span>Severity: ${escapeHtml(report.severity || "")}</span>
              </div>
            </div>
            <p class="report-description">${escapeHtml(report.description || "")}</p>
          </div>
        </article>
      `)
      .join("");
  } catch (error) {
    reportList.innerHTML = `
      <div class="history-empty">
        <h2>Could not load fault reports</h2>
        <p>${escapeHtml(error.message || "Please try again.")}</p>
      </div>
    `;
  }
}

async function renderHistory() {
  try {
    const entries = await requestJson(HISTORY_ENDPOINT);
    if (!entries.length) {
      historyList.innerHTML = `
        <div class="history-empty">
          <h2>No saved records yet</h2>
          <p>Go to the dashboard, complete the hourly checks for the day, and click "Save To History" to create your first archive.</p>
        </div>
      `;
      return;
    }

    historyList.innerHTML = entries
      .map((entry) => {
        const meta = entry.meta || {};
        const sections = Array.isArray(entry.sections) ? entry.sections : [];
        const tables = sections
          .map((section) => {
            const rows = Array.isArray(section.rows) ? section.rows : [];
            const rowMarkup = rows
              .map((row) => {
                const values = row.values || {};
                const hourValues = HOURS.map((hour) => `<td>${formatValue(values[hour], row.kind)}</td>`).join("");
                return `
                  <tr>
                    <td>${escapeHtml(row.item)}</td>
                    ${hourValues}
                    <td>${escapeHtml(row.note || "")}</td>
                  </tr>
                `;
              })
              .join("");

            const hourHeaders = HOURS.map((hour) => `<th class="day-cell">${hour}</th>`).join("");

            return `
              <section class="history-section">
                <h3>${escapeHtml(section.title)}</h3>
                <div class="table-wrap">
                  <table class="checklist-table history-table">
                    <thead>
                      <tr>
                        <th class="item-col">Checklist Item</th>
                        ${hourHeaders}
                        <th>Operations / Notes</th>
                      </tr>
                    </thead>
                    <tbody>${rowMarkup}</tbody>
                  </table>
                </div>
              </section>
            `;
          })
          .join("");

        return `
          <article class="history-card">
            <div class="history-card-header">
              <div>
                <p class="eyebrow">Saved ${formatDate(entry.savedAt)}</p>
                <h2>${escapeHtml(meta.department || "Unknown department")} &middot; ${escapeHtml(meta.shift || "Unknown shift")}</h2>
              </div>
              <div class="history-meta">
                <span>Check Date: ${escapeHtml(meta.checkDate || "")}</span>
                <span>Supervisor: ${escapeHtml(meta.supervisor || "")}</span>
              </div>
            </div>
            ${tables}
          </article>
        `;
      })
      .join("");
  } catch (error) {
    historyList.innerHTML = `
      <div class="history-empty">
        <h2>Could not load saved records</h2>
        <p>${escapeHtml(error.message || "Please try again.")}</p>
      </div>
    `;
  }
}

async function clearHistory() {
  clearHistoryButton.disabled = true;

  try {
    await Promise.all([
      requestJson(HISTORY_ENDPOINT, { method: "DELETE" }),
      requestJson(REPORTS_ENDPOINT, { method: "DELETE" }),
    ]);
    await initialize();
  } catch (error) {
    historyList.innerHTML = `
      <div class="history-empty">
        <h2>Could not clear records</h2>
        <p>${escapeHtml(error.message || "Please check that the server is running and try again.")}</p>
      </div>
    `;
    reportList.innerHTML = `
      <div class="history-empty">
        <h2>Could not clear fault reports</h2>
        <p>${escapeHtml(error.message || "Please check that the server is running and try again.")}</p>
      </div>
    `;
  } finally {
    clearHistoryButton.disabled = false;
  }
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  return readApiResponse(response);
}

async function readApiResponse(response) {
  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`Unexpected server response (${response.status}).`);
    }
  }

  if (!response.ok) {
    throw new Error(payload?.detail || payload?.error || `Request failed (${response.status}).`);
  }

  return payload;
}

function formatValue(value, kind) {
  if (!value) {
    return '<span class="history-empty-mark">-</span>';
  }

  if (kind === "status") {
    if (value === "ok") {
      return '<span class="history-badge ok">OK</span>';
    }

    if (value === "attention") {
      return '<span class="history-badge attention">Attention</span>';
    }
  }

  return escapeHtml(value);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}
