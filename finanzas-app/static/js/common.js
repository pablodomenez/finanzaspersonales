// ─────────────────────────────────────────────────────────────────────────────
// common.js — Búsqueda global, notificaciones y ayuda (todas las páginas)
// ─────────────────────────────────────────────────────────────────────────────

const _PAGES = [
  { label: "Dashboard",      icon: "layout-dashboard", url: "/dashboard.html" },
  { label: "Transacciones",  icon: "arrow-left-right", url: "/transactions.html" },
  { label: "Presupuestos",   icon: "wallet",           url: "/budgets.html" },
  { label: "Tarjetas",       icon: "credit-card",      url: "/cards.html" },
  { label: "Deudas",         icon: "users",            url: "/debts.html" },
  { label: "Objetivos",      icon: "target",           url: "/goals.html" },
  { label: "Inversiones",    icon: "trending-up",      url: "/inversiones.html" },
  { label: "Servicios",      icon: "zap",              url: "/servicios.html" },
  { label: "Promociones",    icon: "tag",              url: "/promociones.html" },
  { label: "Compartidos",    icon: "users-round",      url: "/compartidos.html" },
  { label: "Reportes",       icon: "bar-chart-2",      url: "/reports.html" },
  { label: "Decisiones",     icon: "sparkles",         url: "/decisiones.html" },
  { label: "Mi Perfil",      icon: "user",             url: "/profile.html" },
];

const _HELP_FAQ = [
  {
    section: "📊 Dashboard",
    items: [
      { q: "¿Qué muestra el dashboard?",
        a: "El resumen financiero mensual: ingresos, gastos, ahorro, saldo, gráficos de evolución y distribución por categoría." },
      { q: "¿Cómo interpreto el Score financiero?",
        a: "El score (0-100) mide tu salud financiera: tasa de ahorro, control de gastos y consistencia en el registro. Un score ≥80 es excelente." },
    ],
  },
  {
    section: "💸 Transacciones",
    items: [
      { q: "¿Cómo registro un ingreso o gasto?",
        a: "Hacé click en '+ Nuevo movimiento' del header. Elegí tipo, categoría, monto y descripción opcional." },
      { q: "¿Puedo editar o eliminar movimientos?",
        a: "Sí. En la sección Transacciones podés editar o eliminar cualquier fila. Los cambios se reflejan en el dashboard y presupuestos." },
    ],
  },
  {
    section: "📋 Presupuestos",
    items: [
      { q: "¿Cómo configuro un presupuesto?",
        a: "En Presupuestos, elegí categoría y límite mensual. El sistema calcula automáticamente cuánto llevás gastado." },
      { q: "¿Qué significan los colores?",
        a: "Verde: <80% usado. Amarillo: 80-99%. Rojo: límite superado. Recibirás alertas en la campanita al llegar al 80%." },
    ],
  },
  {
    section: "🎯 Metas",
    items: [
      { q: "¿Cómo creo una meta?",
        a: "En Objetivos, hacé click en '+ Nueva meta', ingresá nombre, monto objetivo y fecha límite opcional." },
    ],
  },
  {
    section: "💳 Tarjetas",
    items: [
      { q: "¿Cómo funciona el seguimiento de cuotas?",
        a: "Al registrar un gasto con cuotas, el sistema distribuye el monto mes a mes automáticamente." },
    ],
  },
  {
    section: "🔔 Servicios y alertas",
    items: [
      { q: "¿Cómo agrego un servicio recurrente?",
        a: "En Servicios, registrá tus gastos mensuales (streaming, internet, seguros) con su fecha de vencimiento." },
      { q: "¿Cómo funcionan las alertas?",
        a: "La campanita agrupa servicios que vencen en 7 días, presupuestos al 80% y deudas próximas a vencer." },
    ],
  },
  {
    section: "🔍 Búsqueda",
    items: [
      { q: "¿Qué puedo buscar?",
        a: "Podés buscar secciones de la app por nombre y navegar rápidamente. También con Ctrl+K." },
    ],
  },
];

// ── Inject buttons + panels once DOM is ready ─────────────────────────────────
(function initCommonUI() {
  const header = document.querySelector("main > header");
  if (!header) return;

  // Skip if buttons already exist (dashboard.html los tenía hardcoded antes)
  if (document.getElementById("_common-actions")) return;

  // Find the rightmost flex container inside the header
  const flexRow = header.querySelector(".justify-between");
  if (!flexRow) return;

  const rightSide = flexRow.lastElementChild;
  if (!rightSide) return;

  const btnGroup = document.createElement("div");
  btnGroup.id = "_common-actions";
  btnGroup.className = "hidden md:flex items-center gap-2";
  btnGroup.innerHTML = `
    <button id="_search-btn" onclick="openGlobalSearch()" title="Buscar (Ctrl+K)"
      class="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
      <i data-lucide="search" class="w-4 h-4"></i>
    </button>
    <button id="_notif-btn" onclick="toggleGlobalNotif()" title="Notificaciones"
      class="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors relative overflow-visible">
      <i data-lucide="bell" class="w-4 h-4"></i>
      <span id="_notif-dot" class="hidden absolute -top-1.5 -right-1.5 min-w-[1.1rem] h-[1.1rem] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none pointer-events-none"></span>
    </button>
    <button id="_help-btn" onclick="openGlobalHelp()" title="Ayuda"
      class="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
      <i data-lucide="help-circle" class="w-4 h-4"></i>
    </button>`;

  // Wrap the 3 icon buttons + CTA button in a flex row so they sit side by side
  const rightWrapper = document.createElement("div");
  rightWrapper.className = "flex items-center gap-3";
  flexRow.replaceChild(rightWrapper, rightSide);
  rightWrapper.appendChild(btnGroup);
  rightWrapper.appendChild(rightSide);

  // Inject panels at end of body
  const panels = document.createElement("div");
  panels.innerHTML = `
    <!-- Search overlay -->
    <div id="_search-overlay" class="hidden fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-16 px-4" onclick="_closeSearchOnOverlay(event)">
      <div class="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onclick="event.stopPropagation()">
        <div class="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <i data-lucide="search" class="w-5 h-5 text-slate-400 flex-shrink-0"></i>
          <input id="_search-input" type="text" placeholder="Buscar secciones, categorías..."
            class="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-gray-400 focus:outline-none"
            oninput="runGlobalSearch(this.value)" onkeydown="_searchKeyNav(event)">
          <button onclick="closeGlobalSearch()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
        <div id="_search-results" class="max-h-80 overflow-y-auto p-2">
          <p class="text-xs text-slate-400 px-3 py-6 text-center">Escribí para buscar...</p>
        </div>
        <div class="px-4 py-2.5 border-t border-slate-100 dark:border-slate-700 flex items-center gap-4">
          <span class="text-xs text-slate-400"><kbd class="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">Esc</kbd> cerrar</span>
          <span class="text-xs text-slate-400"><kbd class="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">↑↓</kbd> navegar</span>
          <span class="text-xs text-slate-400"><kbd class="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">Enter</kbd> ir</span>
        </div>
      </div>
    </div>

    <!-- Notification panel -->
    <div id="_notif-panel" class="hidden fixed z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-80" style="top:68px;right:16px;">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-slate-900 dark:text-white">Notificaciones</span>
          <span id="_notif-count" class="hidden text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded-full font-semibold"></span>
        </div>
        <button onclick="_markNotifRead()" class="text-xs text-blue-600 dark:text-blue-400 hover:underline">Marcar leídas</button>
      </div>
      <div id="_notif-list" class="max-h-80 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
        <p class="text-xs text-slate-400 text-center py-8">Cargando alertas...</p>
      </div>
    </div>

    <!-- Help overlay -->
    <div id="_help-overlay" class="hidden fixed inset-0 bg-black/30 z-40" onclick="closeGlobalHelp()"></div>
    <div id="_help-panel" class="hidden fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        <div class="flex items-center gap-2.5">
          <i data-lucide="help-circle" class="w-5 h-5 text-blue-500"></i>
          <h2 class="text-base font-semibold text-slate-900 dark:text-white">Guía de uso</h2>
        </div>
        <button onclick="closeGlobalHelp()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto px-4 py-4" id="_faq-container"></div>
    </div>`;
  document.body.appendChild(panels);

  if (window.lucide) lucide.createIcons();

  // Load notification dot async
  _loadNotifDot();
})();

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════════════════════
let _searchIdx = -1;

function openGlobalSearch() {
  const overlay = document.getElementById("_search-overlay");
  if (!overlay) return;
  overlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  if (window.lucide) lucide.createIcons();
  setTimeout(() => {
    const inp = document.getElementById("_search-input");
    if (inp) { inp.value = ""; inp.focus(); }
    document.getElementById("_search-results").innerHTML =
      '<p class="text-xs text-slate-400 px-3 py-6 text-center">Escribí para buscar...</p>';
    _searchIdx = -1;
  }, 30);
}

function closeGlobalSearch() {
  const overlay = document.getElementById("_search-overlay");
  if (overlay) overlay.classList.add("hidden");
  document.body.style.overflow = "";
  _searchIdx = -1;
}

function _closeSearchOnOverlay(e) {
  if (e.target === document.getElementById("_search-overlay")) closeGlobalSearch();
}

function runGlobalSearch(query) {
  const q = query.trim().toLowerCase();
  const container = document.getElementById("_search-results");
  _searchIdx = -1;

  if (q.length < 2) {
    container.innerHTML = '<p class="text-xs text-slate-400 px-3 py-6 text-center">Escribí para buscar...</p>';
    return;
  }

  const results = [];

  // Pages navigation
  _PAGES.forEach(p => {
    if (p.label.toLowerCase().includes(q))
      results.push({ group: "Secciones", icon: p.icon, label: p.label, sub: p.url, url: p.url });
  });

  // Dashboard recent transactions (if available)
  if (window._dashboardData) {
    (window._dashboardData.recent_transactions || []).forEach(t => {
      const desc = (t.description || t.category.name || "").toLowerCase();
      if (desc.includes(q) || (t.category.name || "").toLowerCase().includes(q)) {
        const sign = t.type === "income" ? "+" : "−";
        results.push({
          group: "Transacciones recientes",
          emoji: t.category.icon,
          label: t.description || t.category.name,
          sub: `${t.category.name} · ${sign}${formatCurrency(t.amount)}`,
          url: "/transactions.html",
        });
      }
    });
  }

  if (results.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 px-3 py-6 text-center">Sin resultados para "<strong>${_esc(query)}</strong>"</p>`;
    return;
  }

  const groups = {};
  results.forEach(r => { if (!groups[r.group]) groups[r.group] = []; groups[r.group].push(r); });

  let html = "";
  let idx = 0;
  Object.entries(groups).forEach(([group, items]) => {
    html += `<p class="text-xs font-semibold text-slate-400 dark:text-slate-500 px-3 pt-3 pb-1 uppercase tracking-wider">${group}</p>`;
    items.forEach(item => {
      const iconHtml = item.emoji
        ? `<span class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-base flex-shrink-0">${item.emoji}</span>`
        : `<span class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0"><i data-lucide="${item.icon}" class="w-4 h-4 text-slate-500 dark:text-slate-400"></i></span>`;
      html += `
        <div class="_search-result flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
             data-url="${item.url}" data-idx="${idx}" onclick="_goSearch('${item.url}')">
          ${iconHtml}
          <div class="min-w-0">
            <p class="text-sm font-medium text-slate-800 dark:text-white truncate">${_esc(item.label)}</p>
            <p class="text-xs text-slate-400 truncate">${_esc(item.sub)}</p>
          </div>
        </div>`;
      idx++;
    });
  });
  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

function _goSearch(url) { closeGlobalSearch(); window.location.href = url; }

function _searchKeyNav(e) {
  const items = document.querySelectorAll("._search-result");
  if (!items.length) return;
  if (e.key === "ArrowDown")  { e.preventDefault(); _searchIdx = Math.min(_searchIdx + 1, items.length - 1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); _searchIdx = Math.max(_searchIdx - 1, 0); }
  else if (e.key === "Enter" && _searchIdx >= 0) { _goSearch(items[_searchIdx].dataset.url); return; }
  items.forEach((el, i) => el.classList.toggle("bg-slate-50", i === _searchIdx));
  if (items[_searchIdx]) items[_searchIdx].scrollIntoView({ block: "nearest" });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════
let _notifOpen = false;

function toggleGlobalNotif() { _notifOpen ? _closeNotif() : _openNotif(); }

function _openNotif() {
  _notifOpen = true;
  const panel = document.getElementById("_notif-panel");
  if (panel) { panel.classList.remove("hidden"); _buildNotifs(); }
}

function _closeNotif() {
  _notifOpen = false;
  const panel = document.getElementById("_notif-panel");
  if (panel) panel.classList.add("hidden");
}

async function _loadNotifDot() {
  if (!getToken()) return;
  try {
    const data = await apiFetch("/api/notificaciones/count").catch(() => ({ total: 0 }));
    _updateNotifBadge((data && data.total) || 0);
  } catch (_) {}
}

function _updateNotifBadge(count) {
  const dot = document.getElementById("_notif-dot");
  if (!dot) return;
  if (count > 0) {
    dot.textContent = count > 99 ? "99+" : String(count);
    dot.classList.remove("hidden");
  } else {
    dot.classList.add("hidden");
  }
}

async function _buildNotifs() {
  const list    = document.getElementById("_notif-list");
  const countEl = document.getElementById("_notif-count");
  if (!list) return;
  list.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">Cargando...</p>';

  const now    = Date.now();
  const alerts = [];   // computed alerts (servicios, presupuestos, deudas)
  let dbNotifs = [];   // stored DB notifications (promo, alquiler, servicios background)

  // ── Computed alerts ────────────────────────────────────────────────────────
  try {
    const servicios = await apiFetch("/api/servicios").catch(() => []);
    (servicios || []).forEach(s => {
      if (s.dias_restantes === null || s.dias_restantes === undefined) return;
      const d = s.dias_restantes;
      if (d <= 7)
        alerts.push({
          type: d <= 3 ? "red" : "amber", icon: "calendar",
          title: s.nombre,
          desc: d < 0 ? "Servicio vencido" : d === 0 ? "Vence hoy" : d === 1 ? "Vence mañana" : `Vence en ${d} días`,
          url: "/servicios.html",
        });
    });
  } catch (_) {}

  try {
    const budgets = await apiFetch("/api/budgets").catch(() => []);
    (budgets || []).forEach(b => {
      if (b.percentage >= 100)
        alerts.push({ type: "red",   icon: "wallet", title: `Presupuesto ${b.category.name}`,
          desc: `Límite superado (${b.percentage}% usado)`, url: "/budgets.html" });
      else if (b.percentage >= 80)
        alerts.push({ type: "amber", icon: "wallet", title: `Presupuesto ${b.category.name}`,
          desc: `Cerca del límite (${b.percentage}% usado)`, url: "/budgets.html" });
    });
  } catch (_) {}

  try {
    const debts = await apiFetch("/api/debts").catch(() => []);
    const today = new Date(); today.setHours(0,0,0,0);
    (debts || []).forEach(d => {
      if (d.paid || !d.due_date) return;
      const due  = new Date(d.due_date + "T00:00:00");
      const diff = Math.round((due - today) / 86400000);
      if (diff <= 7)
        alerts.push({
          type: diff <= 0 ? "red" : "amber", icon: "credit-card",
          title: `Deuda con ${d.person_name}`,
          desc: diff < 0 ? `Vencida hace ${Math.abs(diff)} días` : diff === 0 ? "Vence hoy" : `Vence en ${diff} días`,
          url: "/debts.html",
        });
    });
  } catch (_) {}

  // ── DB notifications (unread only) ─────────────────────────────────────────
  try {
    const all = await apiFetch("/api/notificaciones").catch(() => []);
    dbNotifs = (all || []).filter(n => !n.leida);
  } catch (_) {}

  const total = alerts.length + dbNotifs.length;

  if (total === 0) {
    list.innerHTML = `
      <div class="flex flex-col items-center py-8 gap-2 text-slate-400 dark:text-slate-500">
        <i data-lucide="check-circle" class="w-8 h-8 opacity-50"></i>
        <p class="text-xs">Todo al día, sin notificaciones pendientes</p>
      </div>`;
    if (countEl) countEl.classList.add("hidden");
    if (window.lucide) lucide.createIcons();
    return;
  }

  if (countEl) { countEl.textContent = total; countEl.classList.remove("hidden"); }

  const colorMap = {
    red:    { bg: "bg-red-100 dark:bg-red-900/30",    text: "text-red-600 dark:text-red-400" },
    amber:  { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400" },
    blue:   { bg: "bg-blue-100 dark:bg-blue-900/30",   text: "text-blue-600 dark:text-blue-400" },
    orange: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-600 dark:text-orange-400" },
  };

  let html = "";

  // DB notifications section
  if (dbNotifs.length > 0) {
    html += `<p class="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-4 pt-3 pb-1">Del sistema</p>`;
    html += dbNotifs.map(n => {
      const c = colorMap[n.color] || colorMap.amber;
      return `
        <a href="${_esc(n.url)}" onclick="_markOneRead('${n.tipo}',${n.id}); _closeNotif();"
           class="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer block">
          <div class="w-8 h-8 rounded-full ${c.bg} ${c.text} flex items-center justify-center flex-shrink-0 mt-0.5">
            <i data-lucide="${_esc(n.icon)}" class="w-4 h-4"></i>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <p class="text-sm font-medium text-slate-800 dark:text-white truncate">${_esc(n.mensaje)}</p>
              <span class="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${_fmtNotifDate(n.created_at)}</p>
          </div>
        </a>`;
    }).join("");
  }

  // Computed alerts section
  if (alerts.length > 0) {
    if (dbNotifs.length > 0)
      html += `<p class="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-4 pt-3 pb-1">Alertas activas</p>`;
    html += alerts.map(a => {
      const c = colorMap[a.type] || colorMap.amber;
      return `
        <a href="${a.url}" onclick="_closeNotif()" class="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer block">
          <div class="w-8 h-8 rounded-full ${c.bg} ${c.text} flex items-center justify-center flex-shrink-0 mt-0.5">
            <i data-lucide="${a.icon}" class="w-4 h-4"></i>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-slate-800 dark:text-white truncate">${_esc(a.title)}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${_esc(a.desc)}</p>
          </div>
        </a>`;
    }).join("");
  }

  list.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

function _fmtNotifDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.round((now - d) / 60000);
    if (diff < 60)   return `Hace ${diff} min`;
    if (diff < 1440) return `Hace ${Math.round(diff / 60)} h`;
    return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
  } catch (_) { return ""; }
}

async function _markOneRead(tipo, id) {
  try {
    await apiFetch(`/api/notificaciones/${tipo}/${id}/leer`, { method: "PATCH" });
    _loadNotifDot();
  } catch (_) {}
}

async function _markNotifRead() {
  try {
    await apiFetch("/api/notificaciones/leer-todas", { method: "PATCH" });
  } catch (_) {}
  _updateNotifBadge(0);
  _buildNotifs();
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELP / FAQ
// ═══════════════════════════════════════════════════════════════════════════════
function openGlobalHelp() {
  const overlay = document.getElementById("_help-overlay");
  const panel   = document.getElementById("_help-panel");
  if (overlay) overlay.classList.remove("hidden");
  if (panel)   panel.classList.remove("hidden");
  _buildFAQ();
  if (window.lucide) lucide.createIcons();
}

function closeGlobalHelp() {
  const overlay = document.getElementById("_help-overlay");
  const panel   = document.getElementById("_help-panel");
  if (overlay) overlay.classList.add("hidden");
  if (panel)   panel.classList.add("hidden");
}

function _buildFAQ() {
  const container = document.getElementById("_faq-container");
  if (!container || container.innerHTML.trim()) return;
  container.innerHTML = _HELP_FAQ.map((section, si) => `
    <div class="mb-4">
      <p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">${section.section}</p>
      <div class="space-y-1">
        ${section.items.map((item, ii) => `
          <div class="rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
            <button onclick="_toggleFAQ('_faq-${si}-${ii}')"
                    class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors gap-3">
              <span class="text-sm font-medium text-slate-800 dark:text-slate-200">${_esc(item.q)}</span>
              <i data-lucide="chevron-down" class="w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200" id="_icon-faq-${si}-${ii}"></i>
            </button>
            <div id="_faq-${si}-${ii}" class="hidden px-4 pb-3">
              <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">${_esc(item.a)}</p>
            </div>
          </div>`).join("")}
      </div>
    </div>`).join("");
  if (window.lucide) lucide.createIcons();
}

function _toggleFAQ(id) {
  const el   = document.getElementById(id);
  const icon = document.getElementById("_icon-" + id);
  if (!el) return;
  const open = !el.classList.contains("hidden");
  el.classList.toggle("hidden", open);
  if (icon) icon.style.transform = open ? "" : "rotate(180deg)";
}

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL KEYBOARD + CLICK OUTSIDE
// ═══════════════════════════════════════════════════════════════════════════════
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeGlobalSearch(); _closeNotif(); closeGlobalHelp(); }
  if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); openGlobalSearch(); }
});

document.addEventListener("click", e => {
  if (!_notifOpen) return;
  const panel = document.getElementById("_notif-panel");
  const btn   = document.getElementById("_notif-btn");
  if (panel && btn && !panel.contains(e.target) && !btn.contains(e.target)) _closeNotif();
});

// ── Utility ───────────────────────────────────────────────────────────────────
function _esc(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
