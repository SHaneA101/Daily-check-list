const SESSION_STORAGE_KEY = "daily-checklist-user-key";
const SESSION_EMAIL_KEY = "daily-checklist-user-email";

function normalizeUserKey(rawValue) {
  return String(rawValue || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._@-]+/g, "-")
    .replace(/-+/g, "-");
}

function setSession(email) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const userKey = normalizeUserKey(cleanEmail);
  if (!userKey) {
    throw new Error("A valid email is required.");
  }

  localStorage.setItem(SESSION_STORAGE_KEY, userKey);
  localStorage.setItem(SESSION_EMAIL_KEY, cleanEmail);
  return { userKey, email: cleanEmail };
}

function getSession() {
  const userKey = localStorage.getItem(SESSION_STORAGE_KEY) || "";
  const email = localStorage.getItem(SESSION_EMAIL_KEY) || "";
  if (!userKey) {
    return null;
  }

  return { userKey, email };
}

function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(SESSION_EMAIL_KEY);
}

function requireSession(redirectPath = "index.html") {
  const session = getSession();
  if (session) {
    return session;
  }

  window.location.href = redirectPath;
  return null;
}

function authHeaders(existingHeaders = {}) {
  const session = getSession();
  if (!session) {
    return existingHeaders;
  }

  return {
    ...existingHeaders,
    "x-user-key": session.userKey,
  };
}

window.DailyChecklistSession = {
  setSession,
  getSession,
  clearSession,
  requireSession,
  authHeaders,
};
