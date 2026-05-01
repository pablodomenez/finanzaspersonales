requireAuth();
initPageCommons();

const yearSelect = document.getElementById("year-select");
let categories = [];
// Mapa id→transaction para evitar pasar JSON como atributo inline (XSS)
const transactionMap = {};

async function loadCategories() {
  categories = await apiFetch("/api/categories");
}

function populateCategorySelect(type) {
  const sel = document.getElementById("t-category");
  sel.innerHTML = categories
    .filter(c => c.type === type || c.type === "both")
    .map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`)
    .join("");
}

document.getElementById("t-type").addEventListener("change", (e) => {
  populateCategorySelect(e.target.value);
});

async function loadTransactions() {
  const month = document.getElementById("month-select").value;
  const year = yearSelect.value;
  const type = document.getElementById("type-filter").value;
  const params = new URLSearchParams({ month, year });
  if (type) params.set("type", type);

  const tbody = document.getElementById("transactions-body");
  tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-400">Cargando...</td></tr>';

  try {
    const data = await apiFetch(`/api/transactions?${params}`);
    // Actualizar mapa para acceso rápido desde botones
    data.forEach(t => { transactionMap[t.id] = t; });

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-400">Sin transacciones para este período</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(t => `
      <tr class="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition">
        <td class="px-6 py-4 text-gray-800 dark:text-gray-200">
          <span class="mr-1">${t.category.icon}</span>${t.category.name}
        </td>
        <td class="px-6 py-4 text-gray-600 dark:text-gray-400">${t.description || "—"}</td>
        <td class="px-6 py-4 text-gray-500 dark:text-gray-400">${formatDate(t.date)}</td>
        <td class="px-6 py-4 text-right font-semibold ${t.type === "income" ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}">
          ${t.type === "income" ? "+" : "-"}${formatCurrency(t.amount)}
        </td>
        <td class="px-6 py-4 text-right">
          <button data-action="edit" data-id="${t.id}" class="text-blue-500 hover:text-blue-700 text-xs mr-2">Editar</button>
          <button data-action="delete" data-id="${t.id}" class="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-red-400">${err.message}</td></tr>`;
  }
}

// Event delegation — un solo listener para toda la tabla
document.getElementById("transactions-body").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = parseInt(btn.dataset.id);
  if (btn.dataset.action === "edit") editTransaction(transactionMap[id]);
  if (btn.dataset.action === "delete") deleteTransaction(id);
});

function openNewModal() {
  document.getElementById("modal-title").textContent = "Nueva transacción";
  document.getElementById("edit-id").value = "";
  document.getElementById("t-type").value = "expense";
  document.getElementById("t-amount").value = "";
  document.getElementById("t-description").value = "";
  document.getElementById("t-date").value = new Date().toISOString().slice(0, 10);
  document.getElementById("modal-error").classList.add("hidden");
  populateCategorySelect("expense");
  document.getElementById("modal").classList.remove("hidden");
}

function editTransaction(t) {
  document.getElementById("modal-title").textContent = "Editar transacción";
  document.getElementById("edit-id").value = t.id;
  document.getElementById("t-type").value = t.type;
  populateCategorySelect(t.type);
  document.getElementById("t-category").value = t.category.id;
  document.getElementById("t-amount").value = t.amount;
  document.getElementById("t-description").value = t.description;
  document.getElementById("t-date").value = t.date.slice(0, 10);
  document.getElementById("modal-error").classList.add("hidden");
  document.getElementById("modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

async function deleteTransaction(id) {
  if (!confirm("¿Eliminar esta transacción?")) return;
  try {
    await apiFetch(`/api/transactions/${id}`, { method: "DELETE" });
    loadTransactions();
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById("transaction-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  const errEl = document.getElementById("modal-error");
  errEl.classList.add("hidden");

  const editId = document.getElementById("edit-id").value;
  const body = {
    type: document.getElementById("t-type").value,
    amount: parseFloat(document.getElementById("t-amount").value),
    category_id: parseInt(document.getElementById("t-category").value),
    description: document.getElementById("t-description").value,
    date: new Date(document.getElementById("t-date").value + "T12:00:00").toISOString(),
  };

  try {
    if (editId) {
      await apiFetch(`/api/transactions/${editId}`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      await apiFetch("/api/transactions", { method: "POST", body: JSON.stringify(body) });
    }
    closeModal();
    loadTransactions();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
    btn.disabled = false;
  }
});

["month-select", "year-select", "type-filter"].forEach(id => {
  document.getElementById(id).addEventListener("change", loadTransactions);
});

// Exponer openNewModal como openModal para el onclick del HTML
window.openModal = openNewModal;

Promise.all([loadCategories(), loadTransactions()]);
