requireAuth();
initPageCommons();

const CAT_ICON = {
  Electricidad: "⚡",
  Gas: "🔥",
  Agua: "💧",
  Internet: "🌐",
  Telefonia: "📱",
  Streaming: "📺",
  Seguro: "🛡️",
  Alquiler: "🏠",
  Expensas: "🏢",
  Suscripcion: "📧",
  Otros: "💡",
};

const FRECUENCIA_LABEL = {
  mensual: "Mensual",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

const FRECUENCIA_FACTOR = {
  mensual: 1,
  bimestral: 0.5,
  trimestral: 1 / 3,
  semestral: 1 / 6,
  anual: 1 / 12,
};

let allServicios = [];
let allNotifs = [];
let currentTab = "todos";
let currentCat = "todas";
let editingId = null;

// ── Carga inicial ─────────────────────────────────────────────────────────────

async function loadAll() {
  await Promise.all([loadServicios(), loadNotificaciones()]);
}

async function loadServicios() {
  try {
    allServicios = await apiFetch("/api/servicios");
    // Ordenar: activos primero por urgencia, luego inactivos
    allServicios.sort((a, b) => {
      if (a.activo && !b.activo) return -1;
      if (!a.activo && b.activo) return 1;
      return (a.dias_restantes ?? 99999) - (b.dias_restantes ?? 99999);
    });
    renderKPIs();
    renderCatFilters();
    renderGrid();
    renderAlertas();
  } catch (e) {
    document.getElementById("servicios-grid").innerHTML =
      `<p class="text-red-500 text-sm col-span-full">${e.message}</p>`;
  }
}

async function loadNotificaciones() {
  try {
    allNotifs = await apiFetch("/api/servicios/notificaciones");
    renderNotifs();
  } catch (_) {}
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

function renderKPIs() {
  const activos = allServicios.filter((s) => s.activo);
  const mensual = activos.reduce(
    (sum, s) => sum + s.monto * (FRECUENCIA_FACTOR[s.frecuencia] ?? 1),
    0
  );
  const anual = mensual * 12;
  const proximos = activos.filter(
    (s) => s.dias_restantes !== null && s.dias_restantes >= 0 && s.dias_restantes <= 7
  ).length;

  document.getElementById("kpi-mensual").textContent = formatCurrency(mensual);
  document.getElementById("kpi-anual").textContent = formatCurrency(anual);
  document.getElementById("kpi-proximos").textContent = proximos;
  document.getElementById("kpi-activos").textContent = activos.length;
}

// ── Alertas urgentes ──────────────────────────────────────────────────────────

function renderAlertas() {
  const container = document.getElementById("alertas-container");
  const urgentes = allServicios.filter(
    (s) => s.activo && s.dias_restantes !== null && s.dias_restantes <= 2
  );

  if (urgentes.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = urgentes
    .map((s) => {
      const overdue = s.dias_restantes < 0;
      const bg = overdue
        ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
        : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300";
      const icono = overdue ? "⚠️" : "🔔";
      let msg;
      if (overdue) {
        msg = `${icono} <strong>${s.nombre}</strong> venció hace ${Math.abs(s.dias_restantes)} día(s). Registrá el pago.`;
      } else if (s.dias_restantes === 0) {
        msg = `${icono} <strong>${s.nombre}</strong> vence <strong>hoy</strong>. ${s.monto_variable ? "Monto variable." : `Monto: ${formatCurrency(s.monto)}`}`;
      } else {
        msg = `${icono} <strong>${s.nombre}</strong> vence en <strong>${s.dias_restantes} día(s)</strong>. ${s.monto_variable ? "Monto variable." : `Monto estimado: ${formatCurrency(s.monto)}`}`;
      }
      return `<div class="flex items-center gap-3 px-4 py-3 rounded-lg border ${bg} text-sm">
        <span class="flex-1">${msg}</span>
        <button onclick="openPagarModal(${s.id})" class="shrink-0 px-3 py-1 rounded-md bg-white/60 dark:bg-black/20 border border-current text-xs font-medium hover:bg-white/80 transition">Pagar</button>
      </div>`;
    })
    .join("");
}

// ── Filtros de categoría ──────────────────────────────────────────────────────

function renderCatFilters() {
  const cats = [...new Set(allServicios.map((s) => s.categoria))].sort();
  const container = document.getElementById("cat-filters");

  if (cats.length === 0) {
    container.innerHTML = "";
    return;
  }

  const btnBase =
    "px-3 py-1.5 rounded-lg text-xs font-medium border transition";
  const active = "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-800 dark:border-slate-200";
  const inactive =
    "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500";

  container.innerHTML =
    `<button onclick="setCat('todas')" class="${btnBase} ${currentCat === 'todas' ? active : inactive}">Todas</button>` +
    cats
      .map(
        (c) =>
          `<button onclick="setCat('${c}')" class="${btnBase} ${currentCat === c ? active : inactive}">${CAT_ICON[c] || "💡"} ${c}</button>`
      )
      .join("");
}

function setCat(cat) {
  currentCat = cat;
  renderCatFilters();
  renderGrid();
}

// ── Grid ──────────────────────────────────────────────────────────────────────

function setTab(tab) {
  currentTab = tab;
  ["todos", "activos", "inactivos"].forEach((t) => {
    document.getElementById(`tab-${t}`).className =
      t === tab
        ? "px-4 py-1.5 rounded-md text-sm font-medium bg-blue-700 text-white transition"
        : "px-4 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition";
  });
  renderGrid();
}

function renderGrid() {
  let items = allServicios;
  if (currentTab === "activos") items = items.filter((s) => s.activo);
  if (currentTab === "inactivos") items = items.filter((s) => !s.activo);
  if (currentCat !== "todas") items = items.filter((s) => s.categoria === currentCat);

  const grid = document.getElementById("servicios-grid");

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
        <i data-lucide="zap-off" class="w-10 h-10"></i>
        <p class="text-sm">No hay servicios que coincidan</p>
        <button onclick="openModal()" class="text-sm text-blue-600 dark:text-blue-400 hover:underline">+ Agregar servicio</button>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  grid.innerHTML = items.map((s) => servicioCard(s)).join("");
  if (window.lucide) lucide.createIcons();
}

function diasBadge(s) {
  if (!s.activo) return { text: "Inactivo", cls: "bg-slate-100 dark:bg-slate-800 text-slate-400" };
  if (s.dias_restantes === null) return { text: "Sin fecha", cls: "bg-slate-100 dark:bg-slate-800 text-slate-500" };
  if (s.dias_restantes < 0) return { text: `Venció hace ${Math.abs(s.dias_restantes)}d`, cls: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" };
  if (s.dias_restantes === 0) return { text: "Vence hoy", cls: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" };
  if (s.dias_restantes <= 2) return { text: `Vence en ${s.dias_restantes}d`, cls: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300" };
  if (s.dias_restantes <= 7) return { text: `Vence en ${s.dias_restantes}d`, cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" };
  return { text: `Vence en ${s.dias_restantes}d`, cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" };
}

function servicioCard(s) {
  const icono = CAT_ICON[s.categoria] || "💡";
  const freqLabel = FRECUENCIA_LABEL[s.frecuencia] || s.frecuencia;
  const { text: badgeText, cls: badgeCls } = diasBadge(s);
  const fechaStr = s.proximo_vencimiento
    ? new Date(s.proximo_vencimiento + "T12:00:00").toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";
  const opacidad = s.activo ? "" : "opacity-60";
  const montoLabel = s.monto_variable ? "referencial" : "estimado";
  const pagoIcono = s.pagado_mes_actual
    ? `<span class="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>Pagado</span>`
    : "";

  const linkBtn = s.link_pago
    ? `<a href="${s.link_pago}" target="_blank" rel="noopener noreferrer"
        class="px-2 text-xs font-medium py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        title="Ir a pago online"><i data-lucide="external-link" class="w-3.5 h-3.5"></i></a>`
    : "";

  return `
    <div class="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-5 flex flex-col gap-3 ${opacidad}">
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-2xl shrink-0">${icono}</span>
          <div class="min-w-0">
            <p class="font-semibold text-slate-800 dark:text-white text-sm leading-tight truncate">${s.nombre}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">${s.categoria} · ${freqLabel}</p>
          </div>
        </div>
        <span class="text-xs px-2 py-0.5 rounded-full ${badgeCls} font-medium shrink-0 whitespace-nowrap">${badgeText}</span>
      </div>

      <div class="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p class="font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px]">Monto ${montoLabel}</p>
          <p class="text-slate-800 dark:text-white font-semibold text-sm mt-0.5">${formatCurrency(s.monto)}</p>
        </div>
        <div>
          <p class="font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px]">Próx. vencimiento</p>
          <p class="text-slate-700 dark:text-slate-300 mt-0.5">Día ${s.dia_vencimiento} · ${fechaStr}</p>
        </div>
      </div>

      ${s.numero_cuenta ? `<p class="text-xs text-slate-400 dark:text-slate-500"><span class="font-medium">Cuenta/CBU:</span> ${s.numero_cuenta}</p>` : ""}
      ${s.notas ? `<p class="text-xs text-slate-400 dark:text-slate-500 italic truncate">${s.notas}</p>` : ""}
      ${pagoIcono}

      <div class="flex gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
        ${s.activo ? `
        <button onclick="openPagarModal(${s.id})"
          class="flex-1 text-xs font-medium py-1.5 rounded-md border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition">
          ✓ Pagar
        </button>` : ""}
        <button onclick="openHistorialModal(${s.id}, '${s.nombre.replace(/'/g, "\\'")}')"
          class="flex-1 text-xs font-medium py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
          Historial
        </button>
        ${linkBtn}
        <button onclick="openEdit(${s.id})"
          class="flex-1 text-xs font-medium py-1.5 rounded-md border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
          Editar
        </button>
        <button onclick="toggleActivo(${s.id}, ${s.activo})"
          class="px-2.5 text-xs font-medium py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          title="${s.activo ? 'Pausar' : 'Activar'}">
          <i data-lucide="${s.activo ? 'pause' : 'play'}" class="w-3.5 h-3.5"></i>
        </button>
        <button onclick="deleteServicio(${s.id}, '${s.nombre.replace(/'/g, "\\'")}')"
          class="px-2.5 text-xs font-medium py-1.5 rounded-md border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    </div>`;
}

// ── Notificaciones ────────────────────────────────────────────────────────────

function renderNotifs() {
  const unread = allNotifs.filter((n) => !n.leida);
  const panel = document.getElementById("notifs-panel");
  const list = document.getElementById("notifs-list");

  if (unread.length === 0) {
    panel.classList.add("hidden");
    return;
  }

  panel.classList.remove("hidden");
  list.innerHTML = unread
    .map(
      (n) => `
    <div class="flex items-start gap-3 px-5 py-3">
      <p class="flex-1 text-sm text-slate-700 dark:text-slate-300">${n.mensaje}</p>
      <button onclick="leerNotif(${n.id})" class="shrink-0 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition mt-0.5">✓</button>
    </div>`
    )
    .join("");
  if (window.lucide) lucide.createIcons();
}

async function leerNotif(id) {
  try {
    await apiFetch(`/api/servicios/notificaciones/${id}/leer`, { method: "PATCH" });
    allNotifs = allNotifs.map((n) => (n.id === id ? { ...n, leida: true } : n));
    renderNotifs();
    actualizarBadge();
  } catch (_) {}
}

async function leerTodas() {
  try {
    await apiFetch("/api/servicios/notificaciones/leer-todas", { method: "PATCH" });
    allNotifs = allNotifs.map((n) => ({ ...n, leida: true }));
    renderNotifs();
    actualizarBadge();
  } catch (_) {}
}

function actualizarBadge() {
  const badge = document.getElementById("notif-badge");
  if (!badge) return;
  const unread = allNotifs.filter((n) => !n.leida).length;
  if (unread > 0) {
    badge.textContent = unread > 9 ? "9+" : String(unread);
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

// ── Modal agregar / editar ────────────────────────────────────────────────────

function openModal() {
  editingId = null;
  document.getElementById("modal-title").textContent = "Nuevo servicio";
  document.getElementById("servicio-form").reset();
  document.getElementById("modal-error").classList.add("hidden");
  document.getElementById("monto-variable-hint").classList.add("hidden");
  document.getElementById("modal").classList.remove("hidden");
}

function openEdit(id) {
  const s = allServicios.find((x) => x.id === id);
  if (!s) return;
  editingId = id;
  document.getElementById("modal-title").textContent = "Editar servicio";
  document.getElementById("modal-error").classList.add("hidden");
  document.getElementById("s-nombre").value = s.nombre;
  document.getElementById("s-categoria").value = s.categoria;
  document.getElementById("s-monto").value = s.monto;
  document.getElementById("s-monto-variable").checked = s.monto_variable || false;
  document.getElementById("monto-variable-hint").classList.toggle("hidden", !s.monto_variable);
  document.getElementById("s-dia").value = s.dia_vencimiento;
  document.getElementById("s-frecuencia").value = s.frecuencia;
  document.getElementById("s-cuenta").value = s.numero_cuenta || "";
  document.getElementById("s-link").value = s.link_pago || "";
  document.getElementById("s-notas").value = s.notas || "";
  document.getElementById("modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
  editingId = null;
}

document.getElementById("s-monto-variable").addEventListener("change", (e) => {
  document.getElementById("monto-variable-hint").classList.toggle("hidden", !e.target.checked);
});

document.getElementById("servicio-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("modal-error");
  errEl.classList.add("hidden");

  const payload = {
    nombre: document.getElementById("s-nombre").value.trim(),
    categoria: document.getElementById("s-categoria").value,
    monto: parseFloat(document.getElementById("s-monto").value),
    monto_variable: document.getElementById("s-monto-variable").checked,
    dia_vencimiento: parseInt(document.getElementById("s-dia").value),
    frecuencia: document.getElementById("s-frecuencia").value,
    numero_cuenta: document.getElementById("s-cuenta").value.trim(),
    link_pago: document.getElementById("s-link").value.trim(),
    notas: document.getElementById("s-notas").value.trim(),
  };

  const btn = e.target.querySelector('[type="submit"]');
  btn.disabled = true;
  btn.textContent = "Guardando...";

  try {
    if (editingId) {
      await apiFetch(`/api/servicios/${editingId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch("/api/servicios", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    closeModal();
    await loadServicios();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar";
  }
});

// ── Modal pagar ───────────────────────────────────────────────────────────────

function openPagarModal(id) {
  const s = allServicios.find((x) => x.id === id);
  if (!s) return;

  const today = new Date().toISOString().split("T")[0];
  const periodoStr = s.proximo_vencimiento
    ? s.proximo_vencimiento.slice(0, 7)
    : today.slice(0, 7);
  const [py, pm] = periodoStr.split("-");
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const periodoLabel = `${meses[parseInt(pm) - 1]} ${py}`;

  document.getElementById("pagar-servicio-id").value = s.id;
  document.getElementById("pagar-periodo-value").value = periodoStr;
  document.getElementById("pagar-nombre").textContent = `${CAT_ICON[s.categoria] || "💡"} ${s.nombre}`;
  document.getElementById("pagar-periodo").textContent = `Período: ${periodoLabel}`;
  document.getElementById("pagar-monto").value = s.monto;
  document.getElementById("pagar-fecha").value = today;
  document.getElementById("pagar-notas").value = "";
  document.getElementById("pagar-error").classList.add("hidden");
  document.getElementById("modal-pagar").classList.remove("hidden");
}

function closePagarModal() {
  document.getElementById("modal-pagar").classList.add("hidden");
}

document.getElementById("pagar-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("pagar-error");
  errEl.classList.add("hidden");

  const servicioId = document.getElementById("pagar-servicio-id").value;
  const payload = {
    monto_pagado: parseFloat(document.getElementById("pagar-monto").value),
    fecha_pago: document.getElementById("pagar-fecha").value,
    periodo: document.getElementById("pagar-periodo-value").value,
    notas: document.getElementById("pagar-notas").value.trim(),
  };

  const btn = e.target.querySelector('[type="submit"]');
  btn.disabled = true;
  btn.textContent = "Guardando...";

  try {
    await apiFetch(`/api/servicios/${servicioId}/pagar`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    closePagarModal();
    await Promise.all([loadServicios(), loadNotificaciones()]);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirmar pago";
  }
});

// ── Modal historial ───────────────────────────────────────────────────────────

async function openHistorialModal(id, nombre) {
  document.getElementById("historial-nombre").textContent = nombre;
  document.getElementById("historial-body").innerHTML =
    '<p class="px-6 py-4 text-slate-400 text-sm">Cargando...</p>';
  document.getElementById("modal-historial").classList.remove("hidden");

  try {
    const pagos = await apiFetch(`/api/servicios/${id}/pagos`);
    renderHistorial(pagos, id);
  } catch (e) {
    document.getElementById("historial-body").innerHTML =
      `<p class="px-6 py-4 text-red-500 text-sm">${e.message}</p>`;
  }
}

function renderHistorial(pagos, servicioId) {
  const body = document.getElementById("historial-body");
  if (pagos.length === 0) {
    body.innerHTML =
      '<p class="px-6 py-8 text-slate-400 text-sm text-center">No hay pagos registrados</p>';
    return;
  }

  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  body.innerHTML = `
    <table class="w-full text-sm">
      <thead>
        <tr class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
          <th class="px-5 py-3 text-left">Período</th>
          <th class="px-5 py-3 text-left">Fecha pago</th>
          <th class="px-5 py-3 text-right">Monto</th>
          <th class="px-5 py-3 text-left">Notas</th>
          <th class="px-5 py-3"></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
        ${pagos
          .map((p) => {
            const [py, pm] = p.periodo.split("-");
            const periodoLabel = `${meses[parseInt(pm) - 1]} ${py}`;
            const fechaLabel = new Date(p.fecha_pago + "T12:00:00").toLocaleDateString("es-AR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
            return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <td class="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">${periodoLabel}</td>
              <td class="px-5 py-3 text-slate-500 dark:text-slate-400">${fechaLabel}</td>
              <td class="px-5 py-3 text-right font-semibold text-slate-800 dark:text-white">${formatCurrency(p.monto_pagado)}</td>
              <td class="px-5 py-3 text-slate-400 text-xs italic max-w-[120px] truncate">${p.notas || "—"}</td>
              <td class="px-5 py-3">
                <button onclick="deletePago(${p.id}, ${servicioId})" class="text-red-400 hover:text-red-600 dark:hover:text-red-300 transition">
                  <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>
              </td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>`;
  if (window.lucide) lucide.createIcons();
}

async function deletePago(pagoId, servicioId) {
  if (!confirm("¿Eliminar este registro de pago?")) return;
  try {
    await apiFetch(`/api/servicios/pagos/${pagoId}`, { method: "DELETE" });
    const pagos = await apiFetch(`/api/servicios/${servicioId}/pagos`);
    renderHistorial(pagos, servicioId);
    await loadServicios();
  } catch (e) {
    alert(e.message);
  }
}

function closeHistorialModal() {
  document.getElementById("modal-historial").classList.add("hidden");
}

// ── Acciones de tarjeta ───────────────────────────────────────────────────────

async function toggleActivo(id, actual) {
  try {
    await apiFetch(`/api/servicios/${id}`, {
      method: "PUT",
      body: JSON.stringify({ activo: !actual }),
    });
    await loadServicios();
  } catch (e) {
    alert(e.message);
  }
}

async function deleteServicio(id, nombre) {
  if (!confirm(`¿Eliminar el servicio "${nombre}"? También se eliminarán todos sus pagos.`)) return;
  try {
    await apiFetch(`/api/servicios/${id}`, { method: "DELETE" });
    await loadServicios();
  } catch (e) {
    alert(e.message);
  }
}

// ── Cerrar modales al hacer click fuera ──────────────────────────────────────

["modal", "modal-pagar", "modal-historial"].forEach((id) => {
  document.getElementById(id).addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.classList.add("hidden");
      if (id === "modal") editingId = null;
    }
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────

loadAll();
