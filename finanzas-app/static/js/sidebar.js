// Inyecta el sidebar en <aside id="sidebar"> y marca la página activa
(function () {
  const page = window.location.pathname.split("/").pop().replace(".html", "");
  const nav = [
    { id: "dashboard",    icon: "layout-dashboard",  label: "Dashboard" },
    { id: "transactions", icon: "arrow-left-right",   label: "Transacciones" },
    { id: "budgets",      icon: "wallet",             label: "Presupuestos" },
    { id: "goals",        icon: "target",             label: "Metas" },
    { id: "debts",        icon: "users",              label: "Deudas" },
    { id: "cards",        icon: "credit-card",        label: "Tarjetas" },
    { id: "reports",      icon: "bar-chart-2",        label: "Reportes" },
  ];

  const links = nav.map(({ id, icon, label }) => {
    const active = page === id;
    const cls = active
      ? "flex items-center gap-3 px-3 py-2 rounded-md bg-blue-600 text-white font-medium text-sm"
      : "flex items-center gap-3 px-3 py-2 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100 font-medium text-sm transition-colors";
    return `<a href="/${id}.html" class="${cls}"><i data-lucide="${icon}" class="w-4 h-4 shrink-0"></i>${label}</a>`;
  }).join("");

  const profileActive = page === "profile";
  const profileCls = profileActive
    ? "w-full flex items-center gap-3 px-3 py-2 rounded-md bg-blue-600 text-white font-medium text-sm"
    : "w-full flex items-center gap-3 px-3 py-2 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100 font-medium text-sm transition-colors";

  document.getElementById("sidebar").innerHTML = `
    <div class="px-5 py-5 border-b border-slate-700">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <span class="text-white font-bold text-sm">F</span>
        </div>
        <span class="font-bold text-white text-base tracking-tight">FinanzasApp</span>
      </div>
      <p id="user-greeting" class="text-xs text-slate-500 mt-2 truncate"></p>
    </div>
    <nav class="flex-1 px-3 py-4 space-y-0.5">${links}</nav>
    <div class="px-3 py-4 border-t border-slate-700 space-y-0.5">
      <button id="theme-toggle" class="w-full flex items-center gap-3 px-3 py-2 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100 text-sm font-medium transition-colors">
        <i data-lucide="moon" class="w-4 h-4 shrink-0"></i>Cambiar tema
      </button>
      <a href="/profile.html" class="${profileCls}">
        <i data-lucide="user" class="w-4 h-4 shrink-0"></i>Mi Perfil
      </a>
      <button onclick="logout()" class="w-full flex items-center gap-3 px-3 py-2 rounded-md text-red-400 hover:bg-red-900/30 hover:text-red-300 text-sm font-medium transition-colors">
        <i data-lucide="log-out" class="w-4 h-4 shrink-0"></i>Cerrar sesión
      </button>
    </div>`;

  if (window.lucide) lucide.createIcons();
})();
