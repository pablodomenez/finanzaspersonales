// Inyecta el sidebar en <aside id="sidebar"> y marca la página activa
(function () {
  const style = document.createElement("style");
  style.textContent = `
    #sidebar nav::-webkit-scrollbar { width: 4px; }
    #sidebar nav::-webkit-scrollbar-track { background: transparent; }
    #sidebar nav::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
    #sidebar nav::-webkit-scrollbar-thumb:hover { background: #475569; }
    #sidebar nav { scrollbar-width: thin; scrollbar-color: #334155 transparent; }
  `;
  document.head.appendChild(style);
  const page = window.location.pathname.split("/").pop().replace(".html", "");
  const nav = [
    { id: "dashboard",    icon: "layout-dashboard",  label: "Dashboard" },
    { id: "transactions", icon: "arrow-left-right",   label: "Movimientos" },
    { id: "budgets",      icon: "wallet",             label: "Presupuestos" },
    { id: "cards",        icon: "credit-card",        label: "Tarjetas" },
    { id: "debts",        icon: "users",              label: "Deudas" },
    { id: "goals",        icon: "target",             label: "Objetivos" },
    { id: "inversiones",  icon: "trending-up",        label: "Inversiones" },
    { id: "alquileres",   icon: "home",               label: "Alquileres", badge: "alquiler" },
    { id: "servicios",    icon: "zap",                label: "Servicios", badge: true },
    { id: "promociones",  icon: "tag",                label: "Promociones", badge: "promo" },
    { id: "compartidos",  icon: "users-round",        label: "Compartidos" },
    { id: "reports",      icon: "bar-chart-2",        label: "Reportes" },
    { id: "decisiones",   icon: "sparkles",           label: "Decisiones" },
    { id: "feedback",     icon: "message-square-heart", label: "Feedback" },
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
    } else if (badge === "alquiler") {
      badgeHtml = `<span id="alquiler-badge" class="hidden ml-auto bg-orange-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1 leading-none">0</span>`;
    }
    return `<a href="/${id}.html" class="${cls}"><i data-lucide="${icon}" class="w-4 h-4 shrink-0"></i>${label}${badgeHtml}</a>`;
  }).join("");

  const profileActive = page === "profile";
  const profileCls = profileActive
    ? "w-full flex items-center gap-3 px-3 py-2 rounded-md bg-blue-600 text-white font-medium text-sm"
    : "w-full flex items-center gap-3 px-3 py-2 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100 font-medium text-sm transition-colors";

  document.getElementById("sidebar").innerHTML = `
    <div class="px-5 py-5 border-b border-slate-700 relative">
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
          <span class="text-xs text-slate-400 leading-tight">by PabloFinance</span>
        </div>
      </div>
      <div class="flex items-end justify-between mt-2">
        <p id="user-greeting" class="text-xs text-slate-500 truncate flex-1 min-w-0"></p>
        <div class="flex items-center gap-1.5 ml-2 flex-shrink-0">
          <a href="https://www.instagram.com/pablo.finance?igsh=dnZjczJrbHBsbXQ3&utm_source=qr"
             target="_blank" rel="noopener noreferrer" title="Instagram"
             class="text-slate-500 hover:text-slate-300 transition-colors hover:scale-110 inline-flex">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </a>
          <a href="https://youtube.com/@pablofinance?si=RtLPvrukgIbl-Fh2"
             target="_blank" rel="noopener noreferrer" title="YouTube"
             class="text-slate-500 hover:text-slate-300 transition-colors hover:scale-110 inline-flex">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </a>
          <a href="https://www.tiktok.com/@pablo.finance?_r=1&_t=ZS-966bhZgK2PU"
             target="_blank" rel="noopener noreferrer" title="TikTok"
             class="text-slate-500 hover:text-slate-300 transition-colors hover:scale-110 inline-flex">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.74a4.85 4.85 0 01-1.01-.05z"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
    <nav class="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">${links}</nav>
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
        await apiFetch("/api/alquileres/check-alertas", { method: "POST" });
      } catch (_) {}
      try {
        const alqNotifs = await apiFetch("/api/alquileres/notificaciones");
        const unread = alqNotifs.filter((n) => !n.leida).length;
        const badge = document.getElementById("alquiler-badge");
        if (badge && unread > 0) {
          badge.textContent = unread > 9 ? "9+" : String(unread);
          badge.classList.remove("hidden");
        }
      } catch (_) {}
      try {
        const googlePic = localStorage.getItem("google_picture");
        const profile = await apiFetch("/api/profile");
        const iconEl = document.getElementById("sidebar-profile-icon");
        if (iconEl) {
          if (googlePic) {
            iconEl.innerHTML = `<img src="${googlePic}" class="w-5 h-5 rounded-full object-cover shrink-0" alt="foto">`;
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
