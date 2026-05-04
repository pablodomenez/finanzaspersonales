// Inyecta el sidebar en <aside id="sidebar"> y marca la página activa
(function () {
  const page = window.location.pathname.split("/").pop().replace(".html", "");
  const nav = [
    { id: "dashboard",    icon: "layout-dashboard",  label: "Dashboard" },
    { id: "transactions", icon: "arrow-left-right",   label: "Movimientos" },
    { id: "budgets",      icon: "wallet",             label: "Presupuestos" },
    { id: "cards",        icon: "credit-card",        label: "Tarjetas" },
    { id: "debts",        icon: "users",              label: "Deudas" },
    { id: "goals",        icon: "target",             label: "Objetivos" },
    { id: "inversiones",  icon: "trending-up",        label: "Inversiones" },
    { id: "servicios",    icon: "zap",                label: "Servicios", badge: true },
    { id: "promociones",  icon: "tag",                label: "Promociones", badge: "promo" },
    { id: "compartidos",  icon: "users-round",        label: "Compartidos" },
    { id: "reports",      icon: "bar-chart-2",        label: "Reportes" },
    { id: "decisiones",   icon: "sparkles",           label: "Decisiones" },
  ];

  const links = nav.map(({ id, icon, label, badge }) => {
    const active = page === id;
    const cls = active
      ? "flex items-center gap-3 px-3 py-2 rounded-md bg-blue-600 text-white font-medium text-sm"
      : "flex items-center gap-3 px-3 py-2 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100 font-medium text-sm transition-colors";
    let badgeHtml = "";
    if (badge === true) {
      badgeHtml = `<span id="notif-badge" class="hidden ml-auto bg-red-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1 leading-none">0</span>`;
    } else if (badge === "promo") {
      badgeHtml = `<span id="promo-badge" class="hidden ml-auto bg-amber-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1 leading-none">0</span>`;
    }
    return `<a href="/${id}.html" class="${cls}"><i data-lucide="${icon}" class="w-4 h-4 shrink-0"></i>${label}${badgeHtml}</a>`;
  }).join("");

  const profileActive = page === "profile";
  const profileCls = profileActive
    ? "w-full flex items-center gap-3 px-3 py-2 rounded-md bg-blue-600 text-white font-medium text-sm"
    : "w-full flex items-center gap-3 px-3 py-2 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100 font-medium text-sm transition-colors";

  document.getElementById("sidebar").innerHTML = `
    <div class="px-5 py-5 border-b border-slate-700">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style="background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); box-shadow: 0 2px 8px rgba(14,165,233,0.4);">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="11" width="4" height="6" rx="1.2" fill="white" opacity="0.6"/>
            <rect x="7" y="6.5" width="4" height="10.5" rx="1.2" fill="white" opacity="0.8"/>
            <rect x="13" y="2" width="4" height="15" rx="1.2" fill="white"/>
          </svg>
        </div>
        <div>
          <span class="font-bold text-white text-sm tracking-tight leading-tight block">Finanzas Personales</span>
          <span class="text-xs text-slate-400 leading-tight block">by PabloFinance</span>
        </div>
      </div>
      <p id="user-greeting" class="text-xs text-slate-500 mt-2 truncate"></p>
    </div>
    <nav class="flex-1 px-3 py-4 space-y-0.5">${links}</nav>
    <div class="px-3 py-4 border-t border-slate-700 space-y-0.5">
      <button id="theme-toggle" class="w-full flex items-center gap-3 px-3 py-2 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100 text-sm font-medium transition-colors">
        <i data-lucide="moon" class="w-4 h-4 shrink-0"></i>Cambiar tema
      </button>
      <a href="/profile.html" class="${profileCls}" id="sidebar-profile-link">
        <span id="sidebar-profile-icon" class="w-4 h-4 shrink-0 flex items-center justify-center leading-none"><i data-lucide="user" class="w-4 h-4"></i></span>Mi Perfil
      </a>
      <button onclick="logout()" class="w-full flex items-center gap-3 px-3 py-2 rounded-md text-red-400 hover:bg-red-900/30 hover:text-red-300 text-sm font-medium transition-colors">
        <i data-lucide="log-out" class="w-4 h-4 shrink-0"></i>Cerrar sesión
      </button>
    </div>`;

  if (window.lucide) lucide.createIcons();

  // Auto-cierre al navegar en mobile (los links se inyectan aquí, por eso va dentro del IIFE)
  document.querySelectorAll('#sidebar a').forEach(function(link) {
    link.addEventListener('click', function() {
      if (window.innerWidth < 768) closeSidebar();
    });
  });

  // Carga badges de notificaciones y dispara chequeos (async, no bloquea el render)
  if (typeof apiFetch === "function" && typeof getToken === "function" && getToken()) {
    (async () => {
      try {
        await apiFetch("/api/servicios/check-vencimientos", { method: "POST" });
      } catch (_) {}
      try {
        await apiFetch("/api/promociones/check-vencimientos", { method: "POST" });
      } catch (_) {}
      try {
        const notifs = await apiFetch("/api/servicios/notificaciones");
        const unread = notifs.filter((n) => !n.leida).length;
        const badge = document.getElementById("notif-badge");
        if (badge && unread > 0) {
          badge.textContent = unread > 9 ? "9+" : String(unread);
          badge.classList.remove("hidden");
        }
      } catch (_) {}
      try {
        const promoNotifs = await apiFetch("/api/promociones/notificaciones");
        const unread = promoNotifs.filter((n) => !n.leida).length;
        const badge = document.getElementById("promo-badge");
        if (badge && unread > 0) {
          badge.textContent = unread > 9 ? "9+" : String(unread);
          badge.classList.remove("hidden");
        }
      } catch (_) {}
      try {
        const profile = await apiFetch("/api/profile");
        const iconEl = document.getElementById("sidebar-profile-icon");
        if (iconEl) {
          if (profile.google_picture) {
            iconEl.innerHTML = `<img src="${profile.google_picture}" class="w-5 h-5 rounded-full object-cover shrink-0" alt="foto">`;
          } else if (profile.avatar_emoji && profile.avatar_emoji !== "👤") {
            iconEl.textContent = profile.avatar_emoji;
            iconEl.className = "shrink-0 text-base leading-none flex items-center justify-center";
          }
        }
      } catch (_) {}
    })();
  }
})();

function openSidebar() {
  document.getElementById('sidebar').classList.remove('-translate-x-full');
  document.getElementById('sidebar-overlay').classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.add('-translate-x-full');
  document.getElementById('sidebar-overlay').classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}
