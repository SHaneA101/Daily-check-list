const REPORTS_KEY_ENDPOINT = "/api/reports";

const faultForm = document.getElementById("fault-form");
const photoInput = document.getElementById("photo-input");
const photoPreview = document.getElementById("photo-preview");
const reportStatus = document.getElementById("report-status");
const resetReportButton = document.getElementById("reset-report-btn");
const session = window.DailyChecklistSession.requireSession();

let photoDataUrl = "";
if (session) {
  photoInput.addEventListener("change", handlePhotoChange);
  faultForm.addEventListener("submit", handleSubmit);
  resetReportButton.addEventListener("click", resetForm);
}

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
    equipment: String(formData.get("equipment") || ""),
    severity: String(formData.get("severity") || ""),
    description: String(formData.get("description") || ""),
    photo: photoDataUrl,
  };

  try {
    const response = await fetch(REPORTS_KEY_ENDPOINT, {
      method: "POST",
      headers: window.DailyChecklistSession.authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(report),
    });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    reportStatus.textContent = "Fault report saved to shared historical records.";
    resetForm(false);
  } catch {
    reportStatus.textContent = "Could not save fault report. Check the server connection.";
  }
}

function resetForm(resetStatus = true) {
  faultForm.reset();
  faultForm.elements.namedItem("department").value = "Washline";
  faultForm.elements.namedItem("reportDate").value = "2026-03-20";
  faultForm.elements.namedItem("severity").value = "Medium";
  photoDataUrl = "";
  photoPreview.src = "";
  photoPreview.classList.add("is-hidden");
  if (resetStatus) {
    reportStatus.textContent = "Form cleared. You can take another photo and submit a new report.";
  }
}
