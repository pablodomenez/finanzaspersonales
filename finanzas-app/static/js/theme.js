// Aplicar tema antes del render para evitar flash
(function () {
  const theme = localStorage.getItem("theme") || "light";
  document.documentElement.classList.toggle("dark", theme === "dark");
})();

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  _updateThemeBtn(isDark);
}

function _updateThemeBtn(isDark) {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  const icon = btn.querySelector("i[data-lucide]");
  if (icon) {
    icon.setAttribute("data-lucide", isDark ? "sun" : "moon");
    if (window.lucide) lucide.createIcons({ nodes: [icon] });
  } else {
    btn.textContent = isDark ? "☀️" : "🌙";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("theme-toggle");
  if (btn) {
    _updateThemeBtn(document.documentElement.classList.contains("dark"));
    btn.addEventListener("click", toggleTheme);
  }
});
