const API_BASE = "";

function getToken() {
  return localStorage.getItem("token");
}

function getRefreshToken() {
  return localStorage.getItem("refresh_token");
}

function setSession(token, name, termsAccepted, onboardingDone, refreshToken) {
  localStorage.setItem("token", token);
  localStorage.setItem("user_name", name);
  localStorage.setItem("terms_accepted", termsAccepted === true || termsAccepted === "true" ? "true" : "false");
  if (onboardingDone !== undefined) localStorage.setItem("onboarding_done", onboardingDone ? "true" : "false");
  if (refreshToken) localStorage.setItem("refresh_token", refreshToken);
}

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user_name");
  localStorage.removeItem("google_picture");
  localStorage.removeItem("terms_accepted");
  localStorage.removeItem("onboarding_done");
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = "/login.html";
    return;
  }
  requireTerms();
}

function requireTerms() {
  if (localStorage.getItem("terms_accepted") !== "true") {
    window.location.href = "/terms.html";
  }
}

let _refreshingPromise = null;

async function _tryRefresh() {
  const rt = getRefreshToken();
  if (!rt) return false;
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem("token", data.access_token);
    if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
    return true;
  } catch (_) {
    return false;
  }
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res = await fetch(API_BASE + path, { ...options, headers });

  if (res.status === 401) {
    // Intentar refresh token antes de redirigir al login
    if (!_refreshingPromise) {
      _refreshingPromise = _tryRefresh().finally(() => { _refreshingPromise = null; });
    }
    const refreshed = await _refreshingPromise;
    if (refreshed) {
      // Reintentar el request con el nuevo access token
      headers["Authorization"] = `Bearer ${getToken()}`;
      res = await fetch(API_BASE + path, { ...options, headers });
      if (res.status !== 401) {
        if (!res.ok) {
          let body = ""; try { body = await res.text(); } catch (_) {}
          let detail = `Error ${res.status}`;
          try { const j = JSON.parse(body); detail = j.detail || detail; } catch (_) {}
          throw new Error(detail);
        }
        if (res.status === 204) return null;
        return res.json();
      }
    }
    clearSession();
    window.location.href = "/login.html";
    return;
  }

  if (!res.ok) {
    let body = "";
    try { body = await res.text(); } catch (_) {}
    let detail = `Error ${res.status}`;
    try { const j = JSON.parse(body); detail = j.detail || detail; } catch (_) {}
    if (!body) detail = `Error ${res.status} (sin respuesta del servidor)`;
    throw new Error(detail);
  }

  if (res.status === 204) return null;
  return res.json();
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amount);
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function populateYearSelect(selectEl, yearsBack = 3) {
  const current = new Date().getFullYear();
  for (let y = current; y >= current - yearsBack; y--) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    selectEl.appendChild(opt);
  }
}

function initPageCommons() {
  const now = new Date();
  const monthSel = document.getElementById("month-select");
  const yearSel = document.getElementById("year-select");
  if (monthSel) monthSel.value = now.getMonth() + 1;
  if (yearSel) populateYearSelect(yearSel);

  const greeting = document.getElementById("user-greeting");
  if (greeting) greeting.textContent = "Hola, " + (localStorage.getItem("user_name") || "usuario");
}

function logout() {
  clearSession();
  window.location.href = "/login.html";
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
