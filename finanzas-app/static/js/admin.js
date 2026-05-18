// Página de administración — requiere is_admin=true
(async function () {
  requireAuth();

  // Verificar que sea admin antes de mostrar nada
  try {
    const me = await apiFetch("/api/auth/me");
    if (!me || !me.is_admin) {
      window.location.href = "/dashboard.html";
      return;
    }
    document.getElementById("user-greeting") && (document.getElementById("user-greeting").textContent = "Admin: " + me.name);
  } catch (_) {
    window.location.href = "/dashboard.html";
    return;
  }

  initPageCommons();

  // Cargar la primera tab
  loadStats();
})();

// ── Tab switching ────────────────────────────────────────────────────────────

let _loadedTabs = {};

function switchTab(name) {
  ["stats", "users", "feedback", "push"].forEach(t => {
    document.getElementById(`section-${t}`).classList.toggle("hidden", t !== name);
    const btn = document.getElementById(`tab-${t}`);
    if (t === name) {
      btn.className = "tab-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm";
    } else {
      btn.className = "tab-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200";
    }
  });

  if (!_loadedTabs[name]) {
    _loadedTabs[name] = true;
    if (name === "users") loadUsers();
    if (name === "feedback") loadFeedback();
  }
}

// ── Analytics ────────────────────────────────────────────────────────────────

async function loadStats() {
  try {
    const s = await apiFetch("/api/admin/stats");

    document.getElementById("stat-total").textContent = s.users.total;
    document.getElementById("stat-active").textContent = s.users.active;
    document.getElementById("stat-7d").textContent = s.users.new_7d;
    document.getElementById("stat-30d").textContent = s.users.new_30d;

    // Feature usage bars
    const featureEl = document.getElementById("feature-list");
    const ICONS = {
      transacciones: "💸", tarjetas: "💳", presupuestos: "📊", metas: "🎯",
      inversiones: "📈", servicios: "⚡", alquileres: "🏠", prestamos: "🏦", grupos: "👥",
    };
    const maxVal = Math.max(...Object.values(s.feature_usage), 1);
    featureEl.innerHTML = Object.entries(s.feature_usage).map(([k, v]) => `
      <div class="flex items-center gap-2">
        <span class="text-base w-6 text-center">${ICONS[k] || "📋"}</span>
        <span class="text-xs text-slate-600 dark:text-slate-400 w-24 capitalize">${k}</span>
        <div class="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
          <div class="bg-blue-500 h-2 rounded-full" style="width:${Math.round((v / maxVal) * 100)}%"></div>
        </div>
        <span class="text-xs font-semibold text-slate-700 dark:text-slate-300 w-8 text-right">${v}</span>
      </div>
    `).join("");

    // Security
    const secEl = document.getElementById("security-list");
    const total = s.users.total || 1;
    secEl.innerHTML = [
      { label: "2FA activo", val: s.users.totp_enabled, color: "emerald" },
      { label: "Google OAuth", val: s.users.google_linked, color: "blue" },
      { label: "Push habilitado", val: s.users.push_subscribed, color: "violet" },
    ].map(({ label, val, color }) => `
      <div>
        <div class="flex justify-between text-xs mb-1">
          <span class="text-slate-600 dark:text-slate-400">${label}</span>
          <span class="font-semibold text-slate-700 dark:text-slate-300">${val} <span class="text-slate-400 font-normal">(${Math.round((val / total) * 100)}%)</span></span>
        </div>
        <div class="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
          <div class="bg-${color}-500 h-2 rounded-full" style="width:${Math.round((val / total) * 100)}%"></div>
        </div>
      </div>
    `).join("");

    // Mini bar chart
    const chartEl = document.getElementById("daily-chart");
    const labelsEl = document.getElementById("daily-labels");
    const days = s.daily_signups;
    if (days.length) {
      const maxD = Math.max(...days.map(d => d.count), 1);
      chartEl.innerHTML = days.map(d => `
        <div class="flex-1 flex flex-col items-center justify-end group" title="${d.date}: ${d.count}">
          <div class="w-full bg-blue-500 dark:bg-blue-400 rounded-t opacity-80 group-hover:opacity-100 transition-opacity min-h-[2px]"
            style="height:${Math.max(Math.round((d.count / maxD) * 96), 2)}px"></div>
        </div>
      `).join("");
      labelsEl.innerHTML = `<span>${days[0]?.date?.slice(5) || ""}</span><span>${days[days.length - 1]?.date?.slice(5) || ""}</span>`;
    } else {
      chartEl.innerHTML = `<p class="text-slate-400 text-sm w-full text-center">Sin registros en los últimos 30 días</p>`;
    }
  } catch (e) {
    console.error("Error cargando stats:", e);
  }
}

// ── Usuarios ─────────────────────────────────────────────────────────────────

let _usersDebounce;
function debouncedLoadUsers() {
  clearTimeout(_usersDebounce);
  _usersDebounce = setTimeout(loadUsers, 300);
}

async function loadUsers() {
  const search = document.getElementById("user-search")?.value?.trim() || "";
  const tbody = document.getElementById("users-table-body");
  tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400 text-sm">Cargando…</td></tr>`;
  try {
    const url = search ? `/api/admin/users?search=${encodeURIComponent(search)}` : "/api/admin/users";
    const users = await apiFetch(url);
    document.getElementById("users-count").textContent = `${users.length} usuario${users.length !== 1 ? "s" : ""}`;
    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400 text-sm">Sin resultados</td></tr>`;
      return;
    }
    tbody.innerHTML = users.map(u => `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
        <td class="px-4 py-3">
          <div class="font-medium text-slate-900 dark:text-white text-sm">${escHtml(u.name)}</div>
          <div class="text-xs text-slate-400">${escHtml(u.email)}</div>
        </td>
        <td class="px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400 hidden md:table-cell">
          ${u.created_at ? new Date(u.created_at).toLocaleDateString("es-AR") : "—"}
        </td>
        <td class="px-4 py-3 text-center text-xs text-slate-600 dark:text-slate-300 hidden md:table-cell">
          ${u.tx_count}
        </td>
        <td class="px-4 py-3 text-center hidden md:table-cell">
          <div class="flex items-center justify-center gap-1.5 flex-wrap">
            ${u.totp_enabled ? `<span class="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs rounded font-medium">2FA</span>` : ""}
            ${u.has_google ? `<span class="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded font-medium">G</span>` : ""}
            ${u.is_admin ? `<span class="px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-xs rounded font-medium">Admin</span>` : ""}
          </div>
        </td>
        <td class="px-4 py-3 text-center">
          <span class="px-2 py-1 rounded-full text-xs font-medium ${u.is_active ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"}">
            ${u.is_active ? "Activo" : "Inactivo"}
          </span>
        </td>
        <td class="px-4 py-3 text-center">
          <div class="flex items-center justify-center gap-1">
            <button onclick="toggleActive(${u.id})" title="${u.is_active ? "Desactivar" : "Activar"}"
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-xs">
              ${u.is_active ? "🚫" : "✅"}
            </button>
            <button onclick="toggleAdmin(${u.id})" title="${u.is_admin ? "Quitar admin" : "Hacer admin"}"
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-xs">
              ${u.is_admin ? "👤" : "🛡️"}
            </button>
          </div>
        </td>
      </tr>
    `).join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-red-400 text-sm">Error: ${escHtml(e.message)}</td></tr>`;
  }
}

async function toggleActive(userId) {
  try {
    await apiFetch(`/api/admin/users/${userId}/toggle-active`, { method: "PATCH" });
    loadUsers();
  } catch (e) {
    alert("Error: " + e.message);
  }
}

async function toggleAdmin(userId) {
  if (!confirm("¿Confirmar cambio de rol de administrador?")) return;
  try {
    await apiFetch(`/api/admin/users/${userId}/toggle-admin`, { method: "PATCH" });
    loadUsers();
  } catch (e) {
    alert("Error: " + e.message);
  }
}

// ── Feedback ──────────────────────────────────────────────────────────────────

async function loadFeedback() {
  try {
    const data = await apiFetch("/api/admin/feedback");
    document.getElementById("avg-rating").textContent = data.average_rating.toFixed(1);
    document.getElementById("total-feedback").textContent = data.total;
    const stars = Math.round(data.average_rating);
    document.getElementById("avg-stars").textContent = "⭐".repeat(stars) + "☆".repeat(5 - stars);

    const listEl = document.getElementById("feedback-list");
    if (!data.items.length) {
      listEl.innerHTML = `<p class="text-slate-400 text-sm text-center py-8">Sin feedback todavía</p>`;
      return;
    }
    const RATING_COLORS = { 1: "red", 2: "orange", 3: "amber", 4: "blue", 5: "emerald" };
    listEl.innerHTML = data.items.map(f => `
      <div class="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-medium text-slate-900 dark:text-white">${escHtml(f.user_name)}</span>
              <span class="text-xs text-slate-400">${escHtml(f.user_email)}</span>
              ${f.tema ? `<span class="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs rounded">${escHtml(f.tema)}</span>` : ""}
            </div>
            ${f.mensaje ? `<p class="text-sm text-slate-600 dark:text-slate-300 mt-1">${escHtml(f.mensaje)}</p>` : ""}
          </div>
          <div class="flex-shrink-0 flex flex-col items-end gap-1">
            <span class="text-lg font-bold text-${RATING_COLORS[f.rating] || "slate"}-500">${f.rating}/5</span>
            <span class="text-xs text-slate-400">${f.created_at ? new Date(f.created_at).toLocaleDateString("es-AR") : ""}</span>
          </div>
        </div>
      </div>
    `).join("");
  } catch (e) {
    document.getElementById("feedback-list").innerHTML = `<p class="text-red-400 text-sm">Error: ${escHtml(e.message)}</p>`;
  }
}

// ── Push broadcast ────────────────────────────────────────────────────────────

const PUSH_TEMPLATES = [
  // Recordatorios diarios
  { group: "Recordatorios", label: "Cargá los movimientos de hoy",       title: "¿Ya registraste tus gastos?",         body: "Tomá 2 minutos para anotar los movimientos del día y mantener tus finanzas al día 💰",                    url: "/transactions.html" },
  { group: "Recordatorios", label: "Revisá tu presupuesto del mes",       title: "¿Cómo va tu presupuesto?",            body: "Revisá cuánto gastaste este mes y si estás dentro de tus límites 📊",                                    url: "/budgets.html" },
  { group: "Recordatorios", label: "Actualizá tus inversiones",           title: "Actualizá tu portfolio",              body: "¿Compraste o vendiste activos? Mantené tu portfolio actualizado en FinanzasApp 📈",                      url: "/inversiones.html" },
  { group: "Recordatorios", label: "Revisá tus servicios próximos a vencer", title: "Servicios por vencer",             body: "Hay servicios próximos a su fecha de vencimiento. Revisalos para no perder ninguno ⚡",                  url: "/servicios.html" },
  { group: "Recordatorios", label: "Cierre de tarjeta de crédito",        title: "Se acerca el cierre de tu tarjeta",   body: "Revisá los gastos del mes en tu tarjeta antes de que cierren 💳",                                       url: "/cards.html" },

  // Motivacionales
  { group: "Motivación",    label: "Felicitaciones por el mes",           title: "¡Buen trabajo este mes! 🎉",          body: "Seguiste registrando tus finanzas. Eso es lo que hace la diferencia a fin de año 💪",                      url: "/dashboard.html" },
  { group: "Motivación",    label: "Ahorrar aunque sea poco",             title: "Cada peso cuenta",                    body: "No importa el monto, lo importante es el hábito. ¿Pudiste ahorrar algo hoy? 🏦",                         url: "/goals.html" },
  { group: "Motivación",    label: "Revisá tu meta de ahorro",            title: "¿Cómo va tu meta de ahorro?",         body: "Chequeá cuánto te falta para llegar a tu objetivo. ¡Cada contribución suma! 🎯",                         url: "/goals.html" },
  { group: "Motivación",    label: "Fin de semana de revisión financiera", title: "Buen momento para revisar",           body: "Aprovechá el fin de semana para poner al día tus finanzas y arrancar la semana tranquilo 🗂️",             url: "/dashboard.html" },

  // Fin de mes / cierre
  { group: "Cierre de mes", label: "Resumen de fin de mes",               title: "¿Cómo cerró el mes?",                 body: "Entrá al dashboard y revisá tu balance mensual. ¿Gastaste de más o te sobró algo? 📅",                    url: "/dashboard.html" },
  { group: "Cierre de mes", label: "Exportá tu reporte mensual",          title: "Descargá tu reporte del mes",         body: "Podés exportar todos tus movimientos en CSV desde la sección de Reportes 📄",                            url: "/reports.html" },
  { group: "Cierre de mes", label: "Actualizá los presupuestos del mes",  title: "Nuevo mes, nuevos presupuestos",       body: "¿Ya configuraste tus límites de gasto para este mes? Hacelo en Presupuestos 👛",                        url: "/budgets.html" },

  // Promos y beneficios
  { group: "Beneficios",    label: "Revisá las promos bancarias",         title: "Hay promos disponibles 🏷️",           body: "Entrá a la sección de Promos y fijate los beneficios que tenés disponibles esta semana",                  url: "/promociones.html" },
  { group: "Beneficios",    label: "Días con descuento especial",         title: "Día de descuentos",                   body: "Hoy hay promociones bancarias activas. Revisalas antes de salir a comprar 💡",                            url: "/promociones.html" },

  // Novedades de la app
  { group: "Novedades",     label: "Nueva funcionalidad disponible",      title: "Novedad en FinanzasApp ✨",            body: "Actualizamos la app con mejoras. Explorá las novedades y contanos qué te parece",                          url: "/dashboard.html" },
  { group: "Novedades",     label: "Dejanos tu feedback",                 title: "Tu opinión nos importa",              body: "¿Cómo estás usando FinanzasApp? Dejanos tu valoración en la sección de Feedback 💬",                      url: "/feedback.html" },
];

(function initTemplates() {
  const sel = document.getElementById("push-template");
  if (!sel) return;
  let currentOg = null;
  let lastGroup = "";
  PUSH_TEMPLATES.forEach((t, i) => {
    if (t.group !== lastGroup) {
      currentOg = document.createElement("optgroup");
      currentOg.label = t.group;
      sel.appendChild(currentOg);
      lastGroup = t.group;
    }
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = t.label;
    currentOg.appendChild(opt);
  });
})();

function applyTemplate(idx) {
  if (idx === "") return;
  const t = PUSH_TEMPLATES[parseInt(idx)];
  if (!t) return;
  document.getElementById("push-title").value = t.title;
  document.getElementById("push-body").value  = t.body;
  document.getElementById("push-url").value   = t.url;
}

async function sendBroadcast() {
  const title = document.getElementById("push-title").value.trim();
  const body = document.getElementById("push-body").value.trim();
  const url = document.getElementById("push-url").value.trim() || "/dashboard.html";
  if (!title || !body) { alert("Completá título y mensaje"); return; }

  const btn = document.getElementById("push-btn");
  const resultEl = document.getElementById("push-result");
  btn.disabled = true;
  btn.textContent = "Enviando…";
  resultEl.classList.add("hidden");

  try {
    const res = await apiFetch("/api/admin/push/broadcast", {
      method: "POST",
      body: JSON.stringify({ title, body, url }),
    });
    resultEl.className = "text-sm text-center py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400";
    resultEl.textContent = `✅ Push: ${res.push_sent} enviados · ${res.push_failed} fallidos · In-app: ${res.inapp_sent} usuarios`;
    resultEl.classList.remove("hidden");
    document.getElementById("push-title").value = "";
    document.getElementById("push-body").value = "";
  } catch (e) {
    resultEl.className = "text-sm text-center py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400";
    resultEl.textContent = "Error: " + e.message;
    resultEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="send" class="w-4 h-4"></i>Enviar broadcast';
    if (window.lucide) lucide.createIcons();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
