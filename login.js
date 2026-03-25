const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "");

  try {
    window.DailyChecklistSession.setSession(email);
    window.location.href = "dashboard.html";
  } catch (error) {
    loginStatus.textContent = error.message;
  }
});
