requireAuth();
initPageCommons();

const ICONS = ["🎯","✈️","🏠","🚗","💍","📱","🎓","🏋️","🌴","💻","🎸","🐶","💎","🏖️","🍕"];
let selectedIcon = "🎯";
const goalMap = {};

// Poblar picker de íconos
const picker = document.getElementById("icon-picker");
ICONS.forEach(ico => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = ico;
  btn.className = "text-2xl p-1.5 rounded-lg border-2 border-transparent hover:border-blue-300 transition " + (ico === selectedIcon ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30" : "");
  btn.addEventListener("click", () => {
    selectedIcon = ico;
    document.getElementById("g-icon").value = ico;
    picker.querySelectorAll("button").forEach(b => b.className = b.className.replace("border-blue-500 bg-blue-50 dark:bg-blue-900/30", "border-transparent"));
    btn.className = btn.className.replace("border-transparent", "border-blue-500 bg-blue-50 dark:bg-blue-900/30");
  });
  picker.appendChild(btn);
});

async function loadGoals() {
  const grid = document.getElementById("goals-grid");
  grid.innerHTML = '<p class="text-gray-400 text-sm col-span-3">Cargando...</p>';
  try {
    const goals = await apiFetch("/api/goals");
    if (goals.length === 0) {
      grid.innerHTML = `
        <div class="col-span-3 text-center py-16 text-slate-400">
          <div class="flex justify-center mb-4 opacity-30">
            <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
          </div>
          <p class="font-medium text-slate-500 dark:text-slate-400">Sin metas todavía</p>
          <p class="text-sm mt-1">Creá tu primera meta de ahorro</p>
        </div>`;
      return;
    }
    goals.forEach(g => { goalMap[g.id] = g; });
    grid.innerHTML = goals.map(g => renderGoalCard(g)).join("");
    staggerFadeIn('#goals-grid > div', 60);
    grid.querySelectorAll('[data-bar-pct]').forEach(bar => {
      animateProgressBar(bar, parseFloat(bar.dataset.barPct));
    });
  } catch (err) {
    grid.innerHTML = `<p class="text-red-400 text-sm col-span-3">${err.message}</p>`;
  }
}

const TRASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>`;
const EDIT_SVG  = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const CAL_SVG   = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`;
const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>`;

function renderGoalCard(g) {
  const pct = g.percentage;
  const barColor = g.completed ? "bg-emerald-500" : pct >= 75 ? "bg-blue-600" : "bg-blue-500";
  const deadlineHtml = g.deadline
    ? `<span class="inline-flex items-center gap-1 text-xs ${g.days_left === 0 ? "text-red-500 font-medium" : "text-slate-400"}">${CAL_SVG}${g.days_left === 0 ? "Vencida" : g.days_left + " días"}</span>`
    : "";
  const monthlyHtml = g.monthly_needed && !g.completed
    ? `<p class="text-xs text-slate-400 mt-1">≈ ${formatCurrency(g.monthly_needed)}/mes para llegar</p>`
    : "";
  const completedBadge = g.completed
    ? `<span class="inline-flex items-center gap-1 text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700 px-2 py-0.5 rounded-full font-medium">${CHECK_SVG}Completada</span>`
    : "";

  return `
    <div class="bg-white dark:bg-slate-900 rounded-lg p-5 border border-slate-200 dark:border-slate-700">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2.5">
          <span class="text-2xl leading-none">${g.icon}</span>
          <div>
            <p class="font-semibold text-slate-800 dark:text-slate-200 text-sm">${g.name}</p>
            ${completedBadge}
          </div>
        </div>
        <button data-action="edit-goal" data-id="${g.id}" class="text-slate-300 hover:text-blue-400 transition p-1 rounded">${EDIT_SVG}</button>
        <button data-action="delete-goal" data-id="${g.id}" class="text-slate-300 hover:text-red-400 transition p-1 rounded">${TRASH_SVG}</button>
      </div>
      <div class="flex justify-between text-sm mb-1.5">
        <span class="font-semibold text-slate-700 dark:text-slate-300">${formatCurrency(g.current_amount)}</span>
        <span class="text-slate-400">de ${formatCurrency(g.target_amount)}</span>
      </div>
      <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-2">
        <div class="h-2 rounded-full ${barColor}" data-bar-pct="${pct}" style="width:0%"></div>
      </div>
      <div class="flex justify-between items-center mb-2">
        <span class="text-xs font-bold text-blue-600 dark:text-blue-400">${pct}%</span>
        ${deadlineHtml}
      </div>
      ${monthlyHtml}
      ${!g.completed ? `<button data-action="contribute" data-id="${g.id}" data-name="${g.name}"
        class="w-full mt-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 font-medium text-sm py-2 rounded-lg border border-blue-200 dark:border-blue-800 transition">
        + Agregar ahorro
      </button>` : ""}
    </div>`;
}

// Event delegation
document.getElementById("goals-grid").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "edit-goal") openEditModal(goalMap[parseInt(btn.dataset.id)]);
  if (btn.dataset.action === "delete-goal") deleteGoal(btn.dataset.id);
  if (btn.dataset.action === "contribute") openContrib(btn.dataset.id, btn.dataset.name);
});

async function deleteGoal(id) {
  if (!confirm("¿Eliminar esta meta?")) return;
  try {
    await apiFetch(`/api/goals/${id}`, { method: "DELETE" });
    loadGoals();
  } catch (err) { alert(err.message); }
}

function openModal() {
  document.getElementById("g-edit-id").value = "";
  document.getElementById("modal-title").textContent = "Nueva meta";
  document.getElementById("modal-submit").textContent = "Crear";
  document.getElementById("g-name").value = "";
  document.getElementById("g-target").value = "";
  document.getElementById("g-deadline").value = "";
  document.getElementById("modal-error").classList.add("hidden");
  setIcon("🎯");
  document.getElementById("modal").classList.remove("hidden");
}

function openEditModal(g) {
  document.getElementById("g-edit-id").value = g.id;
  document.getElementById("modal-title").textContent = "Editar meta";
  document.getElementById("modal-submit").textContent = "Guardar";
  document.getElementById("g-name").value = g.name;
  document.getElementById("g-target").value = g.target_amount;
  document.getElementById("g-deadline").value = g.deadline ? g.deadline.slice(0, 10) : "";
  document.getElementById("modal-error").classList.add("hidden");
  setIcon(g.icon);
  document.getElementById("modal").classList.remove("hidden");
}

function setIcon(ico) {
  selectedIcon = ico;
  document.getElementById("g-icon").value = ico;
  picker.querySelectorAll("button").forEach(b => {
    if (b.textContent === ico) {
      b.className = b.className.replace("border-transparent", "border-blue-500 bg-blue-50 dark:bg-blue-900/30");
    } else {
      b.className = b.className.replace("border-blue-500 bg-blue-50 dark:bg-blue-900/30", "border-transparent");
    }
  });
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

function openContrib(id, name) {
  document.getElementById("contrib-goal-id").value = id;
  document.getElementById("contrib-goal-name").textContent = name;
  document.getElementById("contrib-amount").value = "";
  document.getElementById("contrib-error").classList.add("hidden");
  document.getElementById("contrib-modal").classList.remove("hidden");
}

function closeContrib() {
  document.getElementById("contrib-modal").classList.add("hidden");
}

document.getElementById("goal-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  const errEl = document.getElementById("modal-error");
  errEl.classList.add("hidden");
  const editId = document.getElementById("g-edit-id").value;
  const deadline = document.getElementById("g-deadline").value;
  const body = {
    name: document.getElementById("g-name").value,
    icon: document.getElementById("g-icon").value,
    target_amount: parseFloat(document.getElementById("g-target").value),
    deadline: deadline ? new Date(deadline + "T12:00:00").toISOString() : null,
  };
  try {
    if (editId) {
      await apiFetch(`/api/goals/${editId}`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      await apiFetch("/api/goals", { method: "POST", body: JSON.stringify(body) });
    }
    closeModal();
    loadGoals();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("contrib-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  const errEl = document.getElementById("contrib-error");
  errEl.classList.add("hidden");
  try {
    await apiFetch(`/api/goals/${document.getElementById("contrib-goal-id").value}/contribute`, {
      method: "POST",
      body: JSON.stringify({ amount: parseFloat(document.getElementById("contrib-amount").value) }),
    });
    closeContrib();
    loadGoals();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
});

loadGoals();
