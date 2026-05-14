requireAuth();

let prestamos = [];
let cuotasActuales = [];
let prestamoSeleccionado = null;
let filtroActual = 'todas';
let cuotaPendiente = null; // { prestamoId, numeroCuota, cuota }

let uvaActual = null; // { valor, fecha }

// ── Inicialización ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    initPageCommons();
    cargarResumen();
    cargarPrestamos();

    // Preview cuota estimada en tiempo real
    ['f-monto', 'f-tna', 'f-cuotas', 'f-cargos', 'f-sistema'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', actualizarPreview);
    });

    // Hint de "cuota desde"
    document.getElementById('f-cuota-desde').addEventListener('input', actualizarHintCuotaDesde);
    document.getElementById('f-cuotas').addEventListener('input', actualizarHintCuotaDesde);

    // Mostrar/ocultar banner UVA según tipo y moneda
    document.getElementById('f-tipo').addEventListener('change', onCampoUvaChange);
    document.getElementById('f-moneda').addEventListener('change', onCampoUvaChange);
});

// ── UVA ───────────────────────────────────────────────────────────────────────

function esUva() {
    const tipo = document.getElementById('f-tipo')?.value;
    const moneda = document.getElementById('f-moneda')?.value;
    return tipo === 'uva' || moneda === 'UVA';
}

async function onCampoUvaChange() {
    if (esUva()) {
        await mostrarBannerUva();
    } else {
        ocultarBannerUva();
    }
    actualizarPreview();
}

async function mostrarBannerUva() {
    const banner = document.getElementById('uva-banner');
    if (!banner) return;
    banner.classList.remove('hidden');

    if (uvaActual) {
        actualizarTextoBannerUva();
        return;
    }

    banner.innerHTML = `
        <div class="flex items-center gap-2 text-cyan-700 dark:text-cyan-400 text-xs">
            <svg class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            Consultando cotización UVA…
        </div>`;

    try {
        let data;
        try {
            data = await apiFetch('/api/prestamos/uva');
        } catch (_) {
            data = await fetchUvaDirecto();
        }
        uvaActual = { valor: data.valor, fecha: data.fecha };
        actualizarTextoBannerUva();
        actualizarPreview();
    } catch (_) {
        banner.innerHTML = `<p class="text-xs text-red-600 dark:text-red-400">No se pudo obtener la cotización UVA en este momento.</p>`;
    }
}

async function fetchUvaDirecto() {
    const hoy = new Date().toISOString().slice(0, 10);
    const desde = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const url = `https://api.bcra.gob.ar/estadisticas/v2.0/datosvariable/4/${desde}/${hoy}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('BCRA error');
    const resultados = (await resp.json()).results || [];
    if (!resultados.length) throw new Error('Sin datos');
    const ultimo = resultados[resultados.length - 1];
    return { valor: parseFloat(ultimo.valor), fecha: ultimo.fecha };
}

function actualizarTextoBannerUva() {
    const banner = document.getElementById('uva-banner');
    if (!banner || !uvaActual) return;
    banner.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
                <p class="text-xs font-semibold text-cyan-700 dark:text-cyan-300 uppercase tracking-wider">Cotización UVA actual</p>
                <p class="text-lg font-bold text-cyan-800 dark:text-cyan-200 mt-0.5">
                    ${formatCurrency(uvaActual.valor)}
                    <span class="text-xs font-normal text-cyan-600 dark:text-cyan-400 ml-1">ARS por UVA</span>
                </p>
                <p class="text-xs text-cyan-600 dark:text-cyan-500 mt-0.5">Fuente: BCRA · ${formatFecha(uvaActual.fecha)}</p>
            </div>
            <div id="uva-cuota-ars" class="text-right"></div>
        </div>`;
}

function ocultarBannerUva() {
    const banner = document.getElementById('uva-banner');
    if (banner) banner.classList.add('hidden');
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function cargarResumen() {
    try {
        const data = await apiFetch('/api/prestamos/resumen');
        document.getElementById('kpi-deuda').textContent = formatCurrency(data.total_deuda);
        document.getElementById('kpi-atrasadas').textContent = data.cuotas_atrasadas;

        const proxEl = document.getElementById('kpi-proximas');
        if (!data.proximas_cuotas.length) {
            proxEl.textContent = 'Sin cuotas próximas';
        } else {
            proxEl.innerHTML = data.proximas_cuotas.map(c => `
                <div class="flex justify-between items-center gap-2">
                    <span class="truncate text-xs text-slate-500 dark:text-slate-400">${c.prestamo_nombre}</span>
                    <span class="font-semibold text-xs shrink-0 ${c.estado === 'atrasado' ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-white'}">${formatCurrency(c.monto_total)}</span>
                </div>
            `).join('');
        }
    } catch (_) {}
}

async function cargarPrestamos() {
    try {
        prestamos = await apiFetch('/api/prestamos');
        renderizarPrestamos();
        renderizarSelector();
        lucide.createIcons();
    } catch (e) {
        mostrarError('No se pudieron cargar los préstamos.');
    }
}

async function cargarCuotas(prestamoId) {
    try {
        cuotasActuales = await apiFetch(`/api/prestamos/${prestamoId}/cuotas`);
        filtroActual = 'todas';
        activarFiltroBtn('todas');
        renderizarCuotas();
        lucide.createIcons();
    } catch (e) {
        mostrarError('No se pudieron cargar las cuotas.');
    }
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderizarPrestamos() {
    const lista = document.getElementById('lista-prestamos');
    const empty = document.getElementById('empty-state');

    if (!prestamos.length) {
        lista.innerHTML = '';
        empty.classList.remove('hidden');
        document.getElementById('selector-container').classList.add('hidden');
        document.getElementById('cuotas-section').classList.add('hidden');
        return;
    }

    empty.classList.add('hidden');
    document.getElementById('selector-container').classList.remove('hidden');

    const hayUva = prestamos.some(p => p.tipo === 'uva' || p.moneda === 'UVA');
    if (hayUva && !uvaActual) {
        const fetchUva = () => apiFetch('/api/prestamos/uva').catch(() => fetchUvaDirecto());
        fetchUva().then(data => {
            uvaActual = { valor: data.valor, fecha: data.fecha };
            renderizarPrestamos();
        }).catch(() => {});
    }

    lista.innerHTML = prestamos.map(p => {
        const pct = p.cuotas_totales > 0 ? Math.round((p.cuotas_pagadas / p.cuotas_totales) * 100) : 0;
        const tipoLabel = { hipotecario: 'Hipotecario', personal: 'Personal', vehiculo: 'Vehículo', uva: 'UVA', otro: 'Otro' }[p.tipo] || p.tipo;
        const monedaSym = p.moneda === 'USD' ? 'USD ' : p.moneda === 'UVA' ? 'UVA ' : '';
        const proxima = p.proxima_cuota;
        const esUvaCard = p.tipo === 'uva' || p.moneda === 'UVA';

        return `
        <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <div class="flex items-start justify-between gap-3 mb-3">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-semibold text-slate-800 dark:text-white truncate">${escHtml(p.nombre)}</span>
                        <span class="text-xs px-2 py-0.5 rounded-full font-semibold ${tipoBadge(p.tipo)}">${tipoLabel}</span>
                        ${!p.activo ? '<span class="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">Inactivo</span>' : ''}
                    </div>
                    ${p.entidad ? `<p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${escHtml(p.entidad)}${p.numero_operacion ? ` · Op n° ${escHtml(p.numero_operacion)}` : ''}</p>` : (p.numero_operacion ? `<p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Op n° ${escHtml(p.numero_operacion)}</p>` : '')}
                </div>
                <div class="flex gap-1 shrink-0">
                    <button onclick="abrirEditar(${p.id})" class="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Editar">
                        <i data-lucide="pencil" class="w-4 h-4"></i>
                    </button>
                    <button onclick="eliminarPrestamo(${p.id})" class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Eliminar">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3 text-sm mb-4">
                <div>
                    <p class="text-xs text-slate-500 dark:text-slate-400">Monto original</p>
                    <p class="font-semibold text-slate-800 dark:text-white">${monedaSym}${formatCurrency(p.monto_original)}</p>
                </div>
                <div>
                    <p class="text-xs text-slate-500 dark:text-slate-400">Saldo pendiente</p>
                    <p class="font-semibold text-red-600 dark:text-red-400">${monedaSym}${formatCurrency(p.saldo_actual)}</p>
                </div>
                <div>
                    <p class="text-xs text-slate-500 dark:text-slate-400">TNA</p>
                    <p class="font-medium text-slate-700 dark:text-slate-300">${p.tasa_nominal_anual.toFixed(2)}%</p>
                </div>
                <div>
                    <p class="text-xs text-slate-500 dark:text-slate-400">Próxima cuota</p>
                    ${proxima
                        ? `<p class="font-medium text-slate-700 dark:text-slate-300">${formatCurrency(proxima.monto_total)}<span class="text-xs text-slate-400 ml-1">${formatFecha(proxima.fecha_vencimiento)}</span></p>`
                        : `<p class="text-emerald-600 dark:text-emerald-400 font-medium text-xs">Todas pagadas ✓</p>`
                    }
                </div>
            </div>

            ${esUvaCard ? `
            <div class="mb-3 rounded-lg bg-cyan-50 dark:bg-cyan-950 border border-cyan-200 dark:border-cyan-800 px-3 py-2">
                ${uvaActual
                    ? `<div class="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <p class="text-xs font-semibold text-cyan-700 dark:text-cyan-400">UVA hoy</p>
                            <p class="text-sm font-bold text-cyan-800 dark:text-cyan-200">${formatCurrency(uvaActual.valor)} <span class="font-normal text-cyan-600 dark:text-cyan-500 text-xs">ARS</span></p>
                            <p class="text-xs text-cyan-500 dark:text-cyan-600">${formatFecha(uvaActual.fecha)} · Fuente: BCRA</p>
                        </div>
                        ${proxima ? `<div class="text-right">
                            <p class="text-xs font-semibold text-cyan-700 dark:text-cyan-400">Próxima cuota en ARS</p>
                            <p class="text-sm font-bold text-cyan-800 dark:text-cyan-200">≈ ${formatCurrency(proxima.monto_total * uvaActual.valor)}</p>
                            <p class="text-xs text-cyan-500 dark:text-cyan-600">(${formatCurrency(proxima.monto_total)} UVA × ${formatCurrency(uvaActual.valor)})</p>
                        </div>` : ''}
                    </div>`
                    : `<p class="text-xs text-cyan-600 dark:text-cyan-400 animate-pulse">Cargando cotización UVA…</p>`
                }
            </div>` : ''}

            <div class="mb-3">
                <div class="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <span>Cuotas: ${p.cuotas_pagadas} de ${p.cuotas_totales}</span>
                    <span>${pct}%</span>
                </div>
                <div class="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-500 rounded-full transition-all" style="width: ${pct}%"></div>
                </div>
            </div>

            <button onclick="seleccionarPrestamo(${p.id})" class="w-full text-center text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition">
                Ver tabla de cuotas →
            </button>
        </div>`;
    }).join('');
}

function renderizarSelector() {
    const tabs = document.getElementById('selector-tabs');
    tabs.innerHTML = prestamos.map(p => `
        <button data-pid="${p.id}" onclick="seleccionarPrestamo(${p.id})"
            class="selector-tab px-3 py-1.5 rounded-lg text-xs font-semibold border transition
                ${prestamoSeleccionado === p.id
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}">
            ${escHtml(p.nombre)}
        </button>
    `).join('');
}

function renderizarCuotas() {
    const p = prestamos.find(x => x.id === prestamoSeleccionado);
    if (!p) return;
    const esUvaLoan = p.tipo === 'uva' || p.moneda === 'UVA';

    document.getElementById('cuotas-titulo').textContent = `Cuotas — ${p.nombre} (${p.cuotas_pagadas}/${p.cuotas_totales} pagadas)`;

    const cuotas = filtrarPorEstado(cuotasActuales, filtroActual);

    // Desktop
    document.getElementById('tabla-cuotas').innerHTML = cuotas.map(c => {
        // Para UVA con valores reales guardados, mostrar desglose UVA
        const tieneUva = c.capital_uva != null || c.interes_uva != null;
        const desgloseUva = (esUvaLoan && tieneUva)
            ? `<span class="block text-xs text-cyan-500 dark:text-cyan-600">${c.capital_uva != null ? c.capital_uva.toFixed(2) + ' UVA' : ''}</span>`
            : '';
        const desgloseUvaInt = (esUvaLoan && tieneUva)
            ? `<span class="block text-xs text-cyan-500 dark:text-cyan-600">${c.interes_uva != null ? c.interes_uva.toFixed(2) + ' UVA' : ''}</span>`
            : '';

        return `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition ${c.estado === 'atrasado' ? 'bg-red-50/30 dark:bg-red-950/20' : ''}">
            <td class="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">${c.numero_cuota}</td>
            <td class="px-4 py-3 text-slate-700 dark:text-slate-300 text-xs">${formatFecha(c.fecha_vencimiento)}${c.fecha_pago ? `<span class="block text-xs text-emerald-500">Pag: ${formatFecha(c.fecha_pago)}</span>` : ''}</td>
            <td class="px-4 py-3 text-right text-xs">${formatCurrency(c.capital)}${desgloseUva}</td>
            <td class="px-4 py-3 text-right text-xs">${formatCurrency(c.interes)}${desgloseUvaInt}</td>
            <td class="px-4 py-3 text-right text-slate-500 dark:text-slate-400 text-xs">${formatCurrency(c.cargos)}</td>
            <td class="px-4 py-3 text-right font-semibold text-slate-800 dark:text-white text-sm">${formatCurrency(c.monto_total)}</td>
            <td class="px-4 py-3 text-right text-slate-500 dark:text-slate-400 text-xs">${formatCurrency(c.saldo_pendiente)}</td>
            <td class="px-4 py-3 text-center">${badgeEstado(c.estado)}</td>
            <td class="px-4 py-3 text-center">
                ${c.estado !== 'pagado'
                    ? `<button onclick="abrirPagar(${p.id}, ${c.numero_cuota}, ${JSON.stringify(c).replace(/"/g, '&quot;')})" class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 px-2 py-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950 transition">Pagar</button>`
                    : `<button onclick="deshacerPago(${p.id}, ${c.numero_cuota})" class="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Deshacer pago">↩</button>`
                }
            </td>
        </tr>`;
    }).join('') || '<tr><td colspan="9" class="px-4 py-10 text-center text-slate-400 text-sm">Sin cuotas con ese filtro</td></tr>';

    // Mobile
    document.getElementById('lista-cuotas-mobile').innerHTML = cuotas.map(c => `
        <div class="p-4 ${c.estado === 'atrasado' ? 'bg-red-50/30 dark:bg-red-950/20' : ''}">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs text-slate-500 dark:text-slate-400">Cuota ${c.numero_cuota} — ${formatFecha(c.fecha_vencimiento)}</span>
                ${badgeEstado(c.estado)}
            </div>
            <div class="flex items-center justify-between">
                <div>
                    <p class="font-semibold text-slate-800 dark:text-white">${formatCurrency(c.monto_total)}</p>
                    <p class="text-xs text-slate-400">Cap: ${formatCurrency(c.capital)} · Int: ${formatCurrency(c.interes)} · Cargos: ${formatCurrency(c.cargos)}</p>
                    ${(esUvaLoan && (c.capital_uva || c.interes_uva)) ? `<p class="text-xs text-cyan-500">${c.capital_uva?.toFixed(2) || '—'} + ${c.interes_uva?.toFixed(2) || '—'} UVA</p>` : ''}
                    <p class="text-xs text-slate-400">Saldo: ${formatCurrency(c.saldo_pendiente)}</p>
                </div>
                ${c.estado !== 'pagado'
                    ? `<button onclick="abrirPagar(${p.id}, ${c.numero_cuota}, ${JSON.stringify(c).replace(/"/g, '&quot;')})" class="text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 px-4 py-2 rounded-lg transition">Pagar</button>`
                    : `<button onclick="deshacerPago(${p.id}, ${c.numero_cuota})" class="text-xs text-slate-400 hover:text-red-500 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 transition">↩ Deshacer</button>`
                }
            </div>
        </div>
    `).join('') || '<p class="p-6 text-center text-slate-400 text-sm">Sin cuotas con ese filtro</p>';
}

// ── Selección y filtros ───────────────────────────────────────────────────────

function seleccionarPrestamo(id) {
    prestamoSeleccionado = id;
    document.getElementById('cuotas-section').classList.remove('hidden');
    document.getElementById('cuotas-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    renderizarSelector();
    cargarCuotas(id);
}

function filtrarCuotas(filtro) {
    filtroActual = filtro;
    activarFiltroBtn(filtro);
    renderizarCuotas();
}

function activarFiltroBtn(filtro) {
    document.querySelectorAll('.filtro-btn').forEach(btn => {
        const activo = btn.dataset.filtro === filtro;
        btn.classList.toggle('bg-blue-700', activo);
        btn.classList.toggle('text-white', activo);
        btn.classList.toggle('border-blue-700', activo);
        btn.classList.toggle('bg-slate-50', !activo);
        btn.classList.toggle('dark:bg-slate-800', !activo);
        btn.classList.toggle('text-slate-700', !activo);
        btn.classList.toggle('dark:text-slate-300', !activo);
        btn.classList.toggle('border-slate-300', !activo);
        btn.classList.toggle('dark:border-slate-600', !activo);
    });
}

function filtrarPorEstado(cuotas, filtro) {
    if (filtro === 'todas') return cuotas;
    if (filtro === 'pendiente') return cuotas.filter(c => c.estado === 'pendiente' || c.estado === 'atrasado');
    return cuotas.filter(c => c.estado === filtro);
}

// ── Modales: Nuevo préstamo ───────────────────────────────────────────────────

function actualizarHintCuotaDesde() {
    const desde = parseInt(document.getElementById('f-cuota-desde').value) || 1;
    const total = parseInt(document.getElementById('f-cuotas').value) || 0;
    const hint = document.getElementById('cuota-desde-hint');
    if (!hint) return;

    if (desde <= 1) {
        hint.textContent = 'Préstamo nuevo, sin cuotas previas.';
        hint.className = 'text-xs text-slate-400 flex-1';
    } else if (total && desde > total) {
        hint.textContent = `No puede ser mayor al total de cuotas (${total}).`;
        hint.className = 'text-xs text-red-500 flex-1';
    } else {
        const previas = desde - 1;
        hint.textContent = `Las primeras ${previas} cuota${previas > 1 ? 's' : ''} se marcarán automáticamente como pagadas.`;
        hint.className = 'text-xs text-amber-600 dark:text-amber-400 flex-1';
    }
}

function openNuevoModal() {
    document.getElementById('form-nuevo').reset();
    document.getElementById('error-nuevo').classList.add('hidden');
    document.getElementById('preview-cuota').classList.add('hidden');
    document.getElementById('f-fecha').value = new Date().toISOString().slice(0, 10);
    document.getElementById('f-cuota-desde').value = 1;
    actualizarHintCuotaDesde();
    document.getElementById('modal-nuevo').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    lucide.createIcons();
}

function closeNuevoModal() {
    document.getElementById('modal-nuevo').classList.add('hidden');
    document.body.style.overflow = '';
}

function actualizarPreview() {
    const monto = parseFloat(document.getElementById('f-monto').value) || 0;
    const tna = parseFloat(document.getElementById('f-tna').value) || 0;
    const n = parseInt(document.getElementById('f-cuotas').value) || 0;
    const cargos = parseFloat(document.getElementById('f-cargos').value) || 0;
    const sistema = document.getElementById('f-sistema').value;
    const esUvaLoan = esUva();

    const previewEl = document.getElementById('preview-cuota');
    const textEl = document.getElementById('preview-text');

    if (!monto || !n) { previewEl.classList.add('hidden'); return; }

    const tasa_m = tna / 100 / 12;
    let cuota;
    if (sistema === 'frances') {
        cuota = tasa_m > 0 ? monto * tasa_m / (1 - Math.pow(1 + tasa_m, -n)) : monto / n;
    } else if (sistema === 'aleman') {
        cuota = monto / n + monto * tasa_m; // primera cuota (la más alta)
    } else {
        cuota = monto / n;
    }

    const total = cuota + cargos;
    const label = sistema === 'aleman' ? ' (1° cuota, la más alta)' : '';
    const monedaLabel = esUvaLoan ? ' UVA' : '';

    let html = `Cuota aprox: <strong>${formatCurrency(total)}${monedaLabel}</strong>${label}`;

    if (esUvaLoan && uvaActual) {
        const arsTotal = total * uvaActual.valor;
        html += `<br><span class="text-xs opacity-80">≈ ${formatCurrency(arsTotal)} ARS al valor UVA de hoy</span>`;

        const uvaCuotaArs = document.getElementById('uva-cuota-ars');
        if (uvaCuotaArs) {
            uvaCuotaArs.innerHTML = `
                <p class="text-xs text-cyan-600 dark:text-cyan-400 font-semibold">Cuota estimada hoy</p>
                <p class="text-base font-bold text-cyan-800 dark:text-cyan-200">${formatCurrency(total)} UVA</p>
                <p class="text-sm text-cyan-700 dark:text-cyan-300">≈ ${formatCurrency(arsTotal)} ARS</p>`;
        }
    }

    textEl.innerHTML = html;
    previewEl.classList.remove('hidden');
}

async function submitNuevo(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-nuevo-submit');
    btn.disabled = true;
    btn.textContent = 'Creando...';
    const errEl = document.getElementById('error-nuevo');
    errEl.classList.add('hidden');

    try {
        const cuotaDesde = parseInt(document.getElementById('f-cuota-desde').value) || 1;
        const cuotasTotales = parseInt(document.getElementById('f-cuotas').value);
        if (cuotaDesde > cuotasTotales) {
            throw new Error(`La cuota de inicio (${cuotaDesde}) no puede ser mayor al total de cuotas (${cuotasTotales}).`);
        }
        const body = {
            nombre: document.getElementById('f-nombre').value.trim(),
            tipo: document.getElementById('f-tipo').value,
            entidad: document.getElementById('f-entidad').value.trim(),
            numero_operacion: document.getElementById('f-nro-op').value.trim(),
            monto_original: parseFloat(document.getElementById('f-monto').value),
            moneda: document.getElementById('f-moneda').value,
            tasa_nominal_anual: parseFloat(document.getElementById('f-tna').value) || 0,
            sistema_amortizacion: document.getElementById('f-sistema').value,
            cuotas_totales: cuotasTotales,
            fecha_inicio: document.getElementById('f-fecha').value,
            dia_pago: parseInt(document.getElementById('f-dia').value) || 10,
            cargos_mensuales: parseFloat(document.getElementById('f-cargos').value) || 0,
            cuota_desde: cuotaDesde,
            notas: document.getElementById('f-notas').value.trim(),
        };
        await apiFetch('/api/prestamos', { method: 'POST', body: JSON.stringify(body) });
        closeNuevoModal();
        await cargarPrestamos();
        await cargarResumen();
    } catch (err) {
        errEl.textContent = err.message || 'Error al crear el préstamo';
        errEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Crear préstamo';
    }
}

// ── Modales: Pagar cuota ──────────────────────────────────────────────────────

function abrirPagar(prestamoId, numeroCuota, cuotaData) {
    // cuotaData puede llegar como string (desde onclick inline) o como objeto
    const cuota = typeof cuotaData === 'string' ? JSON.parse(cuotaData) : cuotaData;
    cuotaPendiente = { prestamoId, numeroCuota, cuota };

    const p = prestamos.find(x => x.id === prestamoId);
    const esUvaLoan = p && (p.tipo === 'uva' || p.moneda === 'UVA');

    document.getElementById('pagar-subtitulo').textContent =
        `Cuota N° ${numeroCuota} — ${formatCurrency(cuota.monto_total)}${esUvaLoan ? ' UVA' : ''}`;
    document.getElementById('pagar-fecha').value = new Date().toISOString().slice(0, 10);
    document.getElementById('pagar-notas').value = '';
    document.getElementById('error-pagar').classList.add('hidden');

    // Pre-poblar con valores calculados (editables)
    document.getElementById('pagar-capital').value = cuota.capital || '';
    document.getElementById('pagar-interes').value = cuota.interes || '';
    document.getElementById('pagar-cargos').value = cuota.cargos || '';
    document.getElementById('pagar-capital-uva').value = '';
    document.getElementById('pagar-interes-uva').value = '';
    recalcularTotal();

    // Campos UVA solo para préstamos UVA
    document.getElementById('pagar-uva-fields').classList.toggle('hidden', !esUvaLoan);

    // Colapsar el desglose por defecto
    document.getElementById('desglose-body').classList.add('hidden');
    const chevron = document.getElementById('desglose-chevron');
    if (chevron) chevron.style.transform = '';

    document.getElementById('modal-pagar').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    lucide.createIcons();
}

function closePagarModal() {
    document.getElementById('modal-pagar').classList.add('hidden');
    document.body.style.overflow = '';
    cuotaPendiente = null;
}

function toggleDesglose() {
    const body = document.getElementById('desglose-body');
    const chevron = document.getElementById('desglose-chevron');
    const abierto = !body.classList.contains('hidden');
    body.classList.toggle('hidden', abierto);
    if (chevron) chevron.style.transform = abierto ? '' : 'rotate(180deg)';
}

function recalcularTotal() {
    const cap = parseFloat(document.getElementById('pagar-capital').value) || 0;
    const int = parseFloat(document.getElementById('pagar-interes').value) || 0;
    const car = parseFloat(document.getElementById('pagar-cargos').value) || 0;
    const total = cap + int + car;
    const el = document.getElementById('pagar-total-calc');
    if (el) el.textContent = total > 0 ? formatCurrency(total) : '—';
}

async function confirmarPago() {
    if (!cuotaPendiente) return;
    const errEl = document.getElementById('error-pagar');
    errEl.classList.add('hidden');

    // Leer valores del desglose solo si alguno fue editado
    const capVal = document.getElementById('pagar-capital').value;
    const intVal = document.getElementById('pagar-interes').value;
    const carVal = document.getElementById('pagar-cargos').value;
    const capUvaVal = document.getElementById('pagar-capital-uva').value;
    const intUvaVal = document.getElementById('pagar-interes-uva').value;

    const { cuota } = cuotaPendiente;
    const capChanged = capVal !== '' && parseFloat(capVal) !== cuota.capital;
    const intChanged = intVal !== '' && parseFloat(intVal) !== cuota.interes;
    const carChanged = carVal !== '' && parseFloat(carVal) !== cuota.cargos;

    const body = {
        fecha_pago: document.getElementById('pagar-fecha').value || null,
        notas: document.getElementById('pagar-notas').value.trim(),
        capital_real:  capChanged ? parseFloat(capVal) : null,
        interes_real:  intChanged ? parseFloat(intVal) : null,
        cargos_real:   carChanged ? parseFloat(carVal) : null,
        capital_uva:   capUvaVal !== '' ? parseFloat(capUvaVal) : null,
        interes_uva:   intUvaVal !== '' ? parseFloat(intUvaVal) : null,
    };

    try {
        await apiFetch(`/api/prestamos/${cuotaPendiente.prestamoId}/cuotas/${cuotaPendiente.numeroCuota}/pagar`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
        closePagarModal();
        await cargarCuotas(prestamoSeleccionado);
        await cargarPrestamos();
        await cargarResumen();
    } catch (err) {
        errEl.textContent = err.message || 'Error al registrar el pago';
        errEl.classList.remove('hidden');
    }
}

async function deshacerPago(prestamoId, numeroCuota) {
    if (!confirm('¿Deshacer el pago de esta cuota?')) return;
    try {
        await apiFetch(`/api/prestamos/${prestamoId}/cuotas/${numeroCuota}/pagar`, { method: 'DELETE' });
        await cargarCuotas(prestamoSeleccionado);
        await cargarPrestamos();
        await cargarResumen();
    } catch (err) {
        mostrarError(err.message || 'Error al deshacer el pago');
    }
}

// ── Modales: Editar préstamo ──────────────────────────────────────────────────

function abrirEditar(id) {
    const p = prestamos.find(x => x.id === id);
    if (!p) return;
    document.getElementById('e-id').value = p.id;
    document.getElementById('e-nombre').value = p.nombre;
    document.getElementById('e-entidad').value = p.entidad || '';
    document.getElementById('e-nro-op').value = p.numero_operacion || '';
    document.getElementById('e-dia').value = p.dia_pago;
    document.getElementById('e-cargos').value = p.cargos_mensuales || 0;
    document.getElementById('e-notas').value = p.notas || '';
    document.getElementById('error-editar').classList.add('hidden');
    document.getElementById('modal-editar').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    lucide.createIcons();
}

function closeEditarModal() {
    document.getElementById('modal-editar').classList.add('hidden');
    document.body.style.overflow = '';
}

async function submitEditar(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('e-id').value);
    const errEl = document.getElementById('error-editar');
    errEl.classList.add('hidden');
    try {
        const body = {
            nombre: document.getElementById('e-nombre').value.trim(),
            entidad: document.getElementById('e-entidad').value.trim(),
            numero_operacion: document.getElementById('e-nro-op').value.trim(),
            dia_pago: parseInt(document.getElementById('e-dia').value),
            cargos_mensuales: parseFloat(document.getElementById('e-cargos').value) || 0,
            notas: document.getElementById('e-notas').value.trim(),
        };
        await apiFetch(`/api/prestamos/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        closeEditarModal();
        await cargarPrestamos();
        await cargarResumen();
        if (prestamoSeleccionado === id) await cargarCuotas(id);
    } catch (err) {
        errEl.textContent = err.message || 'Error al guardar';
        errEl.classList.remove('hidden');
    }
}

// ── Eliminar préstamo ─────────────────────────────────────────────────────────

async function eliminarPrestamo(id) {
    const p = prestamos.find(x => x.id === id);
    if (!confirm(`¿Eliminar "${p?.nombre}"? Se borrarán todas las cuotas.`)) return;
    try {
        await apiFetch(`/api/prestamos/${id}`, { method: 'DELETE' });
        if (prestamoSeleccionado === id) {
            prestamoSeleccionado = null;
            document.getElementById('cuotas-section').classList.add('hidden');
        }
        await cargarPrestamos();
        await cargarResumen();
    } catch (err) {
        mostrarError(err.message || 'Error al eliminar');
    }
}

// ── Utilidades ────────────────────────────────────────────────────────────────

function badgeEstado(estado) {
    const map = {
        pagado:   'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400',
        pendiente:'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400',
        atrasado: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400',
    };
    const label = { pagado: 'Pagada', pendiente: 'Pendiente', atrasado: 'Atrasada' }[estado] || estado;
    return `<span class="text-xs px-2 py-0.5 rounded-full font-semibold ${map[estado] || ''}">${label}</span>`;
}

function tipoBadge(tipo) {
    const map = {
        hipotecario:'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400',
        personal:   'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-400',
        vehiculo:   'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400',
        uva:        'bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-400',
        otro:       'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    };
    return map[tipo] || map.otro;
}

function formatFecha(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function mostrarError(msg) {
    alert(msg);
}
