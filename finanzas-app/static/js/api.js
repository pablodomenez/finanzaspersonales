const API_BASE = "";

function getToken() {
  return localStorage.getItem("token");
}

function setSession(token, name, termsAccepted) {
  localStorage.setItem("token", token);
  localStorage.setItem("user_name", name);
  localStorage.setItem("terms_accepted", termsAccepted === true || termsAccepted === "true" ? "true" : "false");
}

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user_name");
  localStorage.removeItem("google_picture");
  localStorage.removeItem("terms_accepted");
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

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(API_BASE + path, { ...options, headers });

  if (res.status === 401) {
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
