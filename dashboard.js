const HOURS = ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

function createHourlyValues(defaultValue = "") {
  return Object.fromEntries(HOURS.map((hour) => [hour, defaultValue]));
}

const template = {
  meta: {
    department: "Washline",
    checkDate: "2026-03-20",
    shift: "Day Shift",
    supervisor: "Bakkies",
  },
  sections: [
    {
      title: "Equipment Checks",
      rows: [
        { id: "pumps-filters", item: "Check pumps and filters", kind: "status", values: createHourlyValues(), note: "" },
        { id: "flume-level", item: "Is the flume level correct?", kind: "status", values: createHourlyValues(), note: "" },
        { id: "chlorine-level", item: "Is the chlorine in the flume correct?", kind: "status", values: createHourlyValues(), note: "" },
        { id: "dosing-roller", item: "Dosing roller clean and turning?", kind: "status", values: createHourlyValues(), note: "" },
        { id: "elevator", item: "Does the elevator work?", kind: "status", values: createHourlyValues(), note: "" },
        { id: "hypercide", item: "Does the hypercide work?", kind: "status", values: createHourlyValues(), note: "" },
        { id: "flooder", item: "Do the flooder curtains work?", kind: "status", values: createHourlyValues(), note: "" },
        { id: "screen", item: "Does the dosing screen work?", kind: "status", values: createHourlyValues(), note: "" },
        { id: "chemicals", item: "Are chemical cylinders full?", kind: "status", values: createHourlyValues(), note: "" },
        { id: "air-knives", item: "Do the air knives blow properly?", kind: "status", values: createHourlyValues(), note: "" },
        { id: "tunnels", item: "Is fruit moving safely through the tunnels?", kind: "status", values: createHourlyValues(), note: "" }
      ]
    },
    {
      title: "Temperature Checks",
      rows: [
        { id: "flooder-temp", item: "Flooder temp", kind: "reading", values: createHourlyValues(), note: "" },
        { id: "drying-1", item: "Drying Tunnel 1 temp", kind: "reading", values: createHourlyValues(), note: "" },
        { id: "wax-temp", item: "Wax Tunnel temp", kind: "reading", values: createHourlyValues(), note: "" }
      ]
    },
    {
      title: "Quality and Cleaning",
      rows: [
        { id: "dry-fruit", item: "Are the fruit dry at the tunnel exit?", kind: "status", values: createHourlyValues(), note: "" },
        { id: "wax-drum", item: "Is the wax drum clean and full?", kind: "status", values: createHourlyValues(), note: "" },
        { id: "wax-pump", item: "Does the wax pump operate without unusual noise or vibration?", kind: "status", values: createHourlyValues(), note: "" }
      ]
    }
  ]
};

const checklistBody = document.getElementById("checklist-body");
const metaForm = document.getElementById("meta-form");
const saveStatus = document.getElementById("save-status");
const saveHistoryButton = document.getElementById("save-history-btn");

let state = structuredClone(template);
let saveTimer = null;

initialize();

async function initialize() {
  state = await loadState();
  hydrateMetaForm();
  renderTable();
  bindEvents();
}

async function loadState() {
  try {
    const response = await fetch("/api/checklist/current");
    const stored = await response.json();
    if (!stored) {
      return structuredClone(template);
    }

    return {
      meta: { ...template.meta, ...stored.meta },
      sections: template.sections.map((section) => {
        const storedSection = stored.sections?.find((item) => item.title === section.title);
        return {
          ...section,
          rows: section.rows.map((row) => {
            const storedRow = storedSection?.rows?.find((item) => item.id === row.id);
            return {
              ...row,
              values: { ...row.values, ...(storedRow?.values || {}) },
              note: storedRow?.note ?? row.note,
            };
          }),
        };
      }),
    };
  } catch {
    saveStatus.textContent = "Could not load shared checklist data.";
    return structuredClone(template);
  }
}

function hydrateMetaForm() {
  Object.entries(state.meta).forEach(([key, value]) => {
    const field = metaForm.elements.namedItem(key);
    if (field) {
      field.value = value;
    }
  });
}

function bindEvents() {
  metaForm.addEventListener("input", handleMetaChange);
  checklistBody.addEventListener("input", handleTableInput);
  checklistBody.addEventListener("change", handleTableInput);
  saveHistoryButton.addEventListener("click", saveToHistory);
}

function handleMetaChange(event) {
  const field = event.target;
  if (!(field instanceof HTMLInputElement)) {
    return;
  }

  state.meta[field.name] = field.value;
  queueSave("Checklist details saved.");
}

function handleTableInput(event) {
  const field = event.target;
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) {
    return;
  }

  const rowId = field.dataset.rowId;
  if (!rowId) {
    return;
  }

  const row = findRow(rowId);
  if (!row) {
    return;
  }

  if (field.dataset.hour) {
    row.values[field.dataset.hour] = field.value;
  } else if (field.dataset.note === "true") {
    row.note = field.value;
  }

  queueSave("Hourly checklist saved.");
}

function findRow(rowId) {
  for (const section of state.sections) {
    const row = section.rows.find((item) => item.id === rowId);
    if (row) {
      return row;
    }
  }

  return null;
}

function queueSave(message) {
  saveStatus.textContent = "Saving...";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    persist(message);
  }, 250);
}

async function persist(message) {
  try {
    await fetch("/api/checklist/current", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    saveStatus.textContent = message;
  } catch {
    saveStatus.textContent = "Could not save checklist. Check the server connection.";
  }
}

async function saveToHistory() {
  const snapshot = {
    id: `${Date.now()}`,
    savedAt: new Date().toISOString(),
    meta: { ...state.meta },
    sections: state.sections.map((section) => ({
      title: section.title,
      rows: section.rows.map((row) => ({
        id: row.id,
        item: row.item,
        kind: row.kind,
        values: { ...row.values },
        note: row.note,
      })),
    })),
  };

  try {
    await fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });
    saveStatus.textContent = "Daily hourly checklist saved to shared historical records.";
  } catch {
    saveStatus.textContent = "Could not save to history. Check the server connection.";
  }
}

function renderTable() {
  const sectionColspan = HOURS.length + 2;
  const markup = state.sections
    .map((section) => {
      const sectionRows = section.rows.map((row) => renderRow(row)).join("");
      return `
        <tr class="section-row">
          <td colspan="${sectionColspan}">${escapeHtml(section.title)}</td>
        </tr>
        ${sectionRows}
      `;
    })
    .join("");

  checklistBody.innerHTML = markup;
}

function renderRow(row) {
  const cells = HOURS.map((hour) => renderCell(row, hour)).join("");

  return `
    <tr>
      <td>${escapeHtml(row.item)}</td>
      ${cells}
      <td class="note-cell">
        <textarea class="note-input" data-row-id="${row.id}" data-note="true" rows="2">${escapeHtml(row.note)}</textarea>
      </td>
    </tr>
  `;
}

function renderCell(row, hour) {
  const value = row.values[hour] ?? "";
  if (row.kind === "reading") {
    return `
      <td class="day-cell">
        <input class="table-input" type="text" data-row-id="${row.id}" data-hour="${hour}" value="${escapeAttribute(value)}" placeholder="--" />
      </td>
    `;
  }

  return `
    <td class="day-cell">
      <select class="table-select" data-row-id="${row.id}" data-hour="${hour}">
        <option value="" ${value === "" ? "selected" : ""}>Blank</option>
        <option value="ok" ${value === "ok" ? "selected" : ""}>OK</option>
        <option value="attention" ${value === "attention" ? "selected" : ""}>Attention</option>
      </select>
    </td>
  `;
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
