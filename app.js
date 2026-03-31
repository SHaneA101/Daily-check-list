const SUPABASE_URL = "https://idfmnbsmqibfvbmyphci.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZm1uYnNtcWliZnZibXlwaGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NDQ1MTksImV4cCI6MjA5MDAyMDUxOX0.OFKNZgxWFQ_QxSC5AqGXZN254qKoYCiF-5vaqEP1yTk";
const LOGIN_PATH = "/index.html";
const SIGNUP_PATH = "/signup.html";
const FORGOT_PASSWORD_PATH = "/forgot-password.html";
const DASHBOARD_PATH = "/dashboard.html";
const PROTECTED_PATHS = new Set([DASHBOARD_PATH, "/fault-report.html", "/historical.html"]);
const REDIRECT_IF_SIGNED_IN_PATHS = new Set([LOGIN_PATH, SIGNUP_PATH]);
const STORAGE_KEYS = {
  currentChecklist: "daily-checklist/current",
  history: "daily-checklist/history",
  reports: "daily-checklist/reports",
};

const authStatus = document.getElementById("auth-status");
const loginForm = document.querySelector('[data-auth-form="login"]');
const signupForm = document.querySelector('[data-auth-form="signup"]');
const forgotPasswordForm = document.querySelector('[data-auth-form="forgot-password"]');
const logoutButtons = Array.from(document.querySelectorAll("[data-auth-logout]"));
const recoveryFields = document.getElementById("recovery-fields");
const recoveryTitle = document.querySelector("[data-recovery-title]");
const recoveryCopy = document.querySelector("[data-recovery-copy]");

window.dailyChecklistStorage = {
  isLocalMode,
  getCurrentChecklist() {
    return readStorageJson(STORAGE_KEYS.currentChecklist, null);
  },
  setCurrentChecklist(value) {
    writeStorageJson(STORAGE_KEYS.currentChecklist, value);
  },
  getHistory() {
    return readStorageJson(STORAGE_KEYS.history, []);
  },
  addHistoryEntry(entry) {
    const items = readStorageJson(STORAGE_KEYS.history, []).filter((item) => item?.id !== entry?.id);
    items.unshift(entry);
    writeStorageJson(STORAGE_KEYS.history, items);
  },
  clearHistory() {
    writeStorageJson(STORAGE_KEYS.history, []);
  },
  getReports() {
    return readStorageJson(STORAGE_KEYS.reports, []);
  },
  addReport(report) {
    const items = readStorageJson(STORAGE_KEYS.reports, []).filter((item) => item?.id !== report?.id);
    items.unshift(report);
    writeStorageJson(STORAGE_KEYS.reports, items);
  },
  clearReports() {
    writeStorageJson(STORAGE_KEYS.reports, []);
  },
};

initializeAuth().catch((error) => {
  console.error("Auth initialization failed:", error);
  setAuthStatus("Authentication could not start. Please refresh the page.", "error");
});

async function initializeAuth() {
  if (typeof window.supabase?.createClient !== "function") {
    throw new Error("Supabase client is unavailable.");
  }

  const authClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const currentPath = normalizePath(window.location.pathname);
  const isRecoveryMode = currentPath === FORGOT_PASSWORD_PATH && getHashParams().get("type") === "recovery";

  if (isRecoveryMode) {
    enableRecoveryMode();
  }

  const {
    data: { session },
    error,
  } = await authClient.auth.getSession();

  if (error) {
    throw error;
  }

  if (PROTECTED_PATHS.has(currentPath) && !session) {
    redirectTo(LOGIN_PATH);
    return;
  }

  if (REDIRECT_IF_SIGNED_IN_PATHS.has(currentPath) && session) {
    redirectTo(DASHBOARD_PATH);
    return;
  }

  bindLogoutButtons(authClient);

  if (loginForm) {
    loginForm.addEventListener("submit", (event) => handleLoginSubmit(event, authClient));
  }

  if (signupForm) {
    signupForm.addEventListener("submit", (event) => handleSignupSubmit(event, authClient));
  }

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", (event) => handleForgotPasswordSubmit(event, authClient));
  }

  authClient.auth.onAuthStateChange((event, nextSession) => {
    const path = normalizePath(window.location.pathname);

    if (event === "SIGNED_OUT" && PROTECTED_PATHS.has(path)) {
      redirectTo(LOGIN_PATH);
      return;
    }

    if (nextSession && REDIRECT_IF_SIGNED_IN_PATHS.has(path)) {
      redirectTo(DASHBOARD_PATH);
    }
  });
}

async function handleLoginSubmit(event, authClient) {
  event.preventDefault();
  const submitButton = getSubmitButton(loginForm);
  const formData = new FormData(loginForm);
  const email = readField(formData, "email");
  const password = readField(formData, "password");

  setButtonBusy(submitButton, true, "Logging in...");
  setAuthStatus("Checking your details...", "info");

  try {
    const { error } = await authClient.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }

    setAuthStatus("Login successful. Redirecting...", "success");
    redirectTo(DASHBOARD_PATH);
  } catch (error) {
    setAuthStatus(error.message || "Could not log in with those details.", "error");
  } finally {
    setButtonBusy(submitButton, false);
  }
}

async function handleSignupSubmit(event, authClient) {
  event.preventDefault();
  const submitButton = getSubmitButton(signupForm);
  const formData = new FormData(signupForm);
  const fullName = readField(formData, "fullName");
  const email = readField(formData, "email");
  const password = readField(formData, "password");
  const confirmPassword = readField(formData, "confirmPassword");

  if (password.length < 8) {
    setAuthStatus("Use at least 8 characters for the password.", "error");
    return;
  }

  if (password !== confirmPassword) {
    setAuthStatus("The password confirmation does not match.", "error");
    return;
  }

  setButtonBusy(submitButton, true, "Creating account...");
  setAuthStatus("Creating your account...", "info");

  try {
    const { data, error } = await authClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: buildAppUrl("dashboard.html"),
      },
    });

    if (error) {
      throw error;
    }

    if (data.session) {
      setAuthStatus("Account created. Redirecting...", "success");
      redirectTo(DASHBOARD_PATH);
      return;
    }

    signupForm.reset();
    setAuthStatus("Account created. Check your email to confirm your sign-up.", "success");
  } catch (error) {
    setAuthStatus(error.message || "Could not create the account.", "error");
  } finally {
    setButtonBusy(submitButton, false);
  }
}

async function handleForgotPasswordSubmit(event, authClient) {
  event.preventDefault();
  const submitButton = getSubmitButton(forgotPasswordForm);
  const formData = new FormData(forgotPasswordForm);
  const isRecoveryMode = forgotPasswordForm.dataset.mode === "recovery";

  setButtonBusy(submitButton, true, isRecoveryMode ? "Updating password..." : "Sending reset link...");

  try {
    if (isRecoveryMode) {
      const password = readField(formData, "password");
      const confirmPassword = readField(formData, "confirmPassword");

      if (password.length < 8) {
        throw new Error("Use at least 8 characters for the new password.");
      }

      if (password !== confirmPassword) {
        throw new Error("The password confirmation does not match.");
      }

      const { error } = await authClient.auth.updateUser({ password });
      if (error) {
        throw error;
      }

      setAuthStatus("Password updated. Redirecting to the dashboard...", "success");
      redirectTo(DASHBOARD_PATH);
      return;
    }

    const email = readField(formData, "email");
    const { error } = await authClient.auth.resetPasswordForEmail(email, {
      redirectTo: buildAppUrl("forgot-password.html"),
    });

    if (error) {
      throw error;
    }

    setAuthStatus("Reset link sent. Check your email to continue.", "success");
  } catch (error) {
    setAuthStatus(error.message || "Could not complete the password reset flow.", "error");
  } finally {
    setButtonBusy(submitButton, false);
  }
}

function bindLogoutButtons(authClient) {
  logoutButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      setButtonBusy(button, true, "Logging out...");

      try {
        const { error } = await authClient.auth.signOut();
        if (error) {
          throw error;
        }

        redirectTo(LOGIN_PATH);
      } catch (error) {
        console.error("Logout failed:", error);
        setAuthStatus("Could not log out right now. Please try again.", "error");
      } finally {
        setButtonBusy(button, false);
      }
    });
  });
}

function enableRecoveryMode() {
  if (!forgotPasswordForm || !recoveryFields) {
    return;
  }

  forgotPasswordForm.dataset.mode = "recovery";
  recoveryFields.classList.remove("is-hidden");

  const emailField = forgotPasswordForm.elements.namedItem("email");
  if (emailField instanceof HTMLInputElement) {
    const fieldLabel = emailField.closest("label");
    emailField.disabled = true;
    emailField.required = false;
    if (fieldLabel) {
      fieldLabel.classList.add("is-hidden");
    }
  }

  const passwordField = forgotPasswordForm.elements.namedItem("password");
  if (passwordField instanceof HTMLInputElement) {
    passwordField.required = true;
  }

  const confirmPasswordField = forgotPasswordForm.elements.namedItem("confirmPassword");
  if (confirmPasswordField instanceof HTMLInputElement) {
    confirmPasswordField.required = true;
  }

  if (recoveryTitle) {
    recoveryTitle.textContent = "Create a new password";
  }

  if (recoveryCopy) {
    recoveryCopy.textContent = "Enter a new password below to finish resetting your account.";
  }

  const submitButton = getSubmitButton(forgotPasswordForm);
  if (submitButton) {
    submitButton.innerHTML = 'Update Password <span class="chevron">&rsaquo;</span>';
  }

  setAuthStatus("Reset link confirmed. Enter your new password to finish.", "success");
}

function setAuthStatus(message, tone = "info") {
  if (!authStatus) {
    return;
  }

  authStatus.textContent = message;
  authStatus.classList.remove("is-error", "is-success");

  if (tone === "error") {
    authStatus.classList.add("is-error");
  }

  if (tone === "success") {
    authStatus.classList.add("is-success");
  }
}

function setButtonBusy(button, isBusy, busyLabel = "Working...") {
  if (!button) {
    return;
  }

  if (!button.dataset.originalHtml) {
    button.dataset.originalHtml = button.innerHTML;
  }

  button.disabled = isBusy;
  button.innerHTML = isBusy ? busyLabel : button.dataset.originalHtml;
}

function getSubmitButton(form) {
  return form?.querySelector('button[type="submit"]') || null;
}

function readField(formData, fieldName) {
  return String(formData.get(fieldName) || "").trim();
}

function getHashParams() {
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

function normalizePath(pathname) {
  if (isLocalMode()) {
    const decodedPath = decodeURIComponent(pathname || "");
    const currentFile = decodedPath.split("/").pop() || "index.html";
    return `/${currentFile.toLowerCase()}`;
  }

  return pathname === "/" ? LOGIN_PATH : pathname.toLowerCase();
}

function buildAppUrl(fileName) {
  const relativeFileName = fileName.replace(/^\//, "");
  const baseUrl = isLocalMode() ? window.location.href : `${window.location.origin}/`;
  return new URL(relativeFileName, baseUrl).toString();
}

function redirectTo(path) {
  window.location.replace(buildAppUrl(path.replace(/^\//, "")));
}

function isLocalMode() {
  return window.location.protocol === "file:";
}

function readStorageJson(key, fallback) {
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorageJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Could not write local storage for ${key}:`, error);
  }
}
