requireAuth();
initPageCommons();

const yearSelect = document.getElementById("year-select");
const bYearSelect = document.getElementById("b-year");
populateYearSelect(bYearSelect);

document.getElementById("b-month").value = new Date().getMonth() + 1;

function progressColor(pct) {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 75)  return "bg-yellow-400";
  return "bg-green-500";
}

function progressTextColor(pct) {
  if (pct >= 100) return "text-red-500";
  if (pct >= 75)  return "text-yellow-500";
  return "text-green-600";
}

async function loadCategories() {
  const all = await apiFetch("/api/categories");
  const expense = all.filter(c => c.type === "expense" || c.type === "both");
  document.getElementById("b-category").innerHTML =
    expense.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join("");
}

async function loadBudgets() {
  const month = document.getElementById("month-select").value;
  const year = yearSelect.value;
  const grid = document.getElementById("budgets-grid");
  grid.innerHTML = '<p class="text-gray-400 text-sm col-span-3">Cargando...</p>';

  try {
    const data = await apiFetch(`/api/budgets?month=${month}&year=${year}`);
    if (data.length === 0) {
      grid.innerHTML = `
        <div class="col-span-3 text-center py-12 text-gray-400">
          <p class="text-4xl mb-3">🎯</p>
          <p>No hay presupuestos para este mes.</p>
          <p class="text-sm mt-1">Hacé clic en "+ Nuevo presupuesto" para empezar.</p>
        </div>`;
      return;
    }
    grid.innerHTML = data.map(b => renderBudgetCard(b)).join("");
  } catch (err) {
    grid.innerHTML = `<p class="text-red-400 text-sm col-span-3">${err.message}</p>`;
  }
}

function renderBudgetCard(b) {
  const pct = Math.min(b.percentage, 100);
  const color = progressColor(b.percentage);
  const textColor = progressTextColor(b.percentage);
  const label = b.percentage >= 100
    ? `<span class="text-red-500 font-semibold text-xs">⚠️ Límite superado</span>`
    : `<span class="text-gray-500 dark:text-gray-400 text-xs">${formatCurrency(b.limit_amount - b.spent)} disponible</span>`;
  return `
    <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="text-2xl">${b.category.icon}</span>
          <span class="font-medium text-gray-800 dark:text-gray-200 text-sm">${b.category.name}</span>
        </div>
        <button data-action="delete-budget" data-id="${b.id}" class="text-gray-300 hover:text-red-400 transition text-lg leading-none">✕</button>
      </div>
      <div class="flex justify-between text-sm mb-2">
        <span class="text-gray-600 dark:text-gray-400">${formatCurrency(b.spent)} gastado</span>
        <span class="text-gray-400">de ${formatCurrency(b.limit_amount)}</span>
      </div>
      <div class="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 mb-2">
        <div class="h-2 rounded-full transition-all ${color}" style="width: ${pct}%"></div>
      </div>
      <div class="flex justify-between items-center">
        ${label}
        <span class="text-xs font-semibold ${textColor}">${b.percentage}%</span>
      </div>
    </div>`;
}

// Event delegation para botones de eliminar en las cards
document.getElementById("budgets-grid").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action='delete-budget']");
  if (!btn) return;
  if (!confirm("¿Eliminar este presupuesto?")) return;
  try {
    await apiFetch(`/api/budgets/${btn.dataset.id}`, { method: "DELETE" });
    loadBudgets();
  } catch (err) {
    alert(err.message);
  }
});

function openModal() {
  document.getElementById("b-month").value = document.getElementById("month-select").value;
  document.getElementById("b-year").value = yearSelect.value;
  document.getElementById("b-limit").value = "";
  document.getElementById("modal-error").classList.add("hidden");
  document.getElementById("modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

document.getElementById("budget-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  const errEl = document.getElementById("modal-error");
  errEl.classList.add("hidden");

  try {
    await apiFetch("/api/budgets", {
      method: "POST",
      body: JSON.stringify({
        category_id: parseInt(document.getElementById("b-category").value),
        limit_amount: parseFloat(document.getElementById("b-limit").value),
        month: parseInt(document.getElementById("b-month").value),
        year: parseInt(document.getElementById("b-year").value),
      }),
    });
    closeModal();
    loadBudgets();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
});

["month-select", "year-select"].forEach(id => {
  document.getElementById(id).addEventListener("change", loadBudgets);
});

// Cargar categorías y presupuestos en paralelo
Promise.all([loadCategories(), loadBudgets()]);
