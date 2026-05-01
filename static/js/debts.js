requireAuth();
initPageCommons();

let currentTab = "all";

function setTab(tab) {
  currentTab = tab;
  ["all", "owe", "owed"].forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    if (t === tab) {
      btn.className = "px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white transition";
    } else {
      btn.className = "px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 transition";
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

    if (debts.length === 0) {
      list.innerHTML = `
        <div class="text-center py-16 text-gray-400">
          <p class="text-5xl mb-3">🤝</p>
          <p class="font-medium">Sin deudas registradas</p>
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
  const accent = isOwe ? "red" : "green";
  const typeLabel = isOwe ? "😬 Debo a" : "🤑 Me debe";
  const dueBadge = d.due_date
    ? `<span class="text-xs ${d.overdue && !d.paid ? "text-red-500 font-medium" : "text-gray-400"}">📅 ${formatDate(d.due_date)}${d.overdue && !d.paid ? " ⚠️" : ""}</span>`
    : "";
  const paidBadge = d.paid
    ? '<span class="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">✅ Saldada</span>'
    : "";
  return `
    <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border ${d.paid ? "border-gray-100 dark:border-gray-700 opacity-60" : d.overdue ? `border-red-200 dark:border-red-800` : "border-gray-100 dark:border-gray-700"} flex items-center gap-4">
      <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0
        ${isOwe ? "bg-red-100 dark:bg-red-900/30" : "bg-green-100 dark:bg-green-900/30"}">
        ${isOwe ? "😬" : "🤑"}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs text-gray-400">${typeLabel}</span>
          <span class="font-semibold text-gray-800 dark:text-gray-200 text-sm">${d.person_name}</span>
          ${paidBadge}
        </div>
        ${d.description ? `<p class="text-xs text-gray-400 mt-0.5 truncate">${d.description}</p>` : ""}
        <div class="flex items-center gap-3 mt-1">${dueBadge}</div>
      </div>
      <div class="flex items-center gap-3 flex-shrink-0">
        <span class="font-bold text-${accent}-600 dark:text-${accent}-400">${formatCurrency(d.amount)}</span>
        <button data-action="toggle" data-id="${d.id}" title="${d.paid ? "Marcar pendiente" : "Marcar saldada"}"
          class="text-gray-300 hover:text-green-500 transition text-xl">${d.paid ? "↩️" : "✅"}</button>
        <button data-action="delete-debt" data-id="${d.id}"
          class="text-gray-300 hover:text-red-400 transition">✕</button>
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
  if (btn.dataset.action === "delete-debt") {
    if (!confirm("¿Eliminar esta deuda?")) return;
    try {
      await apiFetch(`/api/debts/${id}`, { method: "DELETE" });
      loadDebts();
    } catch (err) { alert(err.message); }
  }
});

function openModal() {
  document.getElementById("d-person").value = "";
  document.getElementById("d-description").value = "";
  document.getElementById("d-amount").value = "";
  document.getElementById("d-due-date").value = "";
  document.querySelector('input[name="d-type"][value="owe"]').checked = true;
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
  const dueDate = document.getElementById("d-due-date").value;
  try {
    await apiFetch("/api/debts", {
      method: "POST",
      body: JSON.stringify({
        person_name: document.getElementById("d-person").value,
        description: document.getElementById("d-description").value,
        amount: parseFloat(document.getElementById("d-amount").value),
        type: document.querySelector('input[name="d-type"]:checked').value,
        due_date: dueDate ? new Date(dueDate + "T12:00:00").toISOString() : null,
      }),
    });
    closeModal();
    loadDebts();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
    btn.disabled = false;
  }
});

loadDebts();
