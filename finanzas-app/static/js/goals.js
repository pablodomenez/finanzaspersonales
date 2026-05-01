requireAuth();
initPageCommons();

const ICONS = ["🎯","✈️","🏠","🚗","💍","📱","🎓","🏋️","🌴","💻","🎸","🐶","💎","🏖️","🍕"];
let selectedIcon = "🎯";

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
        <div class="col-span-3 text-center py-16 text-gray-400">
          <p class="text-5xl mb-3">⭐</p>
          <p class="font-medium">Sin metas todavía</p>
          <p class="text-sm mt-1">Creá tu primera meta de ahorro</p>
        </div>`;
      return;
    }
    grid.innerHTML = goals.map(g => renderGoalCard(g)).join("");
  } catch (err) {
    grid.innerHTML = `<p class="text-red-400 text-sm col-span-3">${err.message}</p>`;
  }
}

function renderGoalCard(g) {
  const pct = g.percentage;
  const barColor = g.completed ? "bg-green-500" : pct >= 75 ? "bg-blue-500" : "bg-blue-400";
  const deadlineHtml = g.deadline
    ? `<span class="text-xs ${g.days_left === 0 ? "text-red-500" : "text-gray-400"}">📅 ${g.days_left === 0 ? "Vencida" : g.days_left + " días"}</span>`
    : "";
  const monthlyHtml = g.monthly_needed && !g.completed
    ? `<p class="text-xs text-gray-400 mt-1">≈ ${formatCurrency(g.monthly_needed)}/mes para llegar</p>`
    : "";
  const completedBadge = g.completed ? '<span class="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">✅ Completada</span>' : "";

  return `
    <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="text-3xl">${g.icon}</span>
          <div>
            <p class="font-semibold text-gray-800 dark:text-gray-200 text-sm">${g.name}</p>
            ${completedBadge}
          </div>
        </div>
        <button data-action="delete-goal" data-id="${g.id}" class="text-gray-300 hover:text-red-400 transition text-lg leading-none">✕</button>
      </div>
      <div class="flex justify-between text-sm mb-1.5">
        <span class="font-medium text-gray-700 dark:text-gray-300">${formatCurrency(g.current_amount)}</span>
        <span class="text-gray-400">de ${formatCurrency(g.target_amount)}</span>
      </div>
      <div class="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 mb-2">
        <div class="h-3 rounded-full transition-all ${barColor}" style="width: ${pct}%"></div>
      </div>
      <div class="flex justify-between items-center mb-3">
        <span class="text-xs font-semibold text-blue-600 dark:text-blue-400">${pct}%</span>
        ${deadlineHtml}
      </div>
      ${monthlyHtml}
      ${!g.completed ? `<button data-action="contribute" data-id="${g.id}" data-name="${g.name}"
        class="w-full mt-3 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-medium text-sm py-2 rounded-lg transition">
        + Agregar ahorro
      </button>` : ""}
    </div>`;
}

// Event delegation
document.getElementById("goals-grid").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
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
  document.getElementById("g-name").value = "";
  document.getElementById("g-target").value = "";
  document.getElementById("g-deadline").value = "";
  document.getElementById("modal-error").classList.add("hidden");
  document.getElementById("modal").classList.remove("hidden");
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
  const deadline = document.getElementById("g-deadline").value;
  try {
    await apiFetch("/api/goals", {
      method: "POST",
      body: JSON.stringify({
        name: document.getElementById("g-name").value,
        icon: document.getElementById("g-icon").value,
        target_amount: parseFloat(document.getElementById("g-target").value),
        deadline: deadline ? new Date(deadline + "T12:00:00").toISOString() : null,
      }),
    });
    closeModal();
    loadGoals();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
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
    btn.disabled = false;
  }
});

loadGoals();
