let selectedRating = 0;

const RATING_LABELS = ["", "Muy mala 😞", "Mala 😕", "Regular 😐", "Buena 😊", "¡Excelente! 🌟"];

function setRating(value) {
  selectedRating = value;
  const stars = document.querySelectorAll(".star-btn");
  stars.forEach((btn, i) => {
    btn.textContent = i < value ? "★" : "☆";
    btn.style.color = i < value ? "#f59e0b" : "";
  });
  const label = document.getElementById("rating-label");
  if (label) label.textContent = RATING_LABELS[value] || "";
}

function resetForm() {
  selectedRating = 0;
  document.querySelectorAll(".star-btn").forEach((btn) => {
    btn.textContent = "☆";
    btn.style.color = "";
  });
  const label = document.getElementById("rating-label");
  if (label) label.textContent = "";
  const tema = document.getElementById("fb-tema");
  if (tema) tema.value = "General";
  const msg = document.getElementById("fb-mensaje");
  if (msg) msg.value = "";
}

async function submitFeedback() {
  const errorEl = document.getElementById("fb-error");
  const successEl = document.getElementById("fb-success");
  const submitBtn = document.getElementById("fb-submit");

  errorEl.classList.add("hidden");
  successEl.classList.add("hidden");

  if (!selectedRating) {
    errorEl.textContent = "Por favor seleccioná una calificación antes de enviar.";
    errorEl.classList.remove("hidden");
    return;
  }

  const payload = {
    rating: selectedRating,
    tema: document.getElementById("fb-tema").value,
    mensaje: document.getElementById("fb-mensaje").value.trim() || null,
  };

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg> Enviando...';

  try {
    await apiFetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    successEl.classList.remove("hidden");
    resetForm();
    await loadHistory();
  } catch (err) {
    errorEl.textContent = "Hubo un error al enviar. Intentá de nuevo.";
    errorEl.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i data-lucide="send" class="w-4 h-4"></i> Enviar feedback';
    if (window.lucide) lucide.createIcons();
  }
}

function relativeDate(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semana${Math.floor(diffDays / 7) > 1 ? "s" : ""}`;
  return date.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

function starsHtml(rating) {
  return Array.from({ length: 5 }, (_, i) =>
    `<span style="color:${i < rating ? "#f59e0b" : "#cbd5e1"}">${i < rating ? "★" : "☆"}</span>`
  ).join("");
}

async function loadHistory() {
  const container = document.getElementById("history-list");
  try {
    const items = await apiFetch("/api/feedback/me");
    if (!items || items.length === 0) {
      container.innerHTML = `
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <div class="text-4xl mb-3">💬</div>
          <p class="text-slate-500 dark:text-slate-400 text-sm">Aún no enviaste ningún feedback.</p>
          <p class="text-slate-400 dark:text-slate-500 text-xs mt-1">¡Tu primera opinión nos ayudará a mejorar!</p>
        </div>`;
      return;
    }
    container.innerHTML = items.map((fb) => `
      <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex gap-4 items-start">
        <div class="shrink-0 text-xl">${starsHtml(fb.rating)}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap mb-1">
            <span class="text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">${fb.tema || "General"}</span>
            <span class="text-xs text-slate-400">${relativeDate(fb.created_at)}</span>
          </div>
          ${fb.mensaje
            ? `<p class="text-sm text-slate-700 dark:text-slate-300 line-clamp-3">${fb.mensaje}</p>`
            : `<p class="text-xs text-slate-400 italic">Sin mensaje adicional</p>`}
        </div>
      </div>`
    ).join("");
  } catch (_) {
    container.innerHTML = `<p class="text-sm text-slate-400">No se pudo cargar el historial.</p>`;
  }
}

(async function init() {
  if (window.lucide) lucide.createIcons();
  await loadHistory();
  if (window.lucide) lucide.createIcons();
})();
