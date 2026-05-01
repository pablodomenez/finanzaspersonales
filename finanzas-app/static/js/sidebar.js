// Inyecta el sidebar en <aside id="sidebar"> y marca la página activa
(function () {
  const page = window.location.pathname.split("/").pop().replace(".html", "");
  const nav = [
    { id: "dashboard",    icon: "📊", label: "Dashboard" },
    { id: "transactions", icon: "💳", label: "Transacciones" },
    { id: "budgets",      icon: "🎯", label: "Presupuestos" },
    { id: "goals",        icon: "⭐", label: "Metas" },
    { id: "debts",        icon: "🤝", label: "Deudas" },
    { id: "cards",        icon: "💳", label: "Tarjetas" },
    { id: "reports",      icon: "📈", label: "Reportes" },
  ];

  const links = nav.map(({ id, icon, label }) => {
    const active = page === id;
    const cls = active
      ? "flex items-center gap-3 px-3 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium text-sm"
      : "flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium text-sm transition";
    return `<a href="/${id}.html" class="${cls}">${icon} ${label}</a>`;
  }).join("");

  document.getElementById("sidebar").innerHTML = `
    <div class="p-6 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-2">
        <span class="text-2xl">💰</span>
        <span class="font-bold text-gray-900 dark:text-white text-lg">FinanzasApp</span>
      </div>
      <p id="user-greeting" class="text-xs text-gray-500 dark:text-gray-400 mt-1"></p>
    </div>
    <nav class="flex-1 p-4 space-y-1">${links}</nav>
    <div class="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
      <button id="theme-toggle" class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition">
        🌙 Cambiar tema
      </button>
      <a href="/profile.html" class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition ${page === 'profile' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : ''}">
        👤 Mi Perfil
      </a>
      <button onclick="logout()" class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm transition">
        🚪 Salir
      </button>
    </div>`;
})();
