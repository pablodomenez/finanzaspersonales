requireAuth();
initPageCommons();

let allGroups = [];
let currentTab = "activos";
let currentGroupId = null;

// ── Carga inicial ─────────────────────────────────────────────────────────────

async function loadGroups() {
  try {
    allGroups = await apiFetch("/api/compartidos");
    renderGroups();
  } catch (e) {
    document.getElementById("groups-grid").innerHTML =
      '<p class="text-red-400 text-sm col-span-full">Error al cargar grupos.</p>';
  }
}

function renderGroups() {
  const grid = document.getElementById("groups-grid");
  const filtered = allGroups.filter((g) =>
    currentTab === "activos" ? !g.is_settled : g.is_settled
  );

  if (!filtered.length) {
    grid.innerHTML = `<p class="text-slate-400 text-sm col-span-full">${
      currentTab === "activos"
        ? 'No tenés grupos activos. Creá uno con "+ Nuevo grupo".'
        : "No hay grupos saldados todavía."
    }</p>`;
    return;
  }

  grid.innerHTML = filtered
    .map(
      (g) => `
    <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 flex flex-col gap-3 hover:border-blue-400 dark:hover:border-blue-500 transition cursor-pointer group-card" data-id="${g.id}">
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
            <i data-lucide="users-round" class="w-4 h-4 text-blue-600 dark:text-blue-400"></i>
          </div>
          <div>
            <p class="font-semibold text-slate-800 dark:text-white text-sm leading-tight">${esc(g.name)}</p>
            ${g.description ? `<p class="text-xs text-slate-400 mt-0.5">${esc(g.description)}</p>` : ""}
          </div>
        </div>
        ${g.is_settled ? '<span class="flex-shrink-0 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-semibold px-2 py-0.5 rounded-full">Saldado</span>' : ""}
      </div>
      <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
        <span>${g.participant_count} personas</span>
        <span class="font-semibold text-slate-700 dark:text-slate-200 text-sm">${formatCurrency(g.total)}</span>
      </div>
    </div>`
    )
    .join("");

  if (window.lucide) lucide.createIcons();
}

// ── Panel de detalle ──────────────────────────────────────────────────────────

async function openDetail(groupId) {
  currentGroupId = groupId;
  try {
    const data = await apiFetch(`/api/compartidos/${groupId}`);
    renderDetail(data);
    document.getElementById("detail-overlay").classList.remove("hidden");
    requestAnimationFrame(() => {
      document.getElementById("detail-panel").style.transform = "translateX(0)";
    });
    if (window.lucide) lucide.createIcons();
  } catch (e) {
    alert("Error al cargar el detalle del grupo.");
  }
}

function closeDetail() {
  document.getElementById("detail-panel").style.transform = "translateX(100%)";
  setTimeout(() => {
    document.getElementById("detail-overlay").classList.add("hidden");
    currentGroupId = null;
  }, 300);
}

function renderDetail(data) {
  const { group, participants, expenses, balances, settlements } = data;

  document.getElementById("detail-title").textContent = group.name;
  document.getElementById("detail-desc").textContent =
    group.description || `${participants.length} participantes · Total: ${formatCurrency(group.total)}`;

  const btnSettle = document.getElementById("btn-settle");
  if (group.is_settled) {
    btnSettle.textContent = "Reabrir";
    btnSettle.className =
      "px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-400 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition";
  } else {
    btnSettle.textContent = "Marcar saldado";
    btnSettle.className =
      "px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-400 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition";
  }

  // Tabla de gastos
  const tbody = document.getElementById("expenses-body");
  const expEmpty = document.getElementById("expenses-empty");
  const expTable = document.getElementById("expenses-table");

  if (!expenses.length) {
    expTable.classList.add("hidden");
    expEmpty.classList.remove("hidden");
  } else {
    expTable.classList.remove("hidden");
    expEmpty.classList.add("hidden");
    tbody.innerHTML = expenses
      .map(
        (e) => `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
        <td class="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">${esc(e.participant_name)}</td>
        <td class="px-4 py-3 text-slate-600 dark:text-slate-300">${esc(e.description)}</td>
        <td class="px-4 py-3 text-right font-semibold text-slate-800 dark:text-white">${formatCurrency(e.amount)}</td>
        <td class="px-4 py-3 text-center text-slate-400 text-xs">${fmtDate(e.date)}</td>
        <td class="px-2 py-3 text-center">
          <button data-action="delete-expense" data-id="${e.id}" class="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </td>
      </tr>`
      )
      .join("");
  }

  // Balances
  const balList = document.getElementById("balances-list");
  const balEmpty = document.getElementById("balances-empty");

  if (!balances.length) {
    balEmpty.classList.remove("hidden");
    balList.innerHTML = "";
  } else {
    balEmpty.classList.add("hidden");
    balList.innerHTML = balances
      .map((b) => {
        const positive = b.balance >= 0;
        const color = positive
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-500 dark:text-red-400";
        const bg = positive
          ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
          : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
        const arrow = positive ? "↑" : "↓";
        const label = positive ? "le deben" : "debe";

        return `
        <div class="flex items-center justify-between rounded-lg border px-4 py-3 ${bg}">
          <div>
            <p class="font-semibold text-slate-800 dark:text-white text-sm">${esc(b.name)}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pagó ${formatCurrency(b.paid)} · parte ${formatCurrency(b.share)}</p>
          </div>
          <div class="text-right">
            <p class="font-bold ${color}">${arrow} ${formatCurrency(Math.abs(b.balance))}</p>
            <p class="text-xs ${color}">${label}</p>
          </div>
        </div>`;
      })
      .join("");
  }

  // Liquidación
  const settList = document.getElementById("settlements-list");
  const settEmpty = document.getElementById("settlements-empty");

  if (!settlements.length) {
    settEmpty.classList.remove("hidden");
    settList.innerHTML = "";
  } else {
    settEmpty.classList.add("hidden");
    settList.innerHTML = settlements
      .map(
        (s) => `
      <div class="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-3 border border-slate-200 dark:border-slate-700">
        <span class="font-semibold text-slate-700 dark:text-slate-200 text-sm">${esc(s.from)}</span>
        <i data-lucide="arrow-right" class="w-4 h-4 text-slate-400 flex-shrink-0"></i>
        <span class="font-semibold text-slate-700 dark:text-slate-200 text-sm">${esc(s.to)}</span>
        <span class="ml-auto font-bold text-blue-600 dark:text-blue-400">${formatCurrency(s.amount)}</span>
      </div>`
      )
      .join("");
  }

  // Poblar select de participantes en el modal de gasto
  const sel = document.getElementById("e-participant");
  sel.innerHTML = participants
    .map((p) => `<option value="${p.id}">${esc(p.name)}</option>`)
    .join("");
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    const active = btn.dataset.tab === tab;
    btn.className = active
      ? "tab-btn px-4 py-1.5 rounded-md text-sm font-medium bg-blue-700 text-white transition"
      : "tab-btn px-4 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition";
  });
  renderGroups();
}

// ── Modal: Nuevo grupo ────────────────────────────────────────────────────────

function openGroupModal() {
  document.getElementById("g-name").value = "";
  document.getElementById("g-desc").value = "";
  document.getElementById("group-error").classList.add("hidden");

  const container = document.getElementById("participants-inputs");
  container.innerHTML = [1, 2]
    .map(
      (n) => `
    <div class="flex gap-2 participant-row">
      <input type="text" placeholder="Nombre participante ${n}" class="participant-name flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
      <button type="button" data-action="remove-participant" class="p-2 text-slate-400 hover:text-red-500 transition hidden">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    </div>`
    )
    .join("");

  if (window.lucide) lucide.createIcons();
  document.getElementById("modal-group").classList.remove("hidden");
}

function closeGroupModal() {
  document.getElementById("modal-group").classList.add("hidden");
}

function addParticipantRow() {
  const container = document.getElementById("participants-inputs");
  const count = container.querySelectorAll(".participant-row").length + 1;
  const div = document.createElement("div");
  div.className = "flex gap-2 participant-row";
  div.innerHTML = `
    <input type="text" placeholder="Nombre participante ${count}" class="participant-name flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
    <button type="button" data-action="remove-participant" class="p-2 text-slate-400 hover:text-red-500 transition">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>`;
  container.appendChild(div);
  if (window.lucide) lucide.createIcons();
}

// ── Modal: Nuevo gasto ────────────────────────────────────────────────────────

function openExpenseModal() {
  document.getElementById("e-description").value = "";
  document.getElementById("e-amount").value = "";
  document.getElementById("e-date").value = "";
  document.getElementById("expense-error").classList.add("hidden");
  document.getElementById("modal-expense").classList.remove("hidden");
}

function closeExpenseModal() {
  document.getElementById("modal-expense").classList.add("hidden");
}

// ── Utilidades ────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

// ── Event listeners ───────────────────────────────────────────────────────────

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) {
    // click en tarjeta de grupo
    const card = e.target.closest(".group-card");
    if (card) openDetail(Number(card.dataset.id));
    return;
  }

  const action = btn.dataset.action;

  if (action === "close-detail") closeDetail();
  if (action === "close-group-modal") closeGroupModal();
  if (action === "close-expense-modal") closeExpenseModal();

  if (action === "remove-participant") {
    btn.closest(".participant-row").remove();
  }

  if (action === "delete-expense") {
    if (!confirm("¿Eliminar este pago?")) return;
    try {
      await apiFetch(`/api/compartidos/expenses/${btn.dataset.id}`, { method: "DELETE" });
      const data = await apiFetch(`/api/compartidos/${currentGroupId}`);
      renderDetail(data);
      await loadGroups();
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      alert("Error al eliminar el pago.");
    }
  }
});

document.getElementById("btn-new-group").addEventListener("click", openGroupModal);
document.getElementById("btn-add-participant").addEventListener("click", addParticipantRow);

document.getElementById("btn-add-expense").addEventListener("click", () => {
  if (currentGroupId) openExpenseModal();
});

document.getElementById("btn-settle").addEventListener("click", async () => {
  if (!currentGroupId) return;
  try {
    const updated = await apiFetch(`/api/compartidos/${currentGroupId}/settle`, { method: "PATCH" });
    await loadGroups();
    const data = await apiFetch(`/api/compartidos/${currentGroupId}`);
    renderDetail(data);
    if (window.lucide) lucide.createIcons();
  } catch (e) {
    alert("Error al actualizar el estado del grupo.");
  }
});

document.getElementById("btn-delete-group").addEventListener("click", async () => {
  if (!currentGroupId) return;
  const group = allGroups.find((g) => g.id === currentGroupId);
  if (!confirm(`¿Eliminar el grupo "${group?.name}"? Esta acción no se puede deshacer.`)) return;
  try {
    await apiFetch(`/api/compartidos/${currentGroupId}`, { method: "DELETE" });
    closeDetail();
    await loadGroups();
  } catch (e) {
    alert("Error al eliminar el grupo.");
  }
});

document.querySelectorAll(".tab-btn").forEach((btn) =>
  btn.addEventListener("click", () => setTab(btn.dataset.tab))
);

// Formulario: nuevo grupo
document.getElementById("group-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("group-error");
  errEl.classList.add("hidden");

  const name = document.getElementById("g-name").value.trim();
  const description = document.getElementById("g-desc").value.trim();
  const participants = Array.from(document.querySelectorAll(".participant-name"))
    .map((i) => i.value.trim())
    .filter(Boolean);

  if (participants.length < 2) {
    errEl.textContent = "Agregá al menos 2 participantes con nombre.";
    errEl.classList.remove("hidden");
    return;
  }

  const submit = document.getElementById("group-submit");
  submit.disabled = true;
  try {
    await apiFetch("/api/compartidos", {
      method: "POST",
      body: JSON.stringify({ name, description, participants }),
    });
    closeGroupModal();
    await loadGroups();
  } catch (err) {
    errEl.textContent = err.message || "Error al crear el grupo.";
    errEl.classList.remove("hidden");
  } finally {
    submit.disabled = false;
  }
});

// Formulario: nuevo gasto
document.getElementById("expense-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("expense-error");
  errEl.classList.add("hidden");

  const participant_id = Number(document.getElementById("e-participant").value);
  const description = document.getElementById("e-description").value.trim();
  const amount = parseFloat(document.getElementById("e-amount").value);
  const dateVal = document.getElementById("e-date").value;
  const date = dateVal ? new Date(dateVal).toISOString() : undefined;

  const submit = document.getElementById("expense-submit");
  submit.disabled = true;
  try {
    const data = await apiFetch(`/api/compartidos/${currentGroupId}/expenses`, {
      method: "POST",
      body: JSON.stringify({ participant_id, description, amount, ...(date && { date }) }),
    });
    closeExpenseModal();
    renderDetail(data);
    await loadGroups();
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    errEl.textContent = err.message || "Error al registrar el pago.";
    errEl.classList.remove("hidden");
  } finally {
    submit.disabled = false;
  }
});

// ── Arranque ──────────────────────────────────────────────────────────────────
loadGroups();
