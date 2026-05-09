requireAuth();
initPageCommons();

let allGroups = [];
let currentTab = "activos";
let currentGroupId = null;
let currentGroupIsVirtual = false;
let currentGroupIsOwner = false;
let currentMyParticipantId = null;
let currentJoinUrl = null;
let _qrInstance = null;
let _shareQrInstance = null;

// ── Carga inicial ─────────────────────────────────────────────────────────────

async function loadGroups() {
  try {
    const [groups, invites] = await Promise.all([
      apiFetch("/api/compartidos"),
      apiFetch("/api/compartidos/invites").catch(() => []),
    ]);
    allGroups = groups;
    renderInvites(invites);
    renderGroups();
  } catch (e) {
    document.getElementById("groups-grid").innerHTML =
      '<p class="text-red-400 text-sm col-span-full">Error al cargar grupos.</p>';
  }
}

// ── Invitaciones pendientes ───────────────────────────────────────────────────

function renderInvites(invites) {
  const section = document.getElementById("invites-section");
  const list = document.getElementById("invites-list");

  if (!invites.length) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");
  list.innerHTML = invites
    .map(
      (inv) => `
    <div class="flex items-center justify-between bg-white dark:bg-slate-800 rounded-lg px-4 py-3 border border-amber-200 dark:border-amber-800">
      <div>
        <p class="text-sm font-semibold text-slate-800 dark:text-white">${esc(inv.group_name)}</p>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Invitado por <strong>${esc(inv.inviter_name)}</strong></p>
      </div>
      <div class="flex gap-2">
        <button data-action="accept-invite" data-token="${inv.token}" data-group-id="${inv.group_id}"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition">
          Aceptar
        </button>
        <button data-action="decline-invite" data-token="${inv.token}"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition">
          Rechazar
        </button>
      </div>
    </div>`
    )
    .join("");

  if (window.lucide) lucide.createIcons();
}

// ── Grupos grid ───────────────────────────────────────────────────────────────

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
          <div class="w-8 h-8 rounded-lg ${g.is_virtual ? "bg-purple-100 dark:bg-purple-900/40" : "bg-blue-100 dark:bg-blue-900/40"} flex items-center justify-center flex-shrink-0">
            <i data-lucide="${g.is_virtual ? "users" : "users-round"}" class="w-4 h-4 ${g.is_virtual ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400"}"></i>
          </div>
          <div>
            <p class="font-semibold text-slate-800 dark:text-white text-sm leading-tight">${esc(g.name)}</p>
            ${g.description ? `<p class="text-xs text-slate-400 mt-0.5">${esc(g.description)}</p>` : ""}
          </div>
        </div>
        <div class="flex flex-col items-end gap-1 flex-shrink-0">
          ${g.is_virtual ? '<span class="bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 text-xs font-semibold px-2 py-0.5 rounded-full">Colaborativo</span>' : ""}
          ${g.is_settled ? '<span class="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-semibold px-2 py-0.5 rounded-full">Saldado</span>' : ""}
        </div>
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
  const { group, participants, expenses, balances, settlements, my_participant_id } = data;

  currentGroupIsVirtual = group.is_virtual;
  currentGroupIsOwner = group.is_owner;
  currentMyParticipantId = my_participant_id;

  document.getElementById("detail-title").textContent = group.name;
  document.getElementById("detail-desc").textContent =
    group.description || `${participants.length} participantes · Total: ${formatCurrency(group.total)}`;

  // Botón invitar: solo visible en grupos colaborativos y para el owner
  const btnInvite = document.getElementById("btn-invite-member");
  if (group.is_virtual && group.is_owner) {
    btnInvite.classList.remove("hidden");
  } else {
    btnInvite.classList.add("hidden");
  }

  // Sección de enlace: solo para owner de grupos colaborativos
  const inviteLinkSection = document.getElementById("invite-link-section");
  if (group.is_virtual && group.is_owner && group.join_token) {
    const url = buildJoinUrl(group.join_token);
    currentJoinUrl = url;
    document.getElementById("join-link-input").value = url;
    inviteLinkSection.classList.remove("hidden");
  } else {
    inviteLinkSection.classList.add("hidden");
    if (!group.is_virtual) currentJoinUrl = null;
  }

  // Botones settle y delete: solo para el owner
  document.getElementById("btn-settle").style.display = group.is_owner ? "" : "none";
  document.getElementById("btn-delete-group").style.display = group.is_owner ? "" : "none";

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

  // Sección de miembros (solo grupos colaborativos)
  const membersSection = document.getElementById("members-section");
  const membersList = document.getElementById("members-list");
  if (group.is_virtual) {
    membersSection.classList.remove("hidden");
    membersList.innerHTML = participants
      .map((p) => {
        const isMe = p.user_id != null && p.id === my_participant_id;
        return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          ${esc(p.name)}${isMe ? ' <span class="text-blue-500">(vos)</span>' : ""}
        </span>`;
      })
      .join("");
  } else {
    membersSection.classList.add("hidden");
  }

  // Selector "Quién pagó": ocultar en grupos colaborativos (auto-atribuido)
  const participantRow = document.getElementById("expense-participant-row");
  if (group.is_virtual) {
    participantRow.classList.add("hidden");
    document.getElementById("e-participant").removeAttribute("required");
  } else {
    participantRow.classList.remove("hidden");
    document.getElementById("e-participant").setAttribute("required", "required");
    const sel = document.getElementById("e-participant");
    sel.innerHTML = participants
      .map((p) => `<option value="${p.id}">${esc(p.name)}</option>`)
      .join("");
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
      .map((e) => {
        const canDelete = group.is_owner || (my_participant_id && e.participant_id === my_participant_id);
        return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
        <td class="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">${esc(e.participant_name)}</td>
        <td class="px-4 py-3 text-slate-600 dark:text-slate-300">${esc(e.description)}</td>
        <td class="px-4 py-3 text-right font-semibold text-slate-800 dark:text-white">${formatCurrency(e.amount)}</td>
        <td class="px-4 py-3 text-center text-slate-400 text-xs">${fmtDate(e.date)}</td>
        <td class="px-2 py-3 text-center">
          ${e.comprobante ? `<button data-action="view-comprobante" data-id="${e.id}" title="Ver comprobante" class="p-1 rounded text-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
            <i data-lucide="receipt" class="w-3.5 h-3.5"></i>
          </button>` : ""}
        </td>
        <td class="px-2 py-3 text-center">
          ${canDelete ? `<button data-action="delete-expense" data-id="${e.id}" class="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>` : ""}
        </td>
      </tr>`;
      })
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

  // Resetear al modo personal
  document.querySelector('input[name="group-mode"][value="personal"]').checked = true;
  document.getElementById("participants-section").classList.remove("hidden");
  document.getElementById("virtual-note").classList.add("hidden");

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
  clearComprobante();
  document.getElementById("modal-expense").classList.remove("hidden");
}

function closeExpenseModal() {
  document.getElementById("modal-expense").classList.add("hidden");
  clearComprobante();
}

function clearComprobante() {
  document.getElementById("e-comprobante").value = "";
  document.getElementById("e-comprobante-name").textContent = "Adjuntar imagen o foto del ticket";
  document.getElementById("e-comprobante-preview").classList.add("hidden");
  document.getElementById("e-comprobante-img").src = "";
}

// ── Modal: Invitar usuario ────────────────────────────────────────────────────

function openInviteModal() {
  document.getElementById("invite-email").value = "";
  document.getElementById("invite-error").classList.add("hidden");
  document.getElementById("invite-success").classList.add("hidden");
  document.getElementById("modal-invite").classList.remove("hidden");
}

function closeInviteModal() {
  document.getElementById("modal-invite").classList.add("hidden");
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

// Toggle de modo en el modal de grupo
document.querySelectorAll('input[name="group-mode"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const isVirtual = radio.value === "virtual";
    document.getElementById("participants-section").classList.toggle("hidden", isVirtual);
    document.getElementById("virtual-note").classList.toggle("hidden", !isVirtual);
  });
});

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) {
    const card = e.target.closest(".group-card");
    if (card) openDetail(Number(card.dataset.id));
    return;
  }

  const action = btn.dataset.action;

  if (action === "close-detail") closeDetail();
  if (action === "close-group-modal") closeGroupModal();
  if (action === "close-expense-modal") closeExpenseModal();
  if (action === "close-invite-modal") closeInviteModal();
  if (action === "close-qr-modal") closeQRModal();
  if (action === "close-share-modal") closeShareModal();
  if (action === "close-comprobante-modal") closeComprobanteModal();

  if (action === "remove-participant") {
    btn.closest(".participant-row").remove();
  }

  if (action === "view-comprobante") {
    openComprobanteModal(Number(btn.dataset.id));
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
      alert(err.message || "Error al eliminar el pago.");
    }
  }

  if (action === "accept-invite") {
    const token = btn.dataset.token;
    const groupId = btn.dataset.groupId;
    try {
      await apiFetch(`/api/compartidos/invites/${token}/accept`, { method: "POST" });
      await loadGroups();
      openDetail(Number(groupId));
    } catch (err) {
      alert(err.message || "Error al aceptar la invitación.");
    }
  }

  if (action === "decline-invite") {
    if (!confirm("¿Rechazar esta invitación?")) return;
    const token = btn.dataset.token;
    try {
      await apiFetch(`/api/compartidos/invites/${token}/decline`, { method: "POST" });
      await loadGroups();
    } catch (err) {
      alert(err.message || "Error al rechazar la invitación.");
    }
  }
});

document.getElementById("btn-new-group").addEventListener("click", openGroupModal);
document.getElementById("btn-add-participant").addEventListener("click", addParticipantRow);

document.getElementById("btn-add-expense").addEventListener("click", () => {
  if (currentGroupId) openExpenseModal();
});

document.getElementById("btn-invite-member").addEventListener("click", () => {
  if (currentGroupId) openInviteModal();
});

document.getElementById("btn-show-qr").addEventListener("click", openQRModal);

document.getElementById("btn-copy-link").addEventListener("click", (e) => {
  if (currentJoinUrl) copyToClipboard(currentJoinUrl, document.getElementById("btn-copy-link"));
});

document.getElementById("btn-copy-share-link").addEventListener("click", (e) => {
  const url = document.getElementById("share-link-input").value;
  if (url) copyToClipboard(url, e.currentTarget);
});

document.getElementById("btn-settle").addEventListener("click", async () => {
  if (!currentGroupId) return;
  try {
    await apiFetch(`/api/compartidos/${currentGroupId}/settle`, { method: "PATCH" });
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
  const isVirtual = document.querySelector('input[name="group-mode"]:checked').value === "virtual";

  const submit = document.getElementById("group-submit");
  submit.disabled = true;

  try {
    if (isVirtual) {
      const created = await apiFetch("/api/compartidos/virtual", {
        method: "POST",
        body: JSON.stringify({ name, description }),
      });
      closeGroupModal();
      await loadGroups();
      if (created.join_token) {
        showShareModal(created.join_token);
      }
      return;
    } else {
      const participants = Array.from(document.querySelectorAll(".participant-name"))
        .map((i) => i.value.trim())
        .filter(Boolean);

      if (participants.length < 2) {
        errEl.textContent = "Agregá al menos 2 participantes con nombre.";
        errEl.classList.remove("hidden");
        submit.disabled = false;
        return;
      }

      await apiFetch("/api/compartidos", {
        method: "POST",
        body: JSON.stringify({ name, description, participants }),
      });
    }

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

  const description = document.getElementById("e-description").value.trim();
  const amount = parseFloat(document.getElementById("e-amount").value);
  const dateVal = document.getElementById("e-date").value;
  const date = dateVal ? new Date(dateVal).toISOString() : undefined;
  const comprobanteImg = document.getElementById("e-comprobante-img").src;
  const comprobante = comprobanteImg && comprobanteImg.startsWith("data:") ? comprobanteImg : undefined;

  const body = { description, amount, ...(date && { date }), ...(comprobante && { comprobante }) };

  // En grupos personales incluir participant_id; en colaborativos el backend lo auto-atribuye
  if (!currentGroupIsVirtual) {
    body.participant_id = Number(document.getElementById("e-participant").value);
  }

  const submit = document.getElementById("expense-submit");
  submit.disabled = true;
  try {
    const data = await apiFetch(`/api/compartidos/${currentGroupId}/expenses`, {
      method: "POST",
      body: JSON.stringify(body),
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

// Formulario: invitar usuario
document.getElementById("invite-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("invite-error");
  const succEl = document.getElementById("invite-success");
  errEl.classList.add("hidden");
  succEl.classList.add("hidden");

  const email = document.getElementById("invite-email").value.trim();
  const submit = document.getElementById("invite-submit");
  submit.disabled = true;

  try {
    const res = await apiFetch(`/api/compartidos/${currentGroupId}/invite`, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    succEl.textContent = `Invitación enviada a ${res.invitee_name}. Recibirá un email para unirse.`;
    succEl.classList.remove("hidden");
    document.getElementById("invite-email").value = "";
  } catch (err) {
    errEl.textContent = err.message || "Error al enviar la invitación.";
    errEl.classList.remove("hidden");
  } finally {
    submit.disabled = false;
  }
});

// ── QR helpers ───────────────────────────────────────────────────────────────

function buildJoinUrl(token) {
  return `${window.location.origin}/compartidos.html?join=${token}`;
}

function renderQR(containerId, url) {
  const el = document.getElementById(containerId);
  el.innerHTML = "";
  return new QRCode(el, {
    text: url,
    width: 160,
    height: 160,
    colorDark: "#1e293b",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M,
  });
}

function showShareModal(joinToken) {
  const url = buildJoinUrl(joinToken);
  currentJoinUrl = url;
  document.getElementById("share-link-input").value = url;
  document.getElementById("btn-whatsapp").href =
    `https://wa.me/?text=${encodeURIComponent("Unite a mi grupo de Gastos Compartidos: " + url)}`;
  _shareQrInstance = renderQR("share-qr-container", url);
  document.getElementById("modal-share-link").classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function closeShareModal() {
  document.getElementById("modal-share-link").classList.add("hidden");
}

function openQRModal() {
  if (!currentJoinUrl) return;
  document.getElementById("qr-container").innerHTML = "";
  _qrInstance = renderQR("qr-container", currentJoinUrl);
  document.getElementById("modal-qr").classList.remove("hidden");
}

function closeQRModal() {
  document.getElementById("modal-qr").classList.add("hidden");
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i>';
    if (window.lucide) lucide.createIcons();
    setTimeout(() => { btn.innerHTML = orig; if (window.lucide) lucide.createIcons(); }, 1500);
  });
}

// ── Flujo join via URL (?join=TOKEN) ─────────────────────────────────────────

async function handleJoinFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("join");
  if (!token) return;

  // Limpiar el parámetro de la URL sin recargar
  window.history.replaceState({}, "", "/compartidos.html");

  try {
    const res = await apiFetch(`/api/compartidos/join/${token}`, { method: "POST" });
    await loadGroups();
    if (res.group_id) {
      openDetail(res.group_id);
    }
    if (res.already_member) {
      console.info("Ya eras miembro del grupo.");
    }
  } catch (err) {
    alert(err.message || "El enlace de invitación no es válido.");
  }
}

// ── Comprobante: modal de vista ───────────────────────────────────────────────

function openComprobanteModal(expenseId) {
  const loading = document.getElementById("comprobante-loading");
  const img = document.getElementById("comprobante-full-img");
  const dl = document.getElementById("comprobante-download");
  loading.classList.remove("hidden");
  img.classList.add("hidden");
  dl.classList.add("hidden");
  document.getElementById("modal-comprobante").classList.remove("hidden");

  apiFetch(`/api/compartidos/expenses/${expenseId}/comprobante`)
    .then((res) => {
      img.src = res.comprobante;
      dl.href = res.comprobante;
      loading.classList.add("hidden");
      img.classList.remove("hidden");
      dl.classList.remove("hidden");
      if (window.lucide) lucide.createIcons();
    })
    .catch(() => {
      loading.textContent = "No se pudo cargar el comprobante.";
    });
}

function closeComprobanteModal() {
  document.getElementById("modal-comprobante").classList.add("hidden");
  document.getElementById("comprobante-full-img").src = "";
}

// ── Comprobante: file input ───────────────────────────────────────────────────

function compressImage(file, maxPx = 1200, quality = 0.75) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
          else { width = Math.round(width * maxPx / height); height = maxPx; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

document.getElementById("e-comprobante").addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    alert("La imagen no puede superar los 10 MB.");
    clearComprobante();
    return;
  }
  const dataUrl = await compressImage(file);
  document.getElementById("e-comprobante-name").textContent = file.name;
  document.getElementById("e-comprobante-img").src = dataUrl;
  document.getElementById("e-comprobante-preview").classList.remove("hidden");
});

document.getElementById("e-comprobante-remove").addEventListener("click", clearComprobante);

// ── Arranque ──────────────────────────────────────────────────────────────────
loadGroups().then(() => handleJoinFromUrl());
