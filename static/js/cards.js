requireAuth();
initPageCommons();

const monthSelect = document.getElementById("month-select");
const yearSelect = document.getElementById("year-select");

const CARD_COLORS = ["#3b82f6","#8b5cf6","#ec4899","#ef4444","#10b981","#f59e0b","#06b6d4","#6366f1"];
const MONTH_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

let allCards = [];

// ─── Color picker ────────────────────────────────────────────────────────────
const colorPicker = document.getElementById("color-picker");
CARD_COLORS.forEach(color => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.style.background = color;
  btn.className = "w-8 h-8 rounded-full border-4 border-transparent hover:scale-110 transition-transform";
  btn.dataset.color = color;
  btn.addEventListener("click", () => {
    document.getElementById("c-color").value = color;
    colorPicker.querySelectorAll("button").forEach(b => b.classList.remove("border-white", "scale-110"));
    btn.classList.add("border-white", "scale-110");
  });
  colorPicker.appendChild(btn);
});
colorPicker.querySelector("button").classList.add("border-white", "scale-110");

// ─── Load data ────────────────────────────────────────────────────────────────
async function loadAll() {
  const month = monthSelect.value;
  const year = yearSelect.value;
  try {
    const data = await apiFetch(`/api/cards/summary?month=${month}&year=${year}`);
    allCards = data.cards;
    renderCards(data);
    renderExpensesTable(data);
  } catch (err) {
    document.getElementById("cards-grid").innerHTML =
      `<p class="text-red-400 text-sm col-span-3">${err.message}</p>`;
  }
}

function renderCards(data) {
  const grid = document.getElementById("cards-grid");
  const banner = document.getElementById("total-banner");
  const empty = document.getElementById("empty-state");

  if (data.cards.length === 0) {
    grid.innerHTML = "";
    banner.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  banner.classList.remove("hidden");
  document.getElementById("grand-total").textContent = formatCurrency(data.total_due);
  document.getElementById("total-period").textContent =
    `${MONTH_FULL[data.month - 1]} ${data.year}`;
  document.getElementById("total-cards-count").textContent =
    `${data.cards.length} tarjeta${data.cards.length !== 1 ? "s" : ""}`;

  grid.innerHTML = data.cards.map(card => renderCardWidget(card)).join("");
}

function renderCardWidget(card) {
  const limitBar = card.credit_limit
    ? `<div class="mt-3">
        <div class="flex justify-between text-xs text-gray-400 mb-1">
          <span>Usado este mes</span>
          <span>${Math.round((card.monthly_total / card.credit_limit) * 100)}% del límite</span>
        </div>
        <div class="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
          <div class="h-1.5 rounded-full transition-all ${usageColor(card.monthly_total, card.credit_limit)}"
            style="width:${Math.min((card.monthly_total / card.credit_limit) * 100, 100)}%"></div>
        </div>
      </div>`
    : "";

  const closingBadge = card.closing_day
    ? `<span class="text-xs bg-white/20 px-2 py-0.5 rounded-full">Cierra día ${card.closing_day}</span>`
    : "";
  const dueBadge = card.due_day
    ? `<span class="text-xs bg-white/20 px-2 py-0.5 rounded-full">Vence día ${card.due_day}</span>`
    : "";

  return `
    <div class="rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <!-- Card visual header -->
      <div class="p-5 text-white relative" style="background: linear-gradient(135deg, ${card.color}, ${darkenColor(card.color)})">
        <div class="flex items-start justify-between mb-8">
          <div>
            <p class="font-bold text-lg leading-tight">${card.name}</p>
            ${card.bank ? `<p class="text-white/70 text-xs mt-0.5">${card.bank}</p>` : ""}
          </div>
          <div class="flex gap-1">
            <button data-action="edit-card" data-id="${card.id}"
              class="text-white/70 hover:text-white transition text-sm p-1">✏️</button>
            <button data-action="delete-card" data-id="${card.id}"
              class="text-white/70 hover:text-white transition text-sm p-1">🗑️</button>
          </div>
        </div>
        <div class="flex items-end justify-between">
          <p class="font-mono text-white/80 tracking-widest text-sm">
            ${card.last_four ? `•••• •••• •••• ${card.last_four}` : "•••• •••• •••• ••••"}
          </p>
          <div class="flex gap-1.5 flex-wrap justify-end">
            ${closingBadge}${dueBadge}
          </div>
        </div>
      </div>
      <!-- Body -->
      <div class="bg-white dark:bg-gray-800 p-5">
        <div class="flex items-center justify-between mb-1">
          <span class="text-sm text-gray-500 dark:text-gray-400">Total este mes</span>
          <span class="font-bold text-xl text-gray-900 dark:text-white">${formatCurrency(card.monthly_total)}</span>
        </div>
        <p class="text-xs text-gray-400 mb-2">
          ${card.expense_count === 0 ? "Sin cuotas activas" : `${card.expense_count} cuota${card.expense_count !== 1 ? "s" : ""} activa${card.expense_count !== 1 ? "s" : ""}`}
          ${card.credit_limit ? ` · Límite: ${formatCurrency(card.credit_limit)}` : ""}
        </p>
        ${limitBar}
        <button data-action="add-expense" data-id="${card.id}"
          class="w-full mt-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium text-sm py-2 rounded-lg transition text-center">
          + Agregar gasto
        </button>
      </div>
    </div>`;
}

function usageColor(used, limit) {
  const pct = (used / limit) * 100;
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-yellow-400";
  return "bg-green-500";
}

function darkenColor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (n >> 16) - 40);
  const g = Math.max(0, ((n >> 8) & 0xff) - 40);
  const b = Math.max(0, (n & 0xff) - 40);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function renderExpensesTable(data) {
  const section = document.getElementById("expenses-section");
  const tbody = document.getElementById("expenses-body");
  const countEl = document.getElementById("expenses-count");

  const allExpenses = data.cards.flatMap(card =>
    card.expenses.map(e => ({ ...e, card_name: card.name, card_color: card.color }))
  );

  if (allExpenses.length === 0) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");
  countEl.textContent = `${allExpenses.length} cuota${allExpenses.length !== 1 ? "s" : ""}`;

  tbody.innerHTML = allExpenses.map(e => {
    const remaining = e.remaining > 0 ? `<span class="text-xs text-gray-400 ml-1">(${e.remaining} restante${e.remaining !== 1 ? "s" : ""})</span>` : "";
    return `
      <tr class="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
        <td class="px-6 py-3 text-gray-800 dark:text-gray-200 font-medium">${e.description}</td>
        <td class="px-6 py-3">
          <span class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${e.card_color}"></span>
            <span class="text-gray-600 dark:text-gray-400 text-sm">${e.card_name}</span>
          </span>
        </td>
        <td class="px-6 py-3 text-center">
          <span class="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold px-2.5 py-1 rounded-full">
            ${e.installment_number}/${e.installments}
          </span>
          ${remaining}
        </td>
        <td class="px-6 py-3 text-right font-semibold text-gray-900 dark:text-white">${formatCurrency(e.installment_amount)}</td>
        <td class="px-6 py-3 text-right text-gray-400 text-sm">${formatCurrency(e.total_amount)}</td>
        <td class="px-4 py-3 text-right">
          <button data-action="delete-expense" data-id="${e.id}"
            class="text-gray-300 hover:text-red-400 transition">✕</button>
        </td>
      </tr>`;
  }).join("");
}

// ─── Event delegation ─────────────────────────────────────────────────────────
document.getElementById("cards-grid").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === "delete-card") {
    if (!confirm("¿Eliminar esta tarjeta? Se borrarán todos sus gastos.")) return;
    try {
      await apiFetch(`/api/cards/${id}`, { method: "DELETE" });
      loadAll();
    } catch (err) { alert(err.message); }
  }
  if (btn.dataset.action === "edit-card") openCardModal(id);
  if (btn.dataset.action === "add-expense") openExpenseModal(id);
});

document.getElementById("expenses-body").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn || btn.dataset.action !== "delete-expense") return;
  if (!confirm("¿Eliminar este gasto?")) return;
  try {
    await apiFetch(`/api/cards/expenses/${btn.dataset.id}`, { method: "DELETE" });
    loadAll();
  } catch (err) { alert(err.message); }
});

// ─── Card modal ───────────────────────────────────────────────────────────────
function openCardModal(editId = null) {
  const form = document.getElementById("card-form");
  document.getElementById("card-modal-error").classList.add("hidden");
  document.getElementById("card-modal-title").textContent = editId ? "Editar tarjeta" : "Nueva tarjeta";
  document.getElementById("edit-card-id").value = editId || "";

  if (editId) {
    const card = allCards.find(c => c.id == editId);
    if (card) {
      document.getElementById("c-name").value = card.name;
      document.getElementById("c-bank").value = card.bank || "";
      document.getElementById("c-last-four").value = card.last_four || "";
      document.getElementById("c-limit").value = card.credit_limit || "";
      document.getElementById("c-closing").value = card.closing_day || "";
      document.getElementById("c-due").value = card.due_day || "";
      selectColor(card.color);
    }
  } else {
    form.reset();
    selectColor("#3b82f6");
  }
  document.getElementById("card-modal").classList.remove("hidden");
}

function closeCardModal() {
  document.getElementById("card-modal").classList.add("hidden");
}

function selectColor(color) {
  document.getElementById("c-color").value = color;
  colorPicker.querySelectorAll("button").forEach(b => {
    b.classList.toggle("border-white", b.dataset.color === color);
    b.classList.toggle("scale-110", b.dataset.color === color);
    b.classList.toggle("border-transparent", b.dataset.color !== color);
  });
}

document.getElementById("card-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  const errEl = document.getElementById("card-modal-error");
  errEl.classList.add("hidden");
  const editId = document.getElementById("edit-card-id").value;
  const payload = {
    name: document.getElementById("c-name").value,
    bank: document.getElementById("c-bank").value,
    last_four: document.getElementById("c-last-four").value,
    credit_limit: document.getElementById("c-limit").value ? parseFloat(document.getElementById("c-limit").value) : null,
    closing_day: document.getElementById("c-closing").value ? parseInt(document.getElementById("c-closing").value) : null,
    due_day: document.getElementById("c-due").value ? parseInt(document.getElementById("c-due").value) : null,
    color: document.getElementById("c-color").value,
  };
  try {
    if (editId) {
      await apiFetch(`/api/cards/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await apiFetch("/api/cards", { method: "POST", body: JSON.stringify(payload) });
    }
    closeCardModal();
    loadAll();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
    btn.disabled = false;
  }
});

// ─── Expense modal ────────────────────────────────────────────────────────────
function populateExpenseCardSelect(preselect = null) {
  const sel = document.getElementById("e-card");
  sel.innerHTML = allCards.length === 0
    ? '<option value="">— Sin tarjetas —</option>'
    : allCards.map(c => `<option value="${c.id}" ${c.id == preselect ? "selected" : ""}>${c.name}${c.last_four ? ` ****${c.last_four}` : ""}</option>`).join("");
}

function openExpenseModal(preselectedCardId = null) {
  document.getElementById("expense-form").reset();
  document.getElementById("expense-modal-error").classList.add("hidden");
  document.getElementById("installment-preview").classList.add("hidden");

  const now = new Date();
  document.getElementById("e-month").value = now.getMonth() + 1;
  const eYear = document.getElementById("e-year");
  eYear.innerHTML = "";
  populateYearSelect(eYear, 1);
  eYear.value = now.getFullYear();

  populateExpenseCardSelect(preselectedCardId);
  document.getElementById("expense-modal").classList.remove("hidden");
}

function closeExpenseModal() {
  document.getElementById("expense-modal").classList.add("hidden");
}

// Preview de cuota
["e-amount", "e-installments"].forEach(id => {
  document.getElementById(id).addEventListener("input", updateInstallmentPreview);
});

function updateInstallmentPreview() {
  const amount = parseFloat(document.getElementById("e-amount").value);
  const inst = parseInt(document.getElementById("e-installments").value);
  const preview = document.getElementById("installment-preview");
  if (amount > 0 && inst > 0) {
    const cuota = amount / inst;
    preview.textContent = inst === 1
      ? `Pago único: ${formatCurrency(cuota)}`
      : `${inst} cuotas de ${formatCurrency(cuota)}`;
    preview.classList.remove("hidden");
  } else {
    preview.classList.add("hidden");
  }
}

document.getElementById("expense-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  const errEl = document.getElementById("expense-modal-error");
  errEl.classList.add("hidden");
  try {
    await apiFetch("/api/cards/expenses", {
      method: "POST",
      body: JSON.stringify({
        card_id: parseInt(document.getElementById("e-card").value),
        description: document.getElementById("e-desc").value,
        total_amount: parseFloat(document.getElementById("e-amount").value),
        installments: parseInt(document.getElementById("e-installments").value),
        first_payment_month: parseInt(document.getElementById("e-month").value),
        first_payment_year: parseInt(document.getElementById("e-year").value),
      }),
    });
    closeExpenseModal();
    loadAll();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
    btn.disabled = false;
  }
});

// ─── Filters ──────────────────────────────────────────────────────────────────
monthSelect.addEventListener("change", loadAll);
yearSelect.addEventListener("change", loadAll);

loadAll();
