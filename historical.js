const HISTORY_ENDPOINT = "/api/history";
const REPORTS_ENDPOINT = "/api/reports";
const HOURS = ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const historyList = document.getElementById("history-list");
const reportList = document.getElementById("report-list");
const clearHistoryButton = document.getElementById("clear-history-btn");
const session = window.DailyChecklistSession.requireSession();
if (session) {
  initialize();
  clearHistoryButton.addEventListener("click", clearHistory);
}

async function initialize() {
  await Promise.all([renderReports(), renderHistory()]);
}

async function renderReports() {
  const reports = await readReports();
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
              <span>Department: ${escapeHtml(report.department || "")}</span>
              <span>Severity: ${escapeHtml(report.severity || "")}</span>
            </div>
          </div>
          <p class="report-description">${escapeHtml(report.description || "")}</p>
        </div>
      </article>
    `)
    .join("");
}

async function renderHistory() {
  const entries = await readHistory();
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
      const tables = entry.sections
        .map((section) => {
          const rows = section.rows
            .map((row) => {
              const hourValues = HOURS.map((hour) => `<td>${formatValue(row.values[hour], row.kind)}</td>`).join("");
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
                  <tbody>${rows}</tbody>
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
              <h2>${escapeHtml(entry.meta.department)} &middot; ${escapeHtml(entry.meta.shift)}</h2>
            </div>
            <div class="history-meta">
              <span>Check Date: ${escapeHtml(entry.meta.checkDate || "")}</span>
              <span>Supervisor: ${escapeHtml(entry.meta.supervisor || "")}</span>
            </div>
          </div>
          ${tables}
        </article>
      `;
    })
    .join("");
}

async function clearHistory() {
  try {
    await Promise.all([
      fetch(HISTORY_ENDPOINT, { method: "DELETE", headers: window.DailyChecklistSession.authHeaders() }),
      fetch(REPORTS_ENDPOINT, { method: "DELETE", headers: window.DailyChecklistSession.authHeaders() }),
    ]);
    await initialize();
  } catch {
    historyList.innerHTML = `
      <div class="history-empty">
        <h2>Could not clear records</h2>
        <p>Please check that the server is running and try again.</p>
      </div>
    `;
  }
}

async function readHistory() {
  try {
    const response = await fetch(HISTORY_ENDPOINT, {
      headers: window.DailyChecklistSession.authHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    return await response.json();
  } catch {
    return [];
  }
}

async function readReports() {
  try {
    const response = await fetch(REPORTS_ENDPOINT, {
      headers: window.DailyChecklistSession.authHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    return await response.json();
  } catch {
    return [];
  }
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
