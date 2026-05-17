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
  const search = document.getElementById("search-filter")?.value?.trim() || "";
  const params = new URLSearchParams({ month, year });
  if (type) params.set("type", type);
  if (search) params.set("search", search);

  const tbody = document.getElementById("transactions-body");
  tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-slate-400">Cargando...</td></tr>';

  try {
    const resp = await apiFetch(`/api/transactions?${params}`);
    const items = resp.items ?? resp;
    // Actualizar mapa para acceso rápido desde botones
    items.forEach(t => { transactionMap[t.id] = t; });

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-slate-400">Sin transacciones para este período</td></tr>';
      return;
    }
    const paymentLabels = {
      efectivo: "💵 Efectivo",
      transferencia: "🏦 Transferencia",
      debito: "💳 Débito",
      credito: "💳 Crédito",
      debito_automatico: "🔄 Débito auto.",
      cheque: "📄 Cheque",
    };
    tbody.innerHTML = items.map((t, i) => `
      <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition anim-row-in" style="animation-delay:${Math.min(i, 15) * 28}ms">
        <td class="px-6 py-4 text-slate-800 dark:text-slate-200">
          <span class="mr-1">${t.category.icon}</span>${t.category.name}
        </td>
        <td class="px-6 py-4 text-slate-600 dark:text-slate-400">${t.description || "—"}</td>
        <td class="px-6 py-4 text-slate-500 dark:text-slate-400 hidden md:table-cell">
          ${t.payment_method ? `<span class="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">${paymentLabels[t.payment_method] || t.payment_method}</span>` : '<span class="text-slate-300 dark:text-slate-600">—</span>'}
        </td>
        <td class="px-6 py-4 text-slate-500 dark:text-slate-400">${formatDate(t.date)}</td>
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
    tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-red-400">${err.message}</td></tr>`;
  }
}

// Event delegation — un solo listener para toda la tabla
document.getElementById("transactions-body").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = parseInt(btn.dataset.id);
  if (btn.dataset.action === "edit") editTransaction(transactionMap[id]);
  if (btn.dataset.action === "delete") deleteTransaction(id, btn.closest("tr"));
});

function openNewModal() {
  document.getElementById("modal-title").textContent = "Nueva transacción";
  document.getElementById("edit-id").value = "";
  document.getElementById("t-type").value = "expense";
  document.getElementById("t-amount").value = "";
  document.getElementById("t-payment-method").value = "";
  document.getElementById("t-description").value = "";
  document.getElementById("t-date").value = new Date().toISOString().slice(0, 10);
  document.getElementById("modal-error").classList.add("hidden");
  document.getElementById("scan-receipt-btn").style.display = "";
  document.getElementById("scan-status").classList.add("hidden");
  document.getElementById("receipt-input").value = "";
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
  document.getElementById("t-payment-method").value = t.payment_method || "";
  document.getElementById("t-description").value = t.description;
  document.getElementById("t-date").value = t.date.slice(0, 10);
  document.getElementById("modal-error").classList.add("hidden");
  document.getElementById("scan-receipt-btn").style.display = "none";
  document.getElementById("scan-status").classList.add("hidden");
  document.getElementById("modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

async function deleteTransaction(id, rowEl) {
  if (!confirm("¿Eliminar esta transacción?")) return;
  try {
    if (rowEl) {
      animateRowOut(rowEl, async () => {
        await apiFetch(`/api/transactions/${id}`, { method: "DELETE" });
        loadTransactions();
      });
    } else {
      await apiFetch(`/api/transactions/${id}`, { method: "DELETE" });
      loadTransactions();
    }
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
  const paymentMethod = document.getElementById("t-payment-method").value;
  const body = {
    type: document.getElementById("t-type").value,
    amount: parseFloat(document.getElementById("t-amount").value),
    category_id: parseInt(document.getElementById("t-category").value),
    description: document.getElementById("t-description").value,
    date: new Date(document.getElementById("t-date").value + "T12:00:00").toISOString(),
    payment_method: paymentMethod || null,
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
  } finally {
    btn.disabled = false;
  }
});

["month-select", "year-select", "type-filter"].forEach(id => {
  document.getElementById(id).addEventListener("change", loadTransactions);
});

// Búsqueda con debounce
let _searchTimer = null;
document.getElementById("search-filter").addEventListener("input", (e) => {
  const clearBtn = document.getElementById("search-clear");
  if (clearBtn) clearBtn.classList.toggle("hidden", !e.target.value);
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(loadTransactions, 350);
});

function clearSearch() {
  const inp = document.getElementById("search-filter");
  if (inp) inp.value = "";
  const clearBtn = document.getElementById("search-clear");
  if (clearBtn) clearBtn.classList.add("hidden");
  loadTransactions();
}
window.clearSearch = clearSearch;

// Exponer openNewModal como openModal para el onclick del HTML
window.openModal = openNewModal;

Promise.all([loadCategories(), loadTransactions()]);

// ── Escanear ticket/factura (Gemini Vision via backend) ───────────────────────
// El label#scan-receipt-btn activa el input nativamente — sin .click() programático
// para que funcione en iOS Safari y todos los móviles.
document.getElementById("receipt-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById("scan-status");
  const setStatus = (msg, color) => {
    const colors = {
      blue:  "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
      green: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400",
      red:   "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
    };
    statusEl.className = `text-sm text-center py-2 px-3 rounded-lg mb-3 ${colors[color]}`;
    statusEl.textContent = msg;
    statusEl.classList.remove("hidden");
  };

  setStatus("Analizando ticket…", "blue");

  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const result = await apiFetch("/api/transactions/scan-receipt", {
      method: "POST",
      body: JSON.stringify({ image: base64 }),
    });

    let detected = 0;
    if (result.amount != null) { document.getElementById("t-amount").value = result.amount; detected++; }
    if (result.description)    { document.getElementById("t-description").value = result.description; detected++; }
    if (result.date)           { document.getElementById("t-date").value = result.date; detected++; }

    document.getElementById("t-type").value = "expense";
    populateCategorySelect("expense");
    if (result.category_id) document.getElementById("t-category").value = result.category_id;

    setStatus(
      detected > 0 ? "✓ Datos detectados — revisá y confirmá antes de guardar"
                   : "No se detectaron datos. Intentá con una foto más clara.",
      detected > 0 ? "green" : "red"
    );
  } catch (err) {
    setStatus(err.message || "Error al analizar el ticket. Intentá nuevamente.", "red");
  } finally {
    e.target.value = "";
  }
});

// ── Importar CSV / Excel ───────────────────────────────────────────────────────
let _csvFile = null;

window.openImportModal = function () {
  _csvFile = null;
  document.getElementById("csv-file-input").value = "";
  document.getElementById("drop-filename").textContent = "Ningún archivo seleccionado";
  document.getElementById("import-btn").disabled = true;
  document.getElementById("import-result").classList.add("hidden");
  document.getElementById("import-result").innerHTML = "";
  document.getElementById("import-modal").classList.remove("hidden");
  lucide.createIcons();
};

window.closeImportModal = function () {
  document.getElementById("import-modal").classList.add("hidden");
};

window.handleFileSelect = function (event) {
  const file = event.target.files[0];
  if (file) _setImportFile(file);
};

window.handleDrop = function (event) {
  event.preventDefault();
  document.getElementById("drop-zone").classList.remove("border-blue-500", "bg-blue-50", "dark:bg-blue-900/10");
  const file = event.dataTransfer.files[0];
  if (file) _setImportFile(file);
};

function _setImportFile(file) {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv") && !name.endsWith(".xlsx") && !name.endsWith(".xls")) {
    alert("El archivo debe ser CSV o Excel (.csv, .xlsx, .xls)");
    return;
  }
  _csvFile = file;
  document.getElementById("drop-filename").textContent = file.name;
  document.getElementById("import-btn").disabled = false;
}

window.submitImport = async function () {
  if (!_csvFile) return;
  const btn = document.getElementById("import-btn");
  const resultEl = document.getElementById("import-result");
  btn.disabled = true;
  btn.textContent = "Importando...";
  resultEl.classList.add("hidden");

  const formData = new FormData();
  formData.append("file", _csvFile);

  try {
    const token = getToken();
    const res = await fetch("/api/transactions/import", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error al importar");

    const hasErrors = data.errors && data.errors.length > 0;
    const errHtml = hasErrors
      ? `<div class="mt-2">
          <p class="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Filas con error (${data.errors.length}):</p>
          <ul class="text-xs text-red-500 dark:text-red-400 space-y-0.5 max-h-28 overflow-y-auto">
            ${data.errors.map(e => `<li>Fila ${e.fila}: ${e.error}</li>`).join("")}
          </ul>
        </div>` : "";

    resultEl.innerHTML = `
      <div class="rounded-lg p-3 ${data.imported > 0 ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800" : "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"}">
        <p class="text-sm font-semibold ${data.imported > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}">
          ✓ ${data.imported} transacciones importadas de ${data.total_rows} filas
        </p>
        ${errHtml}
      </div>`;
    resultEl.classList.remove("hidden");

    if (data.imported > 0) {
      loadTransactions();
      // Cerrar modal después de 2 seg si no hubo errores
      if (!hasErrors) setTimeout(closeImportModal, 2000);
    }
  } catch (err) {
    resultEl.innerHTML = `<div class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-lg p-3">${err.message}</div>`;
    resultEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Importar";
  }
};
