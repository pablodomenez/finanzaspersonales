requireAuth();
initPageCommons();

const monthSelect = document.getElementById("month-select");
const yearSelect = document.getElementById("year-select");

const CARD_COLORS = ["#3b82f6","#8b5cf6","#ec4899","#ef4444","#10b981","#f59e0b","#06b6d4","#6366f1"];
const MONTH_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MONTH_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

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

  grid.innerHTML = data.cards.map(card => renderCardWidget(card, data.month, data.year)).join("");
}

function renderPaymentSection(card) {
  if (card.monthly_total === 0) return "";

  if (!card.payment) {
    return `
      <button data-action="register-payment" data-id="${card.id}" data-total="${card.monthly_total}"
        class="w-full mt-3 flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-medium text-sm py-2 rounded-lg transition border border-emerald-200 dark:border-emerald-800">
        💰 Registrar pago
      </button>`;
  }

  if (card.payment.status === "paid") {
    return `
      <div class="mt-3 flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2 border border-emerald-200 dark:border-emerald-800">
        <span class="text-emerald-700 dark:text-emerald-400 text-xs font-semibold">✓ Pagada</span>
        <span class="text-emerald-600 dark:text-emerald-400 text-xs">${formatCurrency(card.payment.amount_paid)} abonado</span>
        <button data-action="register-payment" data-id="${card.id}" data-total="${card.monthly_total}"
          class="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 ml-1 transition">editar</button>
      </div>`;
  }

  // partial
  return `
    <div class="mt-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 border border-amber-200 dark:border-amber-800">
      <div class="flex items-center justify-between">
        <span class="text-amber-700 dark:text-amber-400 text-xs font-semibold">⚠ Pago parcial</span>
        <button data-action="register-payment" data-id="${card.id}" data-total="${card.monthly_total}"
          class="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 transition">actualizar</button>
      </div>
      <p class="text-amber-600 dark:text-amber-400 text-xs mt-0.5">
        Abonado: ${formatCurrency(card.payment.amount_paid)} · Pendiente: <strong>${formatCurrency(card.payment.pending_balance)}</strong>
      </p>
    </div>`;
}

function renderCardWidget(card, month, year) {
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

  const debitoCount = card.expenses.filter(e => e.expense_type === "debito_automatico").length;
  const cuotaCount = card.expenses.filter(e => e.expense_type !== "debito_automatico").length;
  let expenseLabel = "";
  if (card.expense_count === 0) {
    expenseLabel = "Sin gastos activos";
  } else {
    const parts = [];
    if (cuotaCount > 0) parts.push(`${cuotaCount} cuota${cuotaCount !== 1 ? "s" : ""}`);
    if (debitoCount > 0) parts.push(`${debitoCount} débito${debitoCount !== 1 ? "s" : ""} auto.`);
    expenseLabel = parts.join(" · ");
  }

  return `
    <div class="rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
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
      <div class="bg-white dark:bg-gray-800 p-5">
        <div class="flex items-center justify-between mb-1">
          <span class="text-sm text-gray-500 dark:text-gray-400">Total este mes</span>
          <span class="font-bold text-xl text-gray-900 dark:text-white">${formatCurrency(card.monthly_total)}</span>
        </div>
        <p class="text-xs text-gray-400 mb-2">
          ${expenseLabel}
          ${card.credit_limit ? ` · Límite: ${formatCurrency(card.credit_limit)}` : ""}
        </p>
        ${limitBar}
        ${renderPaymentSection(card)}
        <div class="flex gap-2 mt-4">
          <button data-action="add-expense" data-id="${card.id}"
            class="flex-1 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium text-sm py-2 rounded-lg transition text-center">
            + Gasto
          </button>
          <button data-action="view-history" data-id="${card.id}" data-name="${card.name}"
            class="px-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 text-sm py-2 rounded-lg transition" title="Historial de pagos">
            📋
          </button>
        </div>
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
  countEl.textContent = `${allExpenses.length} gasto${allExpenses.length !== 1 ? "s" : ""}`;

  tbody.innerHTML = allExpenses.map(e => {
    let typeBadge, amountCell, totalCell;

    if (e.expense_type === "debito_automatico") {
      typeBadge = `<span class="inline-flex items-center bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-semibold px-2.5 py-1 rounded-full">
        🔄 Mensual
      </span>`;
      amountCell = `<td class="px-6 py-3 text-right font-semibold text-gray-900 dark:text-white">${formatCurrency(e.installment_amount)}</td>`;
      totalCell = `<td class="px-6 py-3 text-right text-gray-400 text-sm">—</td>`;
    } else {
      const remaining = e.remaining > 0
        ? `<span class="text-xs text-gray-400 ml-1">(${e.remaining} restante${e.remaining !== 1 ? "s" : ""})</span>`
        : "";
      typeBadge = `<span class="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold px-2.5 py-1 rounded-full">
        ${e.installment_number}/${e.installments}
      </span>${remaining}`;
      amountCell = `<td class="px-6 py-3 text-right font-semibold text-gray-900 dark:text-white">${formatCurrency(e.installment_amount)}</td>`;
      totalCell = `<td class="px-6 py-3 text-right text-gray-400 text-sm">${formatCurrency(e.total_amount)}</td>`;
    }

    return `
      <tr class="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
        <td class="px-6 py-3 text-gray-800 dark:text-gray-200 font-medium">${e.description}</td>
        <td class="px-6 py-3">
          <span class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${e.card_color}"></span>
            <span class="text-gray-600 dark:text-gray-400 text-sm">${e.card_name}</span>
          </span>
        </td>
        <td class="px-6 py-3 text-center">${typeBadge}</td>
        ${amountCell}
        ${totalCell}
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
    if (!confirm("¿Eliminar esta tarjeta? Se borrarán todos sus gastos y pagos.")) return;
    try {
      await apiFetch(`/api/cards/${id}`, { method: "DELETE" });
      loadAll();
    } catch (err) { alert(err.message); }
  }
  if (btn.dataset.action === "edit-card") openCardModal(id);
  if (btn.dataset.action === "add-expense") openExpenseModal(id);
  if (btn.dataset.action === "register-payment") {
    const total = parseFloat(btn.dataset.total);
    openPaymentModal(id, total);
  }
  if (btn.dataset.action === "view-history") {
    openHistoryModal(id, btn.dataset.name);
  }
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
  } finally {
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

function setExpenseType(type) {
  document.getElementById("e-type").value = type;
  const installmentsField = document.getElementById("installments-field");
  const endDateSection = document.getElementById("end-date-section");
  const amountLabel = document.getElementById("e-amount-label");
  const preview = document.getElementById("installment-preview");

  const btnCuota = document.getElementById("type-cuota");
  const btnDebito = document.getElementById("type-debito");

  if (type === "debito_automatico") {
    btnDebito.classList.add("bg-purple-700", "text-white");
    btnDebito.classList.remove("bg-white", "dark:bg-slate-800", "text-slate-600", "dark:text-slate-300", "hover:bg-slate-50", "dark:hover:bg-slate-700");
    btnCuota.classList.remove("bg-blue-700", "text-white");
    btnCuota.classList.add("bg-white", "dark:bg-slate-800", "text-slate-600", "dark:text-slate-300", "hover:bg-slate-50", "dark:hover:bg-slate-700");
    installmentsField.classList.add("hidden");
    endDateSection.classList.remove("hidden");
    amountLabel.textContent = "Monto mensual";
    preview.classList.add("hidden");
  } else {
    btnCuota.classList.add("bg-blue-700", "text-white");
    btnCuota.classList.remove("bg-white", "dark:bg-slate-800", "text-slate-600", "dark:text-slate-300", "hover:bg-slate-50", "dark:hover:bg-slate-700");
    btnDebito.classList.remove("bg-purple-700", "text-white");
    btnDebito.classList.add("bg-white", "dark:bg-slate-800", "text-slate-600", "dark:text-slate-300", "hover:bg-slate-50", "dark:hover:bg-slate-700");
    installmentsField.classList.remove("hidden");
    endDateSection.classList.add("hidden");
    amountLabel.textContent = "Monto total";
    updateInstallmentPreview();
  }
}

document.querySelectorAll(".type-btn").forEach(btn => {
  btn.addEventListener("click", () => setExpenseType(btn.dataset.type));
});

function openExpenseModal(preselectedCardId = null) {
  document.getElementById("expense-form").reset();
  document.getElementById("expense-modal-error").classList.add("hidden");

  const now = new Date();
  document.getElementById("e-month").value = now.getMonth() + 1;
  const eYear = document.getElementById("e-year");
  eYear.innerHTML = "";
  populateYearSelect(eYear, 1);
  eYear.value = now.getFullYear();

  const eEndYear = document.getElementById("e-end-year");
  eEndYear.innerHTML = '<option value="">Sin fin</option>';
  for (let y = now.getFullYear(); y <= now.getFullYear() + 5; y++) {
    eEndYear.innerHTML += `<option value="${y}">${y}</option>`;
  }

  setExpenseType("cuota");
  populateExpenseCardSelect(preselectedCardId);
  document.getElementById("expense-modal").classList.remove("hidden");
}

function closeExpenseModal() {
  document.getElementById("expense-modal").classList.add("hidden");
}

["e-amount", "e-installments"].forEach(id => {
  document.getElementById(id).addEventListener("input", updateInstallmentPreview);
});

function updateInstallmentPreview() {
  if (document.getElementById("e-type").value === "debito_automatico") return;
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
  const expenseType = document.getElementById("e-type").value;

  const endMonthVal = document.getElementById("e-end-month").value;
  const endYearVal = document.getElementById("e-end-year").value;

  const payload = {
    card_id: parseInt(document.getElementById("e-card").value),
    description: document.getElementById("e-desc").value,
    total_amount: parseFloat(document.getElementById("e-amount").value),
    expense_type: expenseType,
    installments: expenseType === "debito_automatico" ? 1 : parseInt(document.getElementById("e-installments").value),
    first_payment_month: parseInt(document.getElementById("e-month").value),
    first_payment_year: parseInt(document.getElementById("e-year").value),
    end_month: (expenseType === "debito_automatico" && endMonthVal) ? parseInt(endMonthVal) : null,
    end_year: (expenseType === "debito_automatico" && endYearVal) ? parseInt(endYearVal) : null,
  };

  try {
    await apiFetch("/api/cards/expenses", { method: "POST", body: JSON.stringify(payload) });
    closeExpenseModal();
    loadAll();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
});

// ─── Payment modal ────────────────────────────────────────────────────────────
function openPaymentModal(cardId, totalDue) {
  const card = allCards.find(c => c.id == cardId);
  document.getElementById("payment-modal-title").textContent =
    `Registrar pago — ${card ? card.name : ""}`;
  document.getElementById("p-card-id").value = cardId;
  document.getElementById("p-month").value = monthSelect.value;
  document.getElementById("p-year").value = yearSelect.value;
  document.getElementById("p-total-due").value = totalDue;
  document.getElementById("p-total-due-display").textContent = formatCurrency(totalDue);

  // Pre-fill if existing payment
  const existing = card && card.payment;
  document.getElementById("p-amount-paid").value = existing ? existing.amount_paid : "";
  document.getElementById("p-notes").value = existing ? existing.notes : "";
  document.getElementById("payment-preview").classList.add("hidden");
  document.getElementById("payment-modal-error").classList.add("hidden");

  updatePaymentPreview();
  document.getElementById("payment-modal").classList.remove("hidden");
}

function closePaymentModal() {
  document.getElementById("payment-modal").classList.add("hidden");
}

document.getElementById("p-amount-paid").addEventListener("input", updatePaymentPreview);

function updatePaymentPreview() {
  const total = parseFloat(document.getElementById("p-total-due").value) || 0;
  const paid = parseFloat(document.getElementById("p-amount-paid").value);
  const preview = document.getElementById("payment-preview");

  if (isNaN(paid) || paid < 0) {
    preview.classList.add("hidden");
    return;
  }

  const pending = Math.max(0, total - paid);
  preview.classList.remove("hidden");

  if (pending === 0) {
    preview.className = "rounded-lg px-4 py-3 text-sm text-center font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800";
    preview.textContent = "✓ Se marcará como pagada";
  } else {
    preview.className = "rounded-lg px-4 py-3 text-sm text-center font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800";
    preview.textContent = `⚠ Saldo pendiente: ${formatCurrency(pending)}`;
  }
}

document.getElementById("payment-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  const errEl = document.getElementById("payment-modal-error");
  errEl.classList.add("hidden");

  const payload = {
    card_id: parseInt(document.getElementById("p-card-id").value),
    month: parseInt(document.getElementById("p-month").value),
    year: parseInt(document.getElementById("p-year").value),
    total_due: parseFloat(document.getElementById("p-total-due").value),
    amount_paid: parseFloat(document.getElementById("p-amount-paid").value),
    notes: document.getElementById("p-notes").value,
  };

  try {
    await apiFetch("/api/cards/payments", { method: "POST", body: JSON.stringify(payload) });
    closePaymentModal();
    loadAll();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
});

// ─── History modal ────────────────────────────────────────────────────────────
async function openHistoryModal(cardId, cardName) {
  document.getElementById("history-modal-title").textContent = `Historial — ${cardName}`;
  document.getElementById("history-modal-subtitle").textContent = "";
  document.getElementById("history-loading").classList.remove("hidden");
  document.getElementById("history-empty").classList.add("hidden");
  document.getElementById("history-body").classList.add("hidden");
  document.getElementById("history-modal").classList.remove("hidden");

  try {
    const payments = await apiFetch(`/api/cards/payments/${cardId}`);
    document.getElementById("history-loading").classList.add("hidden");

    if (payments.length === 0) {
      document.getElementById("history-empty").classList.remove("hidden");
      return;
    }

    // Stats
    const totalPaid = payments.reduce((s, p) => s + p.amount_paid, 0);
    const totalPending = payments.reduce((s, p) => s + p.pending_balance, 0);
    document.getElementById("history-modal-subtitle").textContent =
      `${payments.length} pago${payments.length !== 1 ? "s" : ""} · Abonado total: ${formatCurrency(totalPaid)}` +
      (totalPending > 0 ? ` · Pendiente acumulado: ${formatCurrency(totalPending)}` : "");

    const body = document.getElementById("history-body");
    body.innerHTML = payments.map(p => {
      const statusBadge = p.status === "paid"
        ? `<span class="inline-flex items-center bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-semibold px-2 py-0.5 rounded-full">✓ Pagada</span>`
        : `<span class="inline-flex items-center bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-semibold px-2 py-0.5 rounded-full">⚠ Parcial</span>`;

      const pendingLine = p.pending_balance > 0
        ? `<p class="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Pendiente: ${formatCurrency(p.pending_balance)}</p>`
        : "";

      const notesLine = p.notes
        ? `<p class="text-xs text-slate-400 mt-0.5 italic">"${p.notes}"</p>`
        : "";

      const paidAt = p.paid_at ? new Date(p.paid_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "";

      return `
        <div class="flex items-start justify-between bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-semibold text-slate-800 dark:text-white text-sm">
                ${MONTH_FULL[p.month - 1]} ${p.year}
              </span>
              ${statusBadge}
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Resumen: ${formatCurrency(p.total_due)} · Abonado: <strong>${formatCurrency(p.amount_paid)}</strong>
            </p>
            ${pendingLine}
            ${notesLine}
            ${paidAt ? `<p class="text-xs text-slate-400 mt-1">Registrado el ${paidAt}</p>` : ""}
          </div>
          <button data-action="delete-payment" data-id="${p.id}"
            class="text-slate-300 hover:text-red-400 transition ml-3 flex-shrink-0 text-lg">✕</button>
        </div>`;
    }).join("");

    body.classList.remove("hidden");

    body.addEventListener("click", async (ev) => {
      const btn = ev.target.closest("[data-action='delete-payment']");
      if (!btn) return;
      if (!confirm("¿Eliminar este registro de pago?")) return;
      try {
        await apiFetch(`/api/cards/payments/${btn.dataset.id}`, { method: "DELETE" });
        closeHistoryModal();
        loadAll();
      } catch (err) { alert(err.message); }
    }, { once: true });

  } catch (err) {
    document.getElementById("history-loading").textContent = "Error al cargar el historial.";
  }
}

function closeHistoryModal() {
  document.getElementById("history-modal").classList.add("hidden");
}

// ─── Filters ──────────────────────────────────────────────────────────────────
monthSelect.addEventListener("change", loadAll);
yearSelect.addEventListener("change", loadAll);

loadAll();
