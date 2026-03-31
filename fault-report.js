const REPORTS_KEY_ENDPOINT = "/api/reports";

const faultForm = document.getElementById("fault-form");
const photoInput = document.getElementById("photo-input");
const photoPreview = document.getElementById("photo-preview");
const reportStatus = document.getElementById("report-status");
const resetReportButton = document.getElementById("reset-report-btn");
const submitReportButton = faultForm.querySelector('button[type="submit"]');

let photoDataUrl = "";

initializeForm();
photoInput.addEventListener("change", handlePhotoChange);
faultForm.addEventListener("submit", handleSubmit);
resetReportButton.addEventListener("click", resetForm);

function handlePhotoChange(event) {
  const file = event.target.files?.[0];
  if (!file) {
    photoDataUrl = "";
    photoPreview.src = "";
    photoPreview.classList.add("is-hidden");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    photoDataUrl = typeof reader.result === "string" ? reader.result : "";
    photoPreview.src = photoDataUrl;
    photoPreview.classList.remove("is-hidden");
    reportStatus.textContent = "Photo ready. Save the report when the details are complete.";
  };
  reader.readAsDataURL(file);
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!photoDataUrl) {
    reportStatus.textContent = "Please take or upload a photo before saving.";
    return;
  }

  const formData = new FormData(faultForm);
  const report = {
    id: `${Date.now()}`,
    savedAt: new Date().toISOString(),
    department: String(formData.get("department") || ""),
    reportDate: String(formData.get("reportDate") || ""),
    reportTime: String(formData.get("reportTime") || ""),
    equipment: String(formData.get("equipment") || ""),
    severity: String(formData.get("severity") || ""),
    description: String(formData.get("description") || ""),
    photo: photoDataUrl,
  };

  submitReportButton.disabled = true;
  reportStatus.textContent = "Saving fault report...";
  const storageBridge = getStorageBridge();

  if (shouldUseLocalStorageOnly()) {
    storageBridge?.addReport(report);
    reportStatus.textContent = "Fault report saved on this device.";
    resetForm(false);
    submitReportButton.disabled = false;
    return;
  }

  try {
    await requestJson(REPORTS_KEY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    });
    storageBridge?.addReport(report);
    reportStatus.textContent = "Fault report saved to shared historical records.";
    resetForm(false);
  } catch (error) {
    if (storageBridge) {
      storageBridge.addReport(report);
      reportStatus.textContent = "Shared server unavailable. Fault report saved on this device.";
      resetForm(false);
      return;
    }

    reportStatus.textContent = error.message || "Could not save fault report. Check the server connection.";
  } finally {
    submitReportButton.disabled = false;
  }
}

function resetForm(resetStatus = true) {
  faultForm.reset();
  setDefaultFormValues();
  photoDataUrl = "";
  photoPreview.src = "";
  photoPreview.classList.add("is-hidden");
  if (resetStatus) {
    reportStatus.textContent = "Form cleared. You can take another photo and submit a new report.";
  }
}

function initializeForm() {
  setDefaultFormValues();
}

function setDefaultFormValues() {
  faultForm.elements.namedItem("department").value = "Washline";
  faultForm.elements.namedItem("reportDate").value = getTodayIsoDate();
  faultForm.elements.namedItem("reportTime").value = getCurrentTimeValue();
  faultForm.elements.namedItem("severity").value = "Medium";
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

function getTodayIsoDate() {
  const now = new Date();
  const timezoneAdjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return timezoneAdjusted.toISOString().slice(0, 10);
}

function getCurrentTimeValue() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getStorageBridge() {
  return window.dailyChecklistStorage || null;
}

function shouldUseLocalStorageOnly() {
  return Boolean(getStorageBridge()?.isLocalMode?.());
}
