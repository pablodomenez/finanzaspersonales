requireAuth();
initPageCommons();

let allPromos = [];
let allPeriodicas = [];
let currentTab = "todas";
let editingId = null;
let editingPeriodicaId = null;

const DIAS_NOMBRE = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

async function loadPromos() {
  try {
    [allPromos, allPeriodicas] = await Promise.all([
      apiFetch("/api/promociones"),
      apiFetch("/api/promociones/periodicas"),
    ]);
    renderKPIs();
    renderGrid();
    await loadNotificaciones();
  } catch (e) {
    document.getElementById("promos-grid").innerHTML =
      `<p class="text-red-500 text-sm col-span-full">Error al cargar promociones.</p>`;
  }
}

function renderKPIs() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const en7 = new Date(today); en7.setDate(en7.getDate() + 7);
  const en30 = new Date(today); en30.setDate(en30.getDate() + 30);

  const vigentes = allPromos.filter(p => p.activa && !p.vencida);
  const semana = vigentes.filter(p => {
    const fin = new Date(p.fecha_fin_promo);
    return fin >= today && fin <= en7;
  });
  const mes = vigentes.filter(p => {
    const fin = new Date(p.fecha_fin_promo);
    return fin >= today && fin <= en30;
  });

  const ahorro = vigentes.reduce((acc, p) => {
    if (p.ahorro_mensual && p.ahorro_mensual > 0) acc += p.ahorro_mensual;
    return acc;
  }, 0);

  document.getElementById("kpi-vigentes").textContent = vigentes.length;
  document.getElementById("kpi-ahorro").textContent = ahorro > 0 ? formatCurrency(ahorro) : "—";
  document.getElementById("kpi-semana").textContent = semana.length;
  document.getElementById("kpi-mes").textContent = mes.length;
}

function setTab(tab) {
  currentTab = tab;
  const allTabs = ["hoy", "todas", "vigentes", "por-vencer", "vencidas", "recurrentes"];

  allTabs.forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    if (!btn) return;
    if (t === tab) {
      if (t === "hoy") {
        btn.className = "px-4 py-1.5 rounded-md text-sm font-medium bg-violet-600 text-white transition flex items-center gap-1.5";
      } else if (t === "recurrentes") {
        btn.className = "px-4 py-1.5 rounded-md text-sm font-medium bg-violet-600 text-white transition";
      } else {
        btn.className = "px-4 py-1.5 rounded-md text-sm font-medium bg-amber-500 text-white transition";
      }
    } else {
      if (t === "hoy") {
        btn.className = "px-4 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5";
      } else {
        btn.className = "px-4 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition";
      }
    }
  });

  // Mostrar/ocultar secciones y botones de header
  const esHoy = tab === "hoy";
  const esRecurrentes = tab === "recurrentes";
  const esPromoRegular = !esHoy && !esRecurrentes;

  document.getElementById("promos-section").classList.toggle("hidden", !esPromoRegular);
  document.getElementById("hoy-section").classList.toggle("hidden", !esHoy);
  document.getElementById("recurrentes-section").classList.toggle("hidden", !esRecurrentes);
  document.getElementById("btn-nueva-promo").classList.toggle("hidden", !esPromoRegular);
  document.getElementById("btn-nueva-periodica").classList.toggle("hidden", !esRecurrentes);

  if (esHoy) {
    renderHoy();
  } else if (esRecurrentes) {
    renderRecurrentes();
  } else {
    renderGrid();
  }
}

// ── Grid de promos regulares ──────────────────────────────────────────────────

function renderGrid() {
  const grid = document.getElementById("promos-grid");
  const alertas = document.getElementById("alertas-container");
  alertas.innerHTML = "";

  let filtered = allPromos;
  if (currentTab === "vigentes") {
    filtered = allPromos.filter(p => p.activa && !p.vencida);
  } else if (currentTab === "por-vencer") {
    filtered = allPromos.filter(p => p.activa && !p.vencida && p.dias_restantes !== null && p.dias_restantes <= 7);
  } else if (currentTab === "vencidas") {
    filtered = allPromos.filter(p => p.vencida);
  }

  // Alertas urgentes (≤ 7 días)
  const urgentes = allPromos.filter(p => p.activa && !p.vencida && p.dias_restantes !== null && p.dias_restantes <= 7);
  urgentes.forEach(p => {
    const dias = p.dias_restantes;
    const color = dias <= 2 ? "red" : "amber";
    alertas.innerHTML += `
      <div class="flex items-center gap-3 px-4 py-3 rounded-lg bg-${color}-50 dark:bg-${color}-900/20 border border-${color}-200 dark:border-${color}-800 text-${color}-700 dark:text-${color}-300 text-sm">
        <i data-lucide="alert-triangle" class="w-4 h-4 shrink-0"></i>
        <span>
          <strong>${p.servicio_nombre}</strong> — la promo vence
          ${dias === 0 ? "hoy" : dias === 1 ? "mañana" : `en ${dias} días`}
          (${formatDate(p.fecha_fin_promo)}).
          ${p.telefono_contacto ? `Llamá al <strong>${p.telefono_contacto}</strong>` : ""}
          ${p.link_contacto ? `<a href="${p.link_contacto}" target="_blank" class="underline ml-1">Renovar online</a>` : ""}
        </span>
      </div>`;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<p class="text-slate-400 text-sm col-span-full py-8 text-center">No hay promociones en esta categoría.</p>`;
    lucide.createIcons();
    return;
  }

  grid.innerHTML = filtered.map(renderCard).join("");
  lucide.createIcons();
}

function renderCard(p) {
  const dias = p.dias_restantes;
  let urgencyBadge = "";
  let cardBorder = "border-slate-200 dark:border-slate-700";

  if (p.vencida) {
    urgencyBadge = `<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">Vencida</span>`;
    cardBorder = "border-slate-300 dark:border-slate-600 opacity-70";
  } else if (dias !== null && dias <= 7) {
    urgencyBadge = `<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">⚠️ Vence en ${dias === 0 ? "hoy" : dias === 1 ? "1 día" : `${dias} días`}</span>`;
    cardBorder = "border-red-300 dark:border-red-700";
  } else if (dias !== null && dias <= 30) {
    urgencyBadge = `<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Vence en ${dias} días</span>`;
    cardBorder = "border-amber-300 dark:border-amber-700";
  } else {
    urgencyBadge = `<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">Vigente</span>`;
  }

  let ahorroHtml = "";
  if (p.ahorro_mensual && p.ahorro_mensual > 0) {
    let totalAhorradoHtml = "";
    if (p.fecha_inicio_promo) {
      const inicio = new Date(p.fecha_inicio_promo);
      const hoy = new Date();
      const meses = Math.max(1, (hoy.getFullYear() * 12 + hoy.getMonth()) - (inicio.getFullYear() * 12 + inicio.getMonth()) + 1);
      const totalAhorrado = meses * p.ahorro_mensual;
      totalAhorradoHtml = ` · <span class="text-slate-400">Total ahorrado: ${formatCurrency(totalAhorrado)}</span>`;
    }
    ahorroHtml = `<div class="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Ahorrás ${formatCurrency(p.ahorro_mensual)}/mes${totalAhorradoHtml}</div>`;
  }

  const contacto = [];
  if (p.telefono_contacto) {
    contacto.push(`<a href="tel:${p.telefono_contacto}" class="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"><i data-lucide="phone" class="w-3 h-3"></i>${p.telefono_contacto}</a>`);
  }
  if (p.link_contacto) {
    contacto.push(`<a href="${p.link_contacto}" target="_blank" class="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"><i data-lucide="external-link" class="w-3 h-3"></i>Renovar online</a>`);
  }

  return `
    <div class="bg-white dark:bg-slate-900 rounded-lg border ${cardBorder} p-5 flex flex-col gap-3" data-id="${p.id}">
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-2xl">${p.icono}</span>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-800 dark:text-white truncate">${p.servicio_nombre}</p>
            ${p.categoria ? `<p class="text-xs text-slate-400">${p.categoria}</p>` : ""}
          </div>
        </div>
        ${urgencyBadge}
      </div>

      ${p.descripcion_promo ? `<p class="text-xs text-slate-500 dark:text-slate-400 italic">"${p.descripcion_promo}"</p>` : ""}

      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="bg-slate-50 dark:bg-slate-800 rounded-md px-3 py-2">
          <p class="text-slate-400 mb-0.5">Pago con promo</p>
          <p class="font-bold text-slate-800 dark:text-white text-base">${formatCurrency(p.monto_con_promo)}</p>
        </div>
        <div class="bg-slate-50 dark:bg-slate-800 rounded-md px-3 py-2">
          <p class="text-slate-400 mb-0.5">Sin promo</p>
          <p class="font-bold text-slate-500 dark:text-slate-400 text-base">${p.monto_sin_promo ? formatCurrency(p.monto_sin_promo) : "—"}</p>
        </div>
      </div>

      ${ahorroHtml ? `<div>${ahorroHtml}</div>` : ""}

      <div class="space-y-1 text-xs text-slate-600 dark:text-slate-400">
        <div class="flex items-center gap-1.5">
          <i data-lucide="calendar" class="w-3.5 h-3.5 shrink-0"></i>
          <span>Vence: <strong>${formatDate(p.fecha_fin_promo)}</strong></span>
        </div>
        ${p.numero_cliente ? `<div class="flex items-center gap-1.5"><i data-lucide="user" class="w-3.5 h-3.5 shrink-0"></i><span>Cliente: <strong>${p.numero_cliente}</strong></span></div>` : ""}
        ${contacto.length ? `<div class="flex flex-wrap gap-3 mt-1">${contacto.join("")}</div>` : ""}
        ${p.notas ? `<p class="text-slate-400 mt-1">${p.notas}</p>` : ""}
      </div>

      <div class="flex gap-2 mt-auto pt-1 border-t border-slate-100 dark:border-slate-800">
        <button data-action="renovar" data-id="${p.id}" data-nombre="${p.servicio_nombre}" class="flex-1 flex items-center justify-center gap-1 text-xs px-3 py-1.5 rounded-md text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition font-medium">
          <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>Renovar
        </button>
        <button data-action="edit" data-id="${p.id}" class="flex-1 flex items-center justify-center gap-1 text-xs px-3 py-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium">
          <i data-lucide="pencil" class="w-3.5 h-3.5"></i>Editar
        </button>
        <button data-action="delete" data-id="${p.id}" class="flex-1 flex items-center justify-center gap-1 text-xs px-3 py-1.5 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition font-medium">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>Eliminar
        </button>
      </div>
    </div>`;
}

// ── Promos del día ────────────────────────────────────────────────────────────

function renderHoy() {
  const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const hoyIdx = new Date().getDay(); // 0=Dom JS, necesitamos convertir a 0=Lun backend
  const hoyBackend = hoyIdx === 0 ? 6 : hoyIdx - 1;
  const nombreDia = DIAS_NOMBRE[hoyBackend];

  document.getElementById("hoy-titulo").textContent = `Promos activas para hoy (${nombreDia})`;

  const promosHoy = allPeriodicas.filter(p => p.activa && p.dias_semana.includes(hoyBackend));
  const grid = document.getElementById("hoy-grid");

  if (promosHoy.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-10">
        <p class="text-4xl mb-3">🎉</p>
        <p class="text-slate-500 dark:text-slate-400 text-sm">No tenés promos cargadas para hoy (${nombreDia}).</p>
        <button onclick="setTab('recurrentes')" class="mt-3 text-violet-600 dark:text-violet-400 text-sm hover:underline">Agregar promos recurrentes →</button>
      </div>`;
    lucide.createIcons();
    return;
  }

  grid.innerHTML = promosHoy.map(renderCardPeriodica).join("");
  lucide.createIcons();
}

// ── Promos recurrentes (todas) ────────────────────────────────────────────────

function renderRecurrentes() {
  const grid = document.getElementById("recurrentes-grid");

  if (allPeriodicas.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-10">
        <p class="text-4xl mb-3">🏷️</p>
        <p class="text-slate-500 dark:text-slate-400 text-sm">Aún no cargaste promos recurrentes.</p>
        <button onclick="openModalPeriodica()" class="mt-3 bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-2 rounded-lg transition">+ Agregar primera promo</button>
      </div>`;
    lucide.createIcons();
    return;
  }

  grid.innerHTML = allPeriodicas.map(renderCardPeriodica).join("");
  lucide.createIcons();
}

function renderCardPeriodica(p) {
  const diasLabels = (p.dias_nombres || []).join(", ") || "Ningún día";
  const activaBadge = p.activa
    ? `<span class="text-xs px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 font-semibold">Activa</span>`
    : `<span class="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 font-semibold">Inactiva</span>`;

  const descuentoHtml = p.descuento_pct
    ? `<div class="bg-violet-50 dark:bg-violet-900/20 rounded-md px-3 py-2 text-center">
        <p class="text-xs text-violet-500 dark:text-violet-400 mb-0.5">Descuento</p>
        <p class="text-xl font-bold text-violet-700 dark:text-violet-300">${p.descuento_pct}%</p>
        ${p.tope_reintegro ? `<p class="text-xs text-violet-500 dark:text-violet-400">tope ${formatCurrency(p.tope_reintegro)}</p>` : ""}
      </div>`
    : "";

  return `
    <div class="bg-white dark:bg-slate-900 rounded-lg border border-violet-200 dark:border-violet-800 p-5 flex flex-col gap-3" data-pid="${p.id}">
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-2xl">${p.icono}</span>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-800 dark:text-white truncate">${p.nombre}</p>
            ${p.categoria ? `<p class="text-xs text-slate-400">${p.categoria}</p>` : ""}
          </div>
        </div>
        ${activaBadge}
      </div>

      ${p.descripcion ? `<p class="text-xs text-slate-500 dark:text-slate-400 italic">"${p.descripcion}"</p>` : ""}

      <div class="grid grid-cols-${p.descuento_pct ? "2" : "1"} gap-2 text-xs">
        ${descuentoHtml}
        <div class="bg-slate-50 dark:bg-slate-800 rounded-md px-3 py-2 flex flex-col justify-center">
          <p class="text-slate-400 mb-1">Días activos</p>
          <p class="text-xs font-medium text-slate-700 dark:text-slate-300">${diasLabels}</p>
          ${p.medio_pago ? `<p class="text-xs text-slate-400 mt-1">via ${p.medio_pago}</p>` : ""}
        </div>
      </div>

      ${p.notas ? `<p class="text-xs text-slate-400">${p.notas}</p>` : ""}

      <div class="flex gap-2 mt-auto pt-1 border-t border-slate-100 dark:border-slate-800">
        <button data-paction="edit" data-pid="${p.id}" class="flex-1 flex items-center justify-center gap-1 text-xs px-3 py-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium">
          <i data-lucide="pencil" class="w-3.5 h-3.5"></i>Editar
        </button>
        <button data-paction="toggle" data-pid="${p.id}" data-activa="${p.activa}" class="flex-1 flex items-center justify-center gap-1 text-xs px-3 py-1.5 rounded-md ${p.activa ? "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20" : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"} transition font-medium">
          <i data-lucide="${p.activa ? "pause" : "play"}" class="w-3.5 h-3.5"></i>${p.activa ? "Pausar" : "Activar"}
        </button>
        <button data-paction="delete" data-pid="${p.id}" class="flex-1 flex items-center justify-center gap-1 text-xs px-3 py-1.5 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition font-medium">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>Eliminar
        </button>
      </div>
    </div>`;
}

// ── Notificaciones ────────────────────────────────────────────────────────────

async function loadNotificaciones() {
  try {
    const notifs = await apiFetch("/api/promociones/notificaciones");
    const unread = notifs.filter(n => !n.leida);
    const panel = document.getElementById("notifs-panel");
    const list = document.getElementById("notifs-list");

    if (unread.length === 0) {
      panel.classList.add("hidden");
      return;
    }

    panel.classList.remove("hidden");
    list.innerHTML = unread.map(n => `
      <div class="flex items-start gap-3 px-5 py-3" data-notif-id="${n.id}">
        <i data-lucide="bell" class="w-4 h-4 text-amber-500 mt-0.5 shrink-0"></i>
        <div class="flex-1 min-w-0">
          <p class="text-sm text-slate-700 dark:text-slate-200">${n.mensaje}</p>
          <p class="text-xs text-slate-400 mt-0.5">${formatDate(n.created_at?.split("T")[0] || "")}</p>
        </div>
        <button data-notif-id="${n.id}" data-action="leer-notif" class="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0">✕</button>
      </div>`).join("");

    lucide.createIcons();
  } catch (_) {}
}

async function leerTodas() {
  try {
    await apiFetch("/api/promociones/notificaciones/leer-todas", { method: "PATCH" });
    document.getElementById("notifs-panel").classList.add("hidden");
    const badge = document.getElementById("promo-badge");
    if (badge) badge.classList.add("hidden");
  } catch (_) {}
}

// ── Modal Renovar ─────────────────────────────────────────────────────────────

function openRenovarModal(id, nombre) {
  document.getElementById("renovar-id").value = id;
  document.getElementById("renovar-nombre").textContent = nombre;
  document.getElementById("renovar-error").classList.add("hidden");
  document.getElementById("renovar-fecha").value = "";
  document.getElementById("modal-renovar").classList.remove("hidden");
}

function closeRenovarModal() {
  document.getElementById("modal-renovar").classList.add("hidden");
}

document.getElementById("renovar-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errDiv = document.getElementById("renovar-error");
  errDiv.classList.add("hidden");
  const id = document.getElementById("renovar-id").value;
  const fecha = document.getElementById("renovar-fecha").value;
  try {
    await apiFetch(`/api/promociones/${id}/renovar`, {
      method: "PATCH",
      body: JSON.stringify({ nueva_fecha_fin: fecha }),
    });
    closeRenovarModal();
    loadPromos();
    const badge = document.getElementById("promo-badge");
    if (badge) badge.classList.add("hidden");
  } catch (err) {
    errDiv.textContent = err.message || "Error al renovar la promoción.";
    errDiv.classList.remove("hidden");
  }
});

document.getElementById("modal-renovar").addEventListener("click", (e) => {
  if (e.target === document.getElementById("modal-renovar")) closeRenovarModal();
});

// ── Modal promo regular ───────────────────────────────────────────────────────

function openModal(id = null) {
  editingId = id;
  document.getElementById("modal-title").textContent = id ? "Editar promoción" : "Nueva promoción";
  document.getElementById("modal-error").classList.add("hidden");
  document.getElementById("promo-form").reset();

  if (id) {
    const p = allPromos.find(x => x.id === id);
    if (!p) return;
    document.getElementById("p-nombre").value = p.servicio_nombre || "";
    document.getElementById("p-categoria").value = p.categoria || "";
    document.getElementById("p-nro-cliente").value = p.numero_cliente || "";
    document.getElementById("p-descripcion").value = p.descripcion_promo || "";
    document.getElementById("p-monto-promo").value = p.monto_con_promo || "";
    document.getElementById("p-monto-normal").value = p.monto_sin_promo || "";
    document.getElementById("p-fecha-inicio").value = p.fecha_inicio_promo || "";
    document.getElementById("p-fecha-fin").value = p.fecha_fin_promo || "";
    document.getElementById("p-telefono").value = p.telefono_contacto || "";
    document.getElementById("p-link").value = p.link_contacto || "";
    document.getElementById("p-notas").value = p.notas || "";
  }

  document.getElementById("modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
  editingId = null;
}

document.getElementById("promo-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errDiv = document.getElementById("modal-error");
  errDiv.classList.add("hidden");

  const payload = {
    servicio_nombre: document.getElementById("p-nombre").value.trim(),
    categoria: document.getElementById("p-categoria").value,
    numero_cliente: document.getElementById("p-nro-cliente").value.trim(),
    descripcion_promo: document.getElementById("p-descripcion").value.trim(),
    monto_con_promo: parseFloat(document.getElementById("p-monto-promo").value),
    monto_sin_promo: document.getElementById("p-monto-normal").value ? parseFloat(document.getElementById("p-monto-normal").value) : null,
    fecha_inicio_promo: document.getElementById("p-fecha-inicio").value || null,
    fecha_fin_promo: document.getElementById("p-fecha-fin").value,
    telefono_contacto: document.getElementById("p-telefono").value.trim(),
    link_contacto: document.getElementById("p-link").value.trim(),
    notas: document.getElementById("p-notas").value.trim(),
  };

  try {
    if (editingId) {
      await apiFetch(`/api/promociones/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await apiFetch("/api/promociones", { method: "POST", body: JSON.stringify(payload) });
    }
    closeModal();
    loadPromos();
  } catch (err) {
    errDiv.textContent = err.message || "Error al guardar la promoción.";
    errDiv.classList.remove("hidden");
  }
});

// ── Modal promo periódica ─────────────────────────────────────────────────────

function openModalPeriodica(id = null) {
  editingPeriodicaId = id;
  document.getElementById("modal-periodica-title").textContent = id ? "Editar promo recurrente" : "Nueva promo recurrente";
  document.getElementById("modal-periodica-error").classList.add("hidden");
  document.getElementById("periodica-form").reset();
  document.querySelectorAll(".pp-dia").forEach(cb => cb.checked = false);

  if (id) {
    const p = allPeriodicas.find(x => x.id === id);
    if (!p) return;
    document.getElementById("pp-id").value = p.id;
    document.getElementById("pp-nombre").value = p.nombre || "";
    document.getElementById("pp-categoria").value = p.categoria || "";
    document.getElementById("pp-medio-pago").value = p.medio_pago || "";
    document.getElementById("pp-descripcion").value = p.descripcion || "";
    document.getElementById("pp-descuento").value = p.descuento_pct || "";
    document.getElementById("pp-tope").value = p.tope_reintegro || "";
    document.getElementById("pp-notas").value = p.notas || "";
    const dias = p.dias_semana || [];
    document.querySelectorAll(".pp-dia").forEach(cb => {
      cb.checked = dias.includes(parseInt(cb.value));
    });
  }

  document.getElementById("modal-periodica").classList.remove("hidden");
}

function closeModalPeriodica() {
  document.getElementById("modal-periodica").classList.add("hidden");
  editingPeriodicaId = null;
}

document.getElementById("periodica-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errDiv = document.getElementById("modal-periodica-error");
  errDiv.classList.add("hidden");

  const dias = [];
  document.querySelectorAll(".pp-dia:checked").forEach(cb => dias.push(parseInt(cb.value)));

  const payload = {
    nombre: document.getElementById("pp-nombre").value.trim(),
    categoria: document.getElementById("pp-categoria").value,
    medio_pago: document.getElementById("pp-medio-pago").value.trim(),
    descripcion: document.getElementById("pp-descripcion").value.trim(),
    descuento_pct: document.getElementById("pp-descuento").value ? parseFloat(document.getElementById("pp-descuento").value) : null,
    tope_reintegro: document.getElementById("pp-tope").value ? parseFloat(document.getElementById("pp-tope").value) : null,
    dias_semana: dias,
    notas: document.getElementById("pp-notas").value.trim(),
  };

  try {
    if (editingPeriodicaId) {
      await apiFetch(`/api/promociones/periodicas/${editingPeriodicaId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await apiFetch("/api/promociones/periodicas", { method: "POST", body: JSON.stringify(payload) });
    }
    closeModalPeriodica();
    allPeriodicas = await apiFetch("/api/promociones/periodicas");
    renderRecurrentes();
  } catch (err) {
    errDiv.textContent = err.message || "Error al guardar la promo.";
    errDiv.classList.remove("hidden");
  }
});

document.getElementById("modal-periodica").addEventListener("click", (e) => {
  if (e.target === document.getElementById("modal-periodica")) closeModalPeriodica();
});

// ── Event delegation ──────────────────────────────────────────────────────────

document.getElementById("promos-grid").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  const id = parseInt(btn.dataset.id);

  if (action === "renovar") {
    openRenovarModal(id, btn.dataset.nombre);
  } else if (action === "edit") {
    openModal(id);
  } else if (action === "delete") {
    if (!confirm("¿Eliminar esta promoción?")) return;
    try {
      await apiFetch(`/api/promociones/${id}`, { method: "DELETE" });
      loadPromos();
    } catch (err) {
      alert("Error al eliminar: " + (err.message || ""));
    }
  }
});

function addPeriodicaGridListener(containerId) {
  document.getElementById(containerId).addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-paction]");
    if (!btn) return;
    const action = btn.dataset.paction;
    const pid = parseInt(btn.dataset.pid);

    if (action === "edit") {
      openModalPeriodica(pid);
    } else if (action === "toggle") {
      const activa = btn.dataset.activa === "true";
      try {
        await apiFetch(`/api/promociones/periodicas/${pid}`, {
          method: "PUT",
          body: JSON.stringify({ activa: !activa }),
        });
        allPeriodicas = await apiFetch("/api/promociones/periodicas");
        if (currentTab === "recurrentes") renderRecurrentes();
        else if (currentTab === "hoy") renderHoy();
      } catch (err) {
        alert("Error: " + (err.message || ""));
      }
    } else if (action === "delete") {
      if (!confirm("¿Eliminar esta promo recurrente?")) return;
      try {
        await apiFetch(`/api/promociones/periodicas/${pid}`, { method: "DELETE" });
        allPeriodicas = await apiFetch("/api/promociones/periodicas");
        if (currentTab === "recurrentes") renderRecurrentes();
        else if (currentTab === "hoy") renderHoy();
      } catch (err) {
        alert("Error al eliminar: " + (err.message || ""));
      }
    }
  });
}

addPeriodicaGridListener("recurrentes-grid");
addPeriodicaGridListener("hoy-grid");

document.getElementById("notifs-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action='leer-notif']");
  if (!btn) return;
  const id = parseInt(btn.dataset.notifId);
  try {
    await apiFetch(`/api/promociones/notificaciones/${id}/leer`, { method: "PATCH" });
    loadNotificaciones();
    const badge = document.getElementById("promo-badge");
    if (badge) {
      const curr = parseInt(badge.textContent) || 0;
      if (curr <= 1) badge.classList.add("hidden");
      else badge.textContent = curr - 1;
    }
  } catch (_) {}
});

document.getElementById("modal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("modal")) closeModal();
});

// Activar tab "hoy" si viene de URL con hash
if (window.location.hash === "#periodicas") {
  loadPromos().then(() => setTab("hoy"));
} else {
  loadPromos();
}
