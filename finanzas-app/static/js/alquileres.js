requireAuth();

let _alquileres = [];
let _indices = {};
let _currentAlquilerId = null;
let _currentTab = "pagos";

// ── Init ──────────────────────────────────────────────────────────────────────

(async function init() {
  initPageCommons();
  await Promise.all([loadAlquileres(), loadIndices()]);
  lucide.createIcons();
})();

// ── Carga de datos ────────────────────────────────────────────────────────────

async function loadAlquileres() {
  try {
    _alquileres = await apiFetch("/api/alquileres");
    renderAlquileres();
    renderKPIs();
  } catch (e) {
    console.error("Error cargando alquileres:", e);
  }
}

async function loadIndices() {
  try {
    _indices = await apiFetch("/api/alquileres/indices");
    renderIndices();
  } catch (e) {
    document.getElementById("indices-loading").textContent = "No se pudieron cargar los índices.";
  }
}

// ── Render principal ──────────────────────────────────────────────────────────

function renderIndices() {
  const grid = document.getElementById("indices-grid");
  const icl = _indices.ICL;
  const ipc = _indices.IPC;
  const cvs = _indices.CVS;

  const badge = (val, cls) =>
    val != null
      ? `<span class="text-xs font-bold ${cls}">${val > 0 ? "+" : ""}${val.toFixed(2)}%</span>`
      : `<span class="text-xs text-slate-400">N/D</span>`;

  const indiceCard = (titulo, fuente, data, colorCls) => {
    const filas = [
      ["Acum. 3 meses", data?.acumulado_3m],
      ["Acum. 4 meses", data?.acumulado_4m],
      ["Acum. 6 meses", data?.acumulado_6m],
    ].map(([label, val]) => `
      <div class="flex justify-between">
        <span>${label}</span>
        ${val != null
          ? `<span class="font-bold ${colorCls}">${val > 0 ? "+" : ""}${val.toFixed(2)}%</span>`
          : `<span class="text-slate-400">N/D</span>`}
      </div>`).join("");

    const bgMap = {
      "text-blue-600 dark:text-blue-400": "bg-blue-50 dark:bg-blue-900/20",
      "text-emerald-600 dark:text-emerald-400": "bg-emerald-50 dark:bg-emerald-900/20",
      "text-blue-600 dark:text-blue-400": "bg-blue-50 dark:bg-blue-900/20",
    };
    const titleMap = {
      "text-blue-600 dark:text-blue-400": "text-blue-700 dark:text-blue-300",
      "text-emerald-600 dark:text-emerald-400": "text-emerald-700 dark:text-emerald-300",
      "text-blue-600 dark:text-blue-400": "text-blue-700 dark:text-blue-300",
    };

    return `
      <div class="${bgMap[colorCls]} rounded-xl p-4">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-bold ${titleMap[colorCls]} uppercase tracking-wider">${titulo}</span>
          <span class="text-xs text-slate-500">${data?.fecha_dato || ""}</span>
        </div>
        <p class="text-xs text-slate-500 mb-2">${fuente}</p>
        <div class="space-y-1 text-xs text-slate-600 dark:text-slate-300">${filas}</div>
      </div>`;
  };

  grid.innerHTML =
    indiceCard("ICL", "Índice de Contratos de Locación · BCRA", icl, "text-blue-600 dark:text-blue-400") +
    indiceCard("IPC", "Índice de Precios al Consumidor · INDEC", ipc, "text-emerald-600 dark:text-emerald-400") +
    indiceCard("CVS", "Índice de Salarios · INDEC", cvs, "text-blue-600 dark:text-blue-400");
  document.getElementById("indices-loading")?.remove();
  document.getElementById("indices-fecha").textContent = `Actualizado: ${_indices.fecha || ""}`;
  lucide.createIcons();
}

function renderKPIs() {
  const activos = _alquileres.filter((a) => a.activo);
  const flujoARS = activos
    .filter((a) => a.moneda === "ARS")
    .reduce((s, a) => s + a.valor_actual, 0);

  // Próxima actualización más cercana
  const hoy = new Date();
  let minDias = Infinity;
  activos.forEach((a) => {
    if (a.proxima_actualizacion) {
      const dias = Math.ceil((new Date(a.proxima_actualizacion) - hoy) / 86400000);
      if (dias >= 0 && dias < minDias) minDias = dias;
    }
  });

  document.getElementById("kpi-activos").textContent = activos.length;
  document.getElementById("kpi-mensual").textContent = formatCurrency(flujoARS);
  document.getElementById("kpi-proxima").textContent =
    minDias === Infinity ? "—" : `${minDias}d`;
  // Pendientes se carga async; por ahora mostramos —
  document.getElementById("kpi-pendientes").textContent = "—";
}

function renderAlquileres() {
  const grid = document.getElementById("alquileres-grid");
  const empty = document.getElementById("alquileres-empty");

  if (_alquileres.length === 0) {
    grid.innerHTML = "";
    empty.style.display = "";
    lucide.createIcons();
    return;
  }
  empty.style.display = "none";

  const hoy = new Date();

  grid.innerHTML = _alquileres
    .map((a) => {
      const diasAct = a.proxima_actualizacion
        ? Math.ceil((new Date(a.proxima_actualizacion) - hoy) / 86400000)
        : null;
      const alertaAct = diasAct !== null && diasAct <= 30 && diasAct >= 0;
      const alertaFin = a.fecha_fin_contrato
        ? Math.ceil((new Date(a.fecha_fin_contrato) - hoy) / 86400000) <= 60
        : false;

      const monedaSymbol = a.moneda === "USD" ? "U$S" : "$";
      const rolBadge =
        a.rol === "propietario"
          ? `<span class="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">Propietario</span>`
          : `<span class="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">Inquilino</span>`;

      const inactiveBadge = !a.activo
        ? `<span class="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full font-medium">Inactivo</span>`
        : "";

      const alertaBanner =
        alertaAct || alertaFin
          ? `<div class="mt-3 flex flex-wrap gap-2">
              ${alertaAct ? `<span class="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 px-2 py-1 rounded-lg">📈 Actualización en ${diasAct}d</span>` : ""}
              ${alertaFin ? `<span class="text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 px-2 py-1 rounded-lg">📋 Contrato vence pronto</span>` : ""}
            </div>`
          : "";

      return `
      <div class="bg-white dark:bg-slate-900 rounded-xl border ${!a.activo ? "border-slate-200 dark:border-slate-800 opacity-60" : "border-slate-200 dark:border-slate-700"} p-5">
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1 min-w-0 mr-3">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="font-semibold text-slate-800 dark:text-white text-base truncate">${a.nombre}</h3>
              ${rolBadge}${inactiveBadge}
            </div>
            ${a.direccion ? `<p class="text-xs text-slate-400 mt-0.5">${a.direccion}</p>` : ""}
            ${a.contraparte_nombre ? `<p class="text-xs text-slate-500 mt-0.5">${a.rol === "inquilino" ? "Propietario" : "Inquilino"}: ${a.contraparte_nombre}</p>` : ""}
          </div>
          <div class="flex gap-1 shrink-0">
            <button onclick="openDetalleModal(${a.id})" title="Ver detalle" class="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
              <i data-lucide="list" class="w-4 h-4"></i>
            </button>
            <button onclick="openAlquilerModal(${a.id})" title="Editar" class="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>
            <button onclick="confirmDelete(${a.id}, '${a.nombre.replace(/'/g, "\\'")}')" title="Eliminar" class="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p class="text-xs text-slate-400 mb-0.5">Valor actual</p>
            <p class="font-bold text-slate-800 dark:text-white text-lg">${monedaSymbol} ${a.valor_actual.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400 mb-0.5">Índice / Período</p>
            <p class="font-medium text-slate-700 dark:text-slate-300">${a.indice_actualizacion} · ${_periodoLabel(a.periodo_actualizacion_meses)}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400 mb-0.5">Inicio contrato</p>
            <p class="text-slate-600 dark:text-slate-400">${formatDate(a.fecha_inicio + "T00:00:00")}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400 mb-0.5">Próx. actualización</p>
            <p class="${alertaAct ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-slate-600 dark:text-slate-400"}">${a.proxima_actualizacion ? formatDate(a.proxima_actualizacion + "T00:00:00") : "—"}</p>
          </div>
        </div>

        ${alertaBanner}

        <div class="mt-4 flex gap-2">
          <button onclick="openPagoModal(${a.id}, ${a.valor_actual})" class="flex-1 text-xs bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 px-3 py-2 rounded-lg font-medium transition flex items-center justify-center gap-1.5">
            <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>Pagar mes
          </button>
          <button onclick="openActualizacionModal(${a.id})" class="flex-1 text-xs bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 px-3 py-2 rounded-lg font-medium transition flex items-center justify-center gap-1.5">
            <i data-lucide="trending-up" class="w-3.5 h-3.5"></i>Actualizar precio
          </button>
        </div>
      </div>`;
    })
    .join("");

  lucide.createIcons();
}

// ── Modal: alquiler ───────────────────────────────────────────────────────────

function openAlquilerModal(id = null) {
  document.getElementById("edit-alquiler-id").value = id || "";
  document.getElementById("alquiler-modal-title").textContent = id ? "Editar alquiler" : "Nuevo alquiler";
  document.getElementById("alquiler-form-error").classList.add("hidden");
  document.getElementById("alquiler-form").reset();

  if (id) {
    const a = _alquileres.find((x) => x.id === id);
    if (!a) return;
    document.getElementById("a-nombre").value = a.nombre;
    document.getElementById("a-direccion").value = a.direccion || "";
    document.getElementById("a-rol").value = a.rol;
    document.getElementById("a-contraparte").value = a.contraparte_nombre || "";
    document.getElementById("a-valor").value = a.valor_actual;
    document.getElementById("a-moneda").value = a.moneda;
    document.getElementById("a-fecha-inicio").value = a.fecha_inicio || "";
    document.getElementById("a-fecha-fin").value = a.fecha_fin_contrato || "";
    document.getElementById("a-dia-pago").value = a.dia_pago;
    document.getElementById("a-indice").value = a.indice_actualizacion;
    document.getElementById("a-porcentaje-fijo").value = a.porcentaje_fijo || "";
    document.getElementById("a-periodo").value = String(a.periodo_actualizacion_meses);
    document.getElementById("a-proxima-act").value = a.proxima_actualizacion || "";
    document.getElementById("a-valor-inmueble").value = a.valor_inmueble || "";
    document.getElementById("a-notas").value = a.notas || "";
    togglePorcentajeFijo();
    updateContraparteLabel();
  }

  document.getElementById("alquiler-modal").classList.remove("hidden");
  lucide.createIcons();
}

function closeAlquilerModal() {
  document.getElementById("alquiler-modal").classList.add("hidden");
}

function togglePorcentajeFijo() {
  const val = document.getElementById("a-indice").value;
  const row = document.getElementById("porcentaje-fijo-row");
  row.style.display = val === "fijo" ? "" : "none";
}

function updateContraparteLabel() {
  const rol = document.getElementById("a-rol").value;
  document.getElementById("a-contraparte-label").textContent =
    rol === "inquilino" ? "Nombre del propietario" : "Nombre del inquilino";
}

document.getElementById("a-rol").addEventListener("change", updateContraparteLabel);

function autoCalcularProximaAct() {
  const fechaInicio = document.getElementById("a-fecha-inicio").value;
  const meses = parseInt(document.getElementById("a-periodo").value) || 3;
  if (!fechaInicio) return;
  // Sumar N meses a la fecha de inicio (usar mediodía para evitar drift de timezone)
  const d = new Date(fechaInicio + "T12:00:00");
  d.setMonth(d.getMonth() + meses);
  document.getElementById("a-proxima-act").value = d.toISOString().slice(0, 10);
}

document.getElementById("a-fecha-inicio").addEventListener("change", autoCalcularProximaAct);
document.getElementById("a-periodo").addEventListener("change", autoCalcularProximaAct);

document.getElementById("alquiler-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("alquiler-form-error");
  errEl.classList.add("hidden");

  const id = document.getElementById("edit-alquiler-id").value;
  const meses = parseInt(document.getElementById("a-periodo").value);
  const fechaInicio = document.getElementById("a-fecha-inicio").value;
  const proximaAct = document.getElementById("a-proxima-act").value || null;

  const payload = {
    nombre: document.getElementById("a-nombre").value.trim(),
    direccion: document.getElementById("a-direccion").value.trim(),
    contraparte_nombre: document.getElementById("a-contraparte").value.trim(),
    rol: document.getElementById("a-rol").value,
    valor_actual: parseFloat(document.getElementById("a-valor").value),
    moneda: document.getElementById("a-moneda").value,
    fecha_inicio: fechaInicio,
    fecha_fin_contrato: document.getElementById("a-fecha-fin").value || null,
    dia_pago: parseInt(document.getElementById("a-dia-pago").value) || 1,
    indice_actualizacion: document.getElementById("a-indice").value,
    porcentaje_fijo: document.getElementById("a-porcentaje-fijo").value
      ? parseFloat(document.getElementById("a-porcentaje-fijo").value)
      : null,
    periodo_actualizacion_meses: meses,
    proxima_actualizacion: proximaAct,
    valor_inmueble: document.getElementById("a-valor-inmueble").value
      ? parseFloat(document.getElementById("a-valor-inmueble").value)
      : null,
    notas: document.getElementById("a-notas").value.trim(),
  };

  try {
    if (id) {
      await apiFetch(`/api/alquileres/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await apiFetch("/api/alquileres", { method: "POST", body: JSON.stringify(payload) });
    }
    closeAlquilerModal();
    await loadAlquileres();
  } catch (err) {
    errEl.textContent = err.message || "Error al guardar";
    errEl.classList.remove("hidden");
  }
});

// ── Modal: pago ───────────────────────────────────────────────────────────────

function openPagoModal(alquilerId, montoEsperado = 0) {
  document.getElementById("pago-alquiler-id").value = alquilerId;
  document.getElementById("pago-form").reset();
  document.getElementById("pago-form-error").classList.add("hidden");
  document.getElementById("p-comprobante-preview").classList.add("hidden");

  // Setear período actual
  const now = new Date();
  document.getElementById("p-periodo").value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  document.getElementById("p-fecha").value = now.toISOString().slice(0, 10);
  document.getElementById("p-monto-esperado").value = montoEsperado || "";
  document.getElementById("p-monto-pagado").value = montoEsperado || "";

  document.getElementById("pago-modal").classList.remove("hidden");
  lucide.createIcons();
}

function closePagoModal() {
  document.getElementById("pago-modal").classList.add("hidden");
}

// Preview comprobante
document.getElementById("p-comprobante").addEventListener("change", (e) => {
  const file = e.target.files[0];
  const preview = document.getElementById("p-comprobante-preview");
  if (file) {
    preview.textContent = `✓ ${file.name}`;
    preview.classList.remove("hidden");
  } else {
    preview.classList.add("hidden");
  }
});

document.getElementById("pago-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("pago-form-error");
  errEl.classList.add("hidden");

  const alqId = document.getElementById("pago-alquiler-id").value;

  // Manejar comprobante
  let comprobante = null;
  const fileInput = document.getElementById("p-comprobante");
  if (fileInput.files[0]) {
    comprobante = await _fileToBase64(fileInput.files[0]);
  }

  const payload = {
    periodo: document.getElementById("p-periodo").value,
    monto_esperado: parseFloat(document.getElementById("p-monto-esperado").value),
    monto_pagado: document.getElementById("p-monto-pagado").value
      ? parseFloat(document.getElementById("p-monto-pagado").value)
      : null,
    fecha_pago: document.getElementById("p-fecha").value || null,
    estado: document.getElementById("p-estado").value,
    comprobante,
    notas: document.getElementById("p-notas").value.trim(),
  };

  try {
    await apiFetch(`/api/alquileres/${alqId}/pagos`, { method: "POST", body: JSON.stringify(payload) });
    closePagoModal();
    await loadAlquileres();
    // Si el detalle está abierto para este alquiler, recargar
    if (_currentAlquilerId === parseInt(alqId)) {
      await loadDetalleData(parseInt(alqId));
    }
  } catch (err) {
    errEl.textContent = err.message || "Error al registrar pago";
    errEl.classList.remove("hidden");
  }
});

// ── Modal: actualización ──────────────────────────────────────────────────────

async function openActualizacionModal(alquilerId) {
  document.getElementById("act-alquiler-id").value = alquilerId;
  document.getElementById("act-form-error").classList.add("hidden");

  const a = _alquileres.find((x) => x.id === alquilerId);
  if (!a) return;

  // Setear valores por defecto
  document.getElementById("act-fecha").value = new Date().toISOString().slice(0, 10);
  document.getElementById("act-indice").value = a.indice_actualizacion;
  document.getElementById("act-porcentaje").value = "";
  document.getElementById("act-valor-nuevo").value = "";
  document.getElementById("act-notas").value = "";

  // Mostrar proyección
  try {
    const proy = await apiFetch(`/api/alquileres/${alquilerId}/proyeccion`);
    renderProyeccion(a, proy);
  } catch (_) {}

  document.getElementById("actualizacion-modal").classList.remove("hidden");
  lucide.createIcons();
}

function closeActualizacionModal() {
  document.getElementById("actualizacion-modal").classList.add("hidden");
}

function renderProyeccion(a, proy) {
  const el = document.getElementById("act-proyeccion");
  const moneda = a.moneda === "USD" ? "U$S" : "$";
  const rows = Object.entries(proy.proyecciones || {})
    .map(([k, v]) => `<div class="flex justify-between text-xs">
      <span class="text-slate-500">${k} (+${v.porcentaje.toFixed(1)}%)</span>
      <span class="font-bold text-blue-700 dark:text-blue-300">${moneda} ${v.valor_proyectado.toLocaleString("es-AR", { minimumFractionDigits: 0 })}</span>
    </div>`)
    .join("");

  el.innerHTML = `
    <p class="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">Proyección para ${_periodoLabel(proy.periodo_meses)}</p>
    <div class="text-xs text-slate-600 dark:text-slate-300 mb-2 flex justify-between">
      <span>Valor actual</span><span class="font-semibold">${moneda} ${proy.valor_actual.toLocaleString("es-AR")}</span>
    </div>
    ${rows || '<p class="text-xs text-slate-400">Sin datos de índices disponibles.</p>'}
    <p class="text-xs text-slate-400 mt-2">Próxima actualización: ${proy.proxima_actualizacion || "—"}</p>`;
}

function recalcularNuevoValor() {
  const alqId = parseInt(document.getElementById("act-alquiler-id").value);
  const a = _alquileres.find((x) => x.id === alqId);
  if (!a) return;
  const pct = parseFloat(document.getElementById("act-porcentaje").value);
  if (!isNaN(pct)) {
    document.getElementById("act-valor-nuevo").value = (a.valor_actual * (1 + pct / 100)).toFixed(2);
  }
}

async function guardarActualizacion() {
  const errEl = document.getElementById("act-form-error");
  errEl.classList.add("hidden");

  const alqId = document.getElementById("act-alquiler-id").value;
  const pct = parseFloat(document.getElementById("act-porcentaje").value);
  const valNuevo = parseFloat(document.getElementById("act-valor-nuevo").value);

  if (isNaN(pct) || isNaN(valNuevo)) {
    errEl.textContent = "Completá el porcentaje y el nuevo valor";
    errEl.classList.remove("hidden");
    return;
  }

  const payload = {
    fecha: document.getElementById("act-fecha").value,
    valor_nuevo: valNuevo,
    indice_usado: document.getElementById("act-indice").value,
    porcentaje_aplicado: pct,
    notas: document.getElementById("act-notas").value.trim(),
  };

  try {
    await apiFetch(`/api/alquileres/${alqId}/actualizaciones`, { method: "POST", body: JSON.stringify(payload) });
    closeActualizacionModal();
    await loadAlquileres();
    if (_currentAlquilerId === parseInt(alqId)) {
      await loadDetalleData(parseInt(alqId));
    }
  } catch (err) {
    errEl.textContent = err.message || "Error al guardar actualización";
    errEl.classList.remove("hidden");
  }
}

// ── Modal: detalle ────────────────────────────────────────────────────────────

async function openDetalleModal(alquilerId) {
  _currentAlquilerId = alquilerId;
  const a = _alquileres.find((x) => x.id === alquilerId);
  document.getElementById("detalle-title").textContent = a ? a.nombre : "Detalle";

  // Conectar botones del tab
  document.getElementById("btn-nuevo-pago").onclick = () => openPagoModal(alquilerId, a?.valor_actual);
  document.getElementById("btn-nueva-actualizacion").onclick = () => {
    closeDetalleModal();
    openActualizacionModal(alquilerId);
  };
  document.getElementById("btn-nuevo-gasto").onclick = () => openGastoModal(alquilerId);

  document.getElementById("detalle-modal").classList.remove("hidden");
  switchTab("pagos");
  await loadDetalleData(alquilerId);
  lucide.createIcons();
}

function closeDetalleModal() {
  document.getElementById("detalle-modal").classList.add("hidden");
  _currentAlquilerId = null;
}

async function loadDetalleData(alquilerId) {
  if (_currentTab === "pagos") await loadPagos(alquilerId);
  else if (_currentTab === "actualizaciones") await loadActualizaciones(alquilerId);
  else if (_currentTab === "gastos") await loadGastos(alquilerId);
  else if (_currentTab === "roi") await loadROI(alquilerId);
}

function switchTab(tab) {
  _currentTab = tab;
  ["pagos", "actualizaciones", "gastos", "roi"].forEach((t) => {
    document.getElementById(`tab-${t}`).className =
      t === tab
        ? "tab-btn flex-1 text-xs font-medium px-3 py-1.5 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm transition"
        : "tab-btn flex-1 text-xs font-medium px-3 py-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition";
    document.getElementById(`panel-${t}`).classList.toggle("hidden", t !== tab);
  });
  if (_currentAlquilerId) loadDetalleData(_currentAlquilerId);
}

async function loadPagos(alquilerId) {
  const list = document.getElementById("pagos-list");
  list.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">Cargando...</p>';
  try {
    const pagos = await apiFetch(`/api/alquileres/${alquilerId}/pagos`);
    if (pagos.length === 0) {
      list.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">No hay pagos registrados</p>';
      return;
    }
    const estadoClases = {
      pagado: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
      pendiente: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
      atrasado: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    };
    list.innerHTML = pagos.map((p) => `
      <div class="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-3">
        <div>
          <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">${p.periodo}</span>
          <span class="ml-2 text-xs px-1.5 py-0.5 rounded ${estadoClases[p.estado] || "bg-slate-100 text-slate-500"}">${p.estado}</span>
          ${p.notas ? `<p class="text-xs text-slate-400 mt-0.5">${p.notas}</p>` : ""}
        </div>
        <div class="text-right flex items-center gap-3">
          <div>
            ${p.monto_pagado != null ? `<p class="text-sm font-bold text-slate-800 dark:text-white">${formatCurrency(p.monto_pagado)}</p>` : ""}
            <p class="text-xs text-slate-400">${p.fecha_pago ? formatDate(p.fecha_pago + "T00:00:00") : ""}</p>
          </div>
          ${p.comprobante ? `<a href="${p.comprobante}" target="_blank" class="text-blue-500 hover:text-blue-700" title="Ver comprobante"><i data-lucide="file-text" class="w-4 h-4"></i></a>` : ""}
          <button onclick="deletePago(${p.id})" class="text-slate-300 hover:text-red-500 transition"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>
      </div>`).join("");
    lucide.createIcons();
  } catch (e) {
    list.innerHTML = '<p class="text-xs text-red-400 text-center py-4">Error al cargar pagos</p>';
  }
}

async function loadActualizaciones(alquilerId) {
  const list = document.getElementById("actualizaciones-list");
  list.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">Cargando...</p>';
  try {
    const items = await apiFetch(`/api/alquileres/${alquilerId}/actualizaciones`);
    if (items.length === 0) {
      list.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">Sin actualizaciones registradas</p>';
      return;
    }
    list.innerHTML = items.map((u) => `
      <div class="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-3">
        <div>
          <p class="text-xs font-semibold text-slate-700 dark:text-slate-300">${u.fecha} · <span class="text-amber-600 dark:text-amber-400">${u.indice_usado}</span></p>
          <p class="text-xs text-slate-400 mt-0.5">${formatCurrency(u.valor_anterior)} → <span class="font-semibold text-slate-700 dark:text-slate-300">${formatCurrency(u.valor_nuevo)}</span></p>
          ${u.notas ? `<p class="text-xs text-slate-400">${u.notas}</p>` : ""}
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm font-bold text-emerald-600 dark:text-emerald-400">+${u.porcentaje_aplicado.toFixed(1)}%</span>
          <button onclick="deleteActualizacion(${u.id})" class="text-slate-300 hover:text-red-500 transition"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>
      </div>`).join("");
    lucide.createIcons();
  } catch (e) {
    list.innerHTML = '<p class="text-xs text-red-400 text-center py-4">Error al cargar</p>';
  }
}

async function loadGastos(alquilerId) {
  const list = document.getElementById("gastos-list");
  list.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">Cargando...</p>';
  try {
    const items = await apiFetch(`/api/alquileres/${alquilerId}/gastos`);
    if (items.length === 0) {
      list.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">Sin gastos registrados</p>';
      return;
    }
    const tipoIcon = { expensa: "🏢", impuesto: "📋", seguro: "🛡️", mantenimiento: "🔧", otro: "📦" };
    list.innerHTML = items.map((g) => `
      <div class="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-3">
        <div>
          <p class="text-xs font-semibold text-slate-700 dark:text-slate-300">${tipoIcon[g.tipo] || "📦"} ${g.descripcion}</p>
          <p class="text-xs text-slate-400">${g.fecha}${g.periodo ? " · " + g.periodo : ""}</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm font-bold text-slate-700 dark:text-slate-300">${formatCurrency(g.monto)}</span>
          <button onclick="deleteGasto(${g.id})" class="text-slate-300 hover:text-red-500 transition"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>
      </div>`).join("");
    lucide.createIcons();
  } catch (e) {
    list.innerHTML = '<p class="text-xs text-red-400 text-center py-4">Error al cargar</p>';
  }
}

async function loadROI(alquilerId) {
  const el = document.getElementById("roi-content");
  const a = _alquileres.find((x) => x.id === alquilerId);
  if (!a || a.rol !== "propietario") {
    el.innerHTML = '<p class="text-sm text-slate-400 text-center py-8">El cálculo de ROI está disponible solo para propietarios.</p>';
    return;
  }
  if (!a.valor_inmueble) {
    el.innerHTML = `<p class="text-sm text-slate-400 text-center py-4">Completá el valor del inmueble en los datos del alquiler para calcular el ROI.</p>
    <button onclick="closeDetalleModal(); openAlquilerModal(${alquilerId})" class="block mx-auto mt-3 text-xs bg-blue-600 text-white px-4 py-2 rounded-lg">Editar alquiler</button>`;
    return;
  }
  el.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">Calculando...</p>';
  try {
    const roi = await apiFetch(`/api/alquileres/${alquilerId}/roi`);
    el.innerHTML = `
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-center">
          <p class="text-xs text-slate-400 mb-1">ROI Bruto anual</p>
          <p class="text-3xl font-bold text-blue-600 dark:text-blue-400">${roi.roi_bruto_pct.toFixed(2)}%</p>
        </div>
        <div class="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-center">
          <p class="text-xs text-slate-400 mb-1">ROI Neto anual</p>
          <p class="text-3xl font-bold text-emerald-600 dark:text-emerald-400">${roi.roi_neto_pct.toFixed(2)}%</p>
        </div>
      </div>
      <div class="space-y-2 text-sm mt-4">
        <div class="flex justify-between"><span class="text-slate-500">Valor del inmueble</span><span class="font-medium">${formatCurrency(roi.valor_inmueble)}</span></div>
        <div class="flex justify-between"><span class="text-slate-500">Renta mensual</span><span class="font-medium">${formatCurrency(roi.renta_mensual)}</span></div>
        <div class="flex justify-between"><span class="text-slate-500">Renta anual bruta</span><span class="font-medium">${formatCurrency(roi.renta_anual_bruta)}</span></div>
        <div class="flex justify-between"><span class="text-slate-500">Gastos anuales</span><span class="font-medium text-red-500">- ${formatCurrency(roi.gastos_anuales)}</span></div>
        <div class="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 mt-2"><span class="font-semibold text-slate-700 dark:text-slate-300">Renta neta anual</span><span class="font-bold">${formatCurrency(roi.renta_anual_neta)}</span></div>
      </div>`;
  } catch (e) {
    el.innerHTML = `<p class="text-sm text-red-400 text-center py-4">${e.message || "Error al calcular ROI"}</p>`;
  }
}

// ── Modal: gasto ──────────────────────────────────────────────────────────────

function openGastoModal(alquilerId) {
  document.getElementById("gasto-alquiler-id").value = alquilerId;
  document.getElementById("gasto-form").reset();
  document.getElementById("gasto-form-error").classList.add("hidden");
  document.getElementById("g-fecha").value = new Date().toISOString().slice(0, 10);
  const now = new Date();
  document.getElementById("g-periodo").value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  document.getElementById("gasto-modal").classList.remove("hidden");
  lucide.createIcons();
}

function closeGastoModal() {
  document.getElementById("gasto-modal").classList.add("hidden");
}

document.getElementById("gasto-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("gasto-form-error");
  errEl.classList.add("hidden");
  const alqId = document.getElementById("gasto-alquiler-id").value;

  const payload = {
    descripcion: document.getElementById("g-descripcion").value.trim(),
    monto: parseFloat(document.getElementById("g-monto").value),
    fecha: document.getElementById("g-fecha").value,
    tipo: document.getElementById("g-tipo").value,
    periodo: document.getElementById("g-periodo").value || null,
    notas: document.getElementById("g-notas").value.trim(),
  };

  try {
    await apiFetch(`/api/alquileres/${alqId}/gastos`, { method: "POST", body: JSON.stringify(payload) });
    closeGastoModal();
    if (_currentAlquilerId === parseInt(alqId)) {
      await loadDetalleData(parseInt(alqId));
    }
  } catch (err) {
    errEl.textContent = err.message || "Error al guardar";
    errEl.classList.remove("hidden");
  }
});

// ── Eliminar ──────────────────────────────────────────────────────────────────

function confirmDelete(id, nombre) {
  document.getElementById("confirm-msg").textContent = `¿Eliminar el alquiler "${nombre}"? Se borrarán todos los pagos, actualizaciones y gastos asociados.`;
  document.getElementById("confirm-ok").onclick = async () => {
    document.getElementById("confirm-modal").classList.add("hidden");
    try {
      await apiFetch(`/api/alquileres/${id}`, { method: "DELETE" });
      await loadAlquileres();
    } catch (e) {
      alert(e.message);
    }
  };
  document.getElementById("confirm-modal").classList.remove("hidden");
  lucide.createIcons();
}

async function deletePago(pagoId) {
  if (!confirm("¿Eliminar este pago?")) return;
  try {
    await apiFetch(`/api/alquileres/pagos/${pagoId}`, { method: "DELETE" });
    await loadPagos(_currentAlquilerId);
    await loadAlquileres();
  } catch (e) {
    alert(e.message);
  }
}

async function deleteActualizacion(actId) {
  if (!confirm("¿Eliminar esta actualización? El valor actual del alquiler NO se revertirá automáticamente.")) return;
  try {
    await apiFetch(`/api/alquileres/actualizaciones/${actId}`, { method: "DELETE" });
    await loadActualizaciones(_currentAlquilerId);
  } catch (e) {
    alert(e.message);
  }
}

async function deleteGasto(gastoId) {
  if (!confirm("¿Eliminar este gasto?")) return;
  try {
    await apiFetch(`/api/alquileres/gastos/${gastoId}`, { method: "DELETE" });
    await loadGastos(_currentAlquilerId);
  } catch (e) {
    alert(e.message);
  }
}

// ── Utilidades ────────────────────────────────────────────────────────────────

function _periodoLabel(meses) {
  return { 3: "Trimestral", 4: "Cuatrimestral", 6: "Semestral", 12: "Anual" }[meses] || `${meses}m`;
}

function _fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
