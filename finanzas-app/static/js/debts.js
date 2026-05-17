requireAuth();
initPageCommons();

let currentTab = "all";
const debtMap = {};

const IC = {
  arrowDown: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="m12 5 0 14M5 12l7 7 7-7"/></svg>`,
  arrowUp:   `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="m12 19 0-14M5 12l7-7 7 7"/></svg>`,
  calendar:  `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
  alert:     `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/></svg>`,
  check:     `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>`,
  undo:      `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>`,
  trash:     `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>`,
  edit:      `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
};

function setTab(tab) {
  currentTab = tab;
  ["all", "owe", "owed"].forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    if (t === tab) {
      btn.className = "px-4 py-1.5 rounded-md text-sm font-medium bg-blue-700 text-white transition";
    } else {
      btn.className = "px-4 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition";
    }
  });
  loadDebts();
}

async function loadDebts() {
  const list = document.getElementById("debts-list");
  list.innerHTML = '<p class="text-gray-400 text-sm">Cargando...</p>';
  try {
    const params = currentTab !== "all" ? `?type=${currentTab}` : "";
    const debts = await apiFetch(`/api/debts${params}`);

    // Calcular KPIs (siempre con todos los datos)
    const all = currentTab === "all" ? debts : await apiFetch("/api/debts");
    const pending = all.filter(d => !d.paid);
    const oweTotal = pending.filter(d => d.type === "owe").reduce((s, d) => s + d.amount, 0);
    const owedTotal = pending.filter(d => d.type === "owed").reduce((s, d) => s + d.amount, 0);
    const oweCount = pending.filter(d => d.type === "owe").length;
    const owedCount = pending.filter(d => d.type === "owed").length;
    document.getElementById("kpi-owe").textContent = formatCurrency(oweTotal);
    document.getElementById("kpi-owed").textContent = formatCurrency(owedTotal);
    document.getElementById("kpi-owe-count").textContent = `${oweCount} pendiente${oweCount !== 1 ? "s" : ""}`;
    document.getElementById("kpi-owed-count").textContent = `${owedCount} pendiente${owedCount !== 1 ? "s" : ""}`;

    debts.forEach(d => { debtMap[d.id] = d; });
    if (debts.length === 0) {
      list.innerHTML = `
        <div class="text-center py-16 text-slate-400">
          <div class="flex justify-center mb-4 opacity-30">
            <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <p class="font-medium text-slate-500 dark:text-slate-400">Sin deudas registradas</p>
          <p class="text-sm mt-1">Registrá lo que debés o lo que te deben</p>
        </div>`;
      return;
    }
    list.innerHTML = debts.map(d => renderDebtCard(d)).join("");
  } catch (err) {
    list.innerHTML = `<p class="text-red-400 text-sm">${err.message}</p>`;
  }
}

function renderDebtCard(d) {
  const isOwe = d.type === "owe";
  const typeLabel = isOwe ? "Debo a" : "Me debe";
  const dueBadge = d.due_date
    ? `<span class="inline-flex items-center gap-1 text-xs ${d.overdue && !d.paid ? "text-red-500 font-medium" : "text-slate-400"}">
        ${IC.calendar}${formatDate(d.due_date)}${d.overdue && !d.paid ? `<span class="inline-flex">${IC.alert}</span>` : ""}
      </span>`
    : "";
  const paidBadge = d.paid
    ? `<span class="inline-flex items-center gap-1 text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700 px-2 py-0.5 rounded-full font-medium">${IC.check}Saldada</span>`
    : "";
  const avatarIcon = isOwe
    ? `<span class="text-red-500">${IC.arrowDown}</span>`
    : `<span class="text-emerald-500">${IC.arrowUp}</span>`;

  return `
    <div class="bg-white dark:bg-slate-900 rounded-lg p-4 border ${d.paid ? "border-slate-100 dark:border-slate-800 opacity-60" : d.overdue ? "border-red-200 dark:border-red-800" : "border-slate-200 dark:border-slate-700"} flex items-center gap-4">
      <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
        ${isOwe ? "bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800" : "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800"}">
        ${avatarIcon}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs font-medium ${isOwe ? "text-red-500" : "text-emerald-600"}">${typeLabel}</span>
          <span class="font-semibold text-slate-800 dark:text-slate-200 text-sm">${d.person_name}</span>
          ${paidBadge}
        </div>
        ${d.description ? `<p class="text-xs text-slate-400 mt-0.5 truncate">${d.description}</p>` : ""}
        <div class="flex items-center gap-3 mt-1">${dueBadge}</div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="font-bold text-sm ${isOwe ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}">${formatCurrency(d.amount)}</span>
        <button data-action="toggle" data-id="${d.id}" title="${d.paid ? "Marcar pendiente" : "Marcar saldada"}"
          class="${d.paid ? "text-slate-300 hover:text-amber-500" : "text-slate-300 hover:text-emerald-500"} transition p-1 rounded">${d.paid ? IC.undo : IC.check}</button>
        <button data-action="edit-debt" data-id="${d.id}" title="Editar"
          class="text-slate-300 hover:text-blue-400 transition p-1 rounded">${IC.edit}</button>
        <button data-action="delete-debt" data-id="${d.id}"
          class="text-slate-300 hover:text-red-400 transition p-1 rounded">${IC.trash}</button>
      </div>
    </div>`;
}

// Event delegation
document.getElementById("debts-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === "toggle") {
    try {
      await apiFetch(`/api/debts/${id}/toggle-paid`, { method: "PATCH" });
      loadDebts();
    } catch (err) { alert(err.message); }
  }
  if (btn.dataset.action === "edit-debt") openEditModal(debtMap[parseInt(id)]);
  if (btn.dataset.action === "delete-debt") {
    if (!confirm("¿Eliminar esta deuda?")) return;
    try {
      await apiFetch(`/api/debts/${id}`, { method: "DELETE" });
      loadDebts();
    } catch (err) { alert(err.message); }
  }
});

function openModal() {
  document.getElementById("d-edit-id").value = "";
  document.getElementById("modal-title").textContent = "Nueva deuda";
  document.getElementById("modal-submit").textContent = "Guardar";
  document.getElementById("d-person").value = "";
  document.getElementById("d-description").value = "";
  document.getElementById("d-amount").value = "";
  document.getElementById("d-due-date").value = "";
  document.querySelector('input[name="d-type"][value="owe"]').checked = true;
  document.getElementById("modal-error").classList.add("hidden");
  document.getElementById("modal").classList.remove("hidden");
}

function openEditModal(d) {
  document.getElementById("d-edit-id").value = d.id;
  document.getElementById("modal-title").textContent = "Editar deuda";
  document.getElementById("modal-submit").textContent = "Guardar";
  document.getElementById("d-person").value = d.person_name;
  document.getElementById("d-description").value = d.description || "";
  document.getElementById("d-amount").value = d.amount;
  document.getElementById("d-due-date").value = d.due_date ? d.due_date.slice(0, 10) : "";
  const typeInput = document.querySelector(`input[name="d-type"][value="${d.type}"]`);
  if (typeInput) typeInput.checked = true;
  document.getElementById("modal-error").classList.add("hidden");
  document.getElementById("modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

document.getElementById("debt-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  const errEl = document.getElementById("modal-error");
  errEl.classList.add("hidden");
  const editId = document.getElementById("d-edit-id").value;
  const dueDate = document.getElementById("d-due-date").value;
  const body = {
    person_name: document.getElementById("d-person").value,
    description: document.getElementById("d-description").value,
    amount: parseFloat(document.getElementById("d-amount").value),
    due_date: dueDate ? new Date(dueDate + "T12:00:00").toISOString() : null,
  };
  try {
    if (editId) {
      await apiFetch(`/api/debts/${editId}`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      await apiFetch("/api/debts", {
        method: "POST",
        body: JSON.stringify({ ...body, type: document.querySelector('input[name="d-type"]:checked').value }),
      });
    }
    closeModal();
    loadDebts();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
});

loadDebts();
