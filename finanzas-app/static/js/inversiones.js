requireAuth();
initPageCommons();

// ── Quiz data ─────────────────────────────────────────────────────────────────

const QUIZ = [
  {
    pregunta: "¿Cuál es tu objetivo principal al invertir?",
    opciones: [
      { texto: "Que mi dinero no pierda valor ante la inflación", puntos: 0 },
      { texto: "Obtener un rendimiento seguro y predecible", puntos: 1 },
      { texto: "Hacer crecer mi capital aceptando algo de riesgo", puntos: 2 },
      { texto: "Maximizar el crecimiento sin importar la volatilidad", puntos: 3 },
    ],
  },
  {
    pregunta: "¿Por cuánto tiempo podés dejar tu dinero invertido sin necesitarlo?",
    opciones: [
      { texto: "Menos de 6 meses", puntos: 0 },
      { texto: "Entre 6 meses y 1 año", puntos: 1 },
      { texto: "Entre 1 y 3 años", puntos: 2 },
      { texto: "Más de 3 años", puntos: 3 },
    ],
  },
  {
    pregunta: "Si tu inversión cae un 25% en un mes, ¿qué harías?",
    opciones: [
      { texto: "Retiro todo de inmediato para no perder más", puntos: 0 },
      { texto: "Me preocuparía mucho, pero esperaría un poco", puntos: 1 },
      { texto: "Mantendría la posición confiando en la recuperación", puntos: 2 },
      { texto: "Aprovecharía para comprar más a precio bajo", puntos: 3 },
    ],
  },
  {
    pregunta: "¿Cuál es tu experiencia con inversiones?",
    opciones: [
      { texto: "Ninguna, es la primera vez que invierto", puntos: 0 },
      { texto: "Básica: plazos fijos o cuentas remuneradas", puntos: 1 },
      { texto: "Intermedia: acciones, fondos o bonos", puntos: 2 },
      { texto: "Avanzada: cartera diversificada, cripto, derivados", puntos: 3 },
    ],
  },
  {
    pregunta: "¿Contás con un fondo de emergencia que cubra 3-6 meses de gastos?",
    opciones: [
      { texto: "No, no tengo fondo de emergencia", puntos: 0 },
      { texto: "Tengo algo, pero no alcanza para 3 meses", puntos: 1 },
      { texto: "Sí, tengo mi fondo de emergencia cubierto", puntos: 2 },
    ],
  },
  {
    pregunta: "¿Cómo describirías tu situación de ingresos?",
    opciones: [
      { texto: "Inestable o muy variable", puntos: 0 },
      { texto: "Estable pero con poco margen de ahorro", puntos: 1 },
      { texto: "Estable con buen margen para invertir", puntos: 2 },
      { texto: "Múltiples fuentes de ingreso", puntos: 3 },
    ],
  },
  {
    pregunta: "¿Qué porcentaje de tus ahorros querés destinar a inversiones?",
    opciones: [
      { texto: "Menos del 20%", puntos: 0 },
      { texto: "Entre el 20% y el 40%", puntos: 1 },
      { texto: "Entre el 40% y el 60%", puntos: 2 },
      { texto: "Más del 60%", puntos: 3 },
    ],
  },
];

const PERFILES = {
  conservador: {
    emoji: "🛡️",
    titulo: "Conservador",
    color: "border-blue-400 bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-100",
    badgeColor: "border-blue-400 text-blue-700 dark:text-blue-300",
    desc: "Priorizás la seguridad sobre el rendimiento. Preferís inversiones que protejan tu capital con baja volatilidad y rendimientos predecibles.",
    recomendaciones: ["🏦 Plazo Fijo", "📊 FCI Money Market", "📜 Bonos corto plazo", "💵 Dólar"],
  },
  moderado: {
    emoji: "⚖️",
    titulo: "Moderado",
    color: "border-amber-400 bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-100",
    badgeColor: "border-amber-400 text-amber-700 dark:text-amber-300",
    desc: "Buscás un equilibrio entre seguridad y crecimiento. Podés tolerar cierta volatilidad a cambio de un mayor rendimiento potencial.",
    recomendaciones: ["📊 FCI Renta Fija", "📜 Bonos", "📈 Acciones estables", "🌎 CEDEARs select"],
  },
  agresivo: {
    emoji: "🚀",
    titulo: "Agresivo",
    color: "border-rose-400 bg-rose-50 dark:bg-rose-950 text-rose-900 dark:text-rose-100",
    badgeColor: "border-rose-400 text-rose-700 dark:text-rose-300",
    desc: "Estás dispuesto a asumir alta volatilidad a cambio de maximizar el rendimiento a largo plazo. Entendés que podés perder en el corto.",
    recomendaciones: ["📈 Acciones growth", "🌎 CEDEARs", "₿ Criptomonedas", "📊 FCI Variable"],
  },
};

// ── State ─────────────────────────────────────────────────────────────────────

let quizStep = 0;
let quizAnswers = [];
let quizPuntos = [];
let editingId = null;
let allInversiones = [];
let distChart = null;
let histChart = null;
let simChart = null;
let lastResumen = null;
let currentTab = "activo";
let currentHistInvId = null;
let currentDivInvId = null;
let cotizacionesData = null;

// ── Reference settings (localStorage) ────────────────────────────────────────

function loadRefs() {
  const inf = localStorage.getItem("inv_inflacion");
  const usd = localStorage.getItem("inv_usd");
  if (inf) document.getElementById("ref-inflacion").value = inf;
  if (usd) document.getElementById("ref-usd").value = usd;
}

function guardarRefs() {
  const inf = document.getElementById("ref-inflacion").value;
  const usd = document.getElementById("ref-usd").value;
  if (inf) localStorage.setItem("inv_inflacion", inf);
  if (usd) localStorage.setItem("inv_usd", usd);
  loadInversiones();
}

function getInflacion() {
  return parseFloat(localStorage.getItem("inv_inflacion") || "0") || 0;
}

function getUsdRate() {
  return parseFloat(localStorage.getItem("inv_usd") || "0") || 0;
}

// ── Panel macro + auto-sync de referencias ────────────────────────────────────

async function fetchReferencias(syncInputs = false) {
  const btnSync = document.getElementById("btn-sync-refs");
  if (btnSync) btnSync.style.opacity = "0.4";
  try {
    const data = await apiFetch("/api/inversiones/referencias");
    renderMacroPanel(data);
    if (syncInputs) {
      if (data.inflacion_anualizada !== null) {
        document.getElementById("ref-inflacion").value = data.inflacion_anualizada;
        localStorage.setItem("inv_inflacion", data.inflacion_anualizada);
      }
      if (data.usd_blue !== null) {
        document.getElementById("ref-usd").value = data.usd_blue;
        localStorage.setItem("inv_usd", data.usd_blue);
      }
      loadInversiones();
    }
  } catch (e) {
    console.warn("No se pudieron cargar las referencias de mercado:", e);
    const el = document.getElementById("macro-updated");
    if (el) el.textContent = "No se pudo conectar con los datos del mercado.";
  } finally {
    if (btnSync) btnSync.style.opacity = "1";
  }
}

function renderMacroPanel(data) {
  const fmtPesos = (v) => v !== null && v !== undefined ? `$${Math.round(v).toLocaleString("es-AR")}` : "—";
  const fmtPct = (v) => v !== null && v !== undefined ? `${Number(v).toFixed(1)}%` : "—";
  const fmtPuntos = (v) => v !== null && v !== undefined ? Number(v).toLocaleString("es-AR") + " pb" : "—";

  const elBlue = document.getElementById("macro-usd-blue");
  const elOficial = document.getElementById("macro-usd-oficial");
  const elInflacion = document.getElementById("macro-inflacion");
  const elRiesgo = document.getElementById("macro-riesgo");
  const elUpdated = document.getElementById("macro-updated");

  if (elBlue) elBlue.textContent = fmtPesos(data.usd_blue);
  if (elOficial) elOficial.textContent = fmtPesos(data.usd_oficial);
  if (elInflacion) elInflacion.textContent = fmtPct(data.inflacion_mensual);
  if (elRiesgo) elRiesgo.textContent = fmtPuntos(data.riesgo_pais);

  const now = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  if (elUpdated) elUpdated.textContent = `Datos del mercado actualizados a las ${now}`;

  // Auto-poblar refs si no hay valor guardado
  if (!localStorage.getItem("inv_inflacion") && data.inflacion_anualizada !== null) {
    document.getElementById("ref-inflacion").value = data.inflacion_anualizada;
    localStorage.setItem("inv_inflacion", data.inflacion_anualizada);
  }
  if (!localStorage.getItem("inv_usd") && data.usd_blue !== null) {
    document.getElementById("ref-usd").value = data.usd_blue;
    localStorage.setItem("inv_usd", data.usd_blue);
  }
}

// ── Main tab switching ────────────────────────────────────────────────────────

const MAIN_TABS = ["portafolio", "calculadora", "cotizaciones", "simulador"];

function setMainTab(tab) {
  MAIN_TABS.forEach((t) => {
    document.getElementById(`tab-${t}`).classList.toggle("hidden", t !== tab);
    document.getElementById(`main-tab-${t}`).className = t === tab
      ? "px-5 py-2 rounded-md text-sm font-semibold bg-blue-700 text-white transition"
      : "px-5 py-2 rounded-md text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition";
  });
  if (tab === "cotizaciones" && !cotizacionesData) fetchCotizaciones();
  if (window.lucide) lucide.createIcons();
}

// ── Initialization ────────────────────────────────────────────────────────────

async function init() {
  loadRefs();
  // Carga datos de mercado en paralelo sin bloquear la UI
  fetchReferencias(false);
  // Refresca cada 30 minutos
  setInterval(() => fetchReferencias(false), 30 * 60 * 1000);
  try {
    const perfil = await apiFetch("/api/inversiones/perfil");
    if (!perfil) {
      showQuiz();
    } else {
      showDashboard(perfil);
      await loadInversiones();
    }
  } catch (_) {
    showQuiz();
  }
}

function showQuiz() {
  document.getElementById("quiz-section").classList.remove("hidden");
  document.getElementById("quiz-resultado").classList.add("hidden");
  document.getElementById("dashboard-section").classList.add("hidden");
  document.getElementById("btn-retomar-quiz").classList.add("hidden");
  document.getElementById("btn-export").classList.add("hidden");
  quizStep = 0;
  quizAnswers = new Array(QUIZ.length).fill(null);
  quizPuntos = new Array(QUIZ.length).fill(0);
  renderQuizStep();
}

function startQuiz() {
  showQuiz();
}

function showDashboard(perfil) {
  document.getElementById("quiz-section").classList.add("hidden");
  document.getElementById("quiz-resultado").classList.add("hidden");
  document.getElementById("dashboard-section").classList.remove("hidden");
  document.getElementById("btn-retomar-quiz").classList.remove("hidden");
  document.getElementById("btn-export").classList.remove("hidden");
  document.getElementById("btn-export").classList.add("flex");
  renderPerfilBadge(perfil.perfil);
}

// ── Quiz rendering ────────────────────────────────────────────────────────────

function renderQuizStep() {
  const q = QUIZ[quizStep];
  const total = QUIZ.length;
  const pct = Math.round(((quizStep + 1) / total) * 100);

  document.getElementById("quiz-step-label").textContent = `Pregunta ${quizStep + 1} de ${total}`;
  document.getElementById("quiz-pct").textContent = `${pct}%`;
  document.getElementById("quiz-bar").style.width = `${pct}%`;
  document.getElementById("quiz-numero").textContent = String(quizStep + 1).padStart(2, "0");
  document.getElementById("quiz-pregunta").textContent = q.pregunta;

  document.getElementById("quiz-btn-ant").classList.toggle("hidden", quizStep === 0);
  const btnSig = document.getElementById("quiz-btn-sig");
  btnSig.textContent = quizStep === total - 1 ? "Ver mi perfil →" : "Siguiente →";
  btnSig.disabled = quizAnswers[quizStep] === null;

  const container = document.getElementById("quiz-opciones");
  container.innerHTML = q.opciones
    .map((op, idx) => {
      const selected = quizAnswers[quizStep] === idx;
      return `<button type="button" onclick="selectAnswer(${idx})"
        class="w-full text-left px-4 py-3.5 rounded-xl border-2 text-sm font-medium transition-all duration-150 ${
          selected
            ? "border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
            : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800"
        }">
        <span class="inline-block w-6 h-6 rounded-full border-2 ${selected ? "border-blue-600 bg-blue-600" : "border-slate-300 dark:border-slate-600"} mr-3 align-middle text-white text-xs flex-none inline-flex items-center justify-center">
          ${selected ? "✓" : ""}
        </span>
        ${op.texto}
      </button>`;
    })
    .join("");
}

function selectAnswer(opIdx) {
  quizAnswers[quizStep] = opIdx;
  quizPuntos[quizStep] = QUIZ[quizStep].opciones[opIdx].puntos;
  document.getElementById("quiz-btn-sig").disabled = false;
  renderQuizStep();
}

function quizAnterior() {
  if (quizStep > 0) { quizStep--; renderQuizStep(); }
}

function quizSiguiente() {
  if (quizAnswers[quizStep] === null) return;
  if (quizStep < QUIZ.length - 1) { quizStep++; renderQuizStep(); }
  else submitQuiz();
}

async function submitQuiz() {
  const puntaje = quizPuntos.reduce((a, b) => a + b, 0);
  const maxPuntaje = QUIZ.reduce((sum, q) => sum + Math.max(...q.opciones.map((o) => o.puntos)), 0);
  const pct = puntaje / maxPuntaje;

  let perfil;
  if (pct < 0.35) perfil = "conservador";
  else if (pct < 0.7) perfil = "moderado";
  else perfil = "agresivo";

  try {
    await apiFetch("/api/inversiones/perfil", {
      method: "POST",
      body: JSON.stringify({ perfil, puntaje, respuestas: JSON.stringify(quizAnswers) }),
    });
  } catch (_) {}

  showResultado(perfil, puntaje, maxPuntaje);
}

function showResultado(perfil, puntaje, maxPuntaje) {
  document.getElementById("quiz-section").classList.add("hidden");
  document.getElementById("quiz-resultado").classList.remove("hidden");

  const info = PERFILES[perfil];
  const card = document.getElementById("resultado-card");
  card.className = `rounded-2xl p-8 text-center mb-6 border-2 ${info.color}`;
  document.getElementById("resultado-emoji").textContent = info.emoji;
  document.getElementById("resultado-label").textContent = `Perfil inversor · ${puntaje}/${maxPuntaje} pts`;
  document.getElementById("resultado-titulo").textContent = info.titulo;
  document.getElementById("resultado-desc").textContent = info.desc;
  document.getElementById("resultado-recomendaciones").innerHTML = info.recomendaciones
    .map((r) => `<span class="px-3 py-1 rounded-full bg-white/50 dark:bg-black/20 text-xs font-semibold">${r}</span>`)
    .join("");
}

function irAInversiones() {
  document.getElementById("quiz-resultado").classList.add("hidden");
  document.getElementById("dashboard-section").classList.remove("hidden");
  document.getElementById("btn-retomar-quiz").classList.remove("hidden");
  document.getElementById("btn-export").classList.remove("hidden");
  document.getElementById("btn-export").classList.add("flex");
  loadInversiones();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function renderPerfilBadge(perfil) {
  const info = PERFILES[perfil] || PERFILES.moderado;
  const badge = document.getElementById("perfil-badge");
  badge.className = `flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 w-fit ${info.badgeColor}`;
  badge.classList.remove("hidden");
  document.getElementById("badge-emoji").textContent = info.emoji;
  document.getElementById("badge-label").textContent = "Perfil inversor";
  document.getElementById("badge-titulo").textContent = info.titulo;
}

async function loadInversiones() {
  try {
    const [items, resumen] = await Promise.all([
      apiFetch("/api/inversiones"),
      apiFetch("/api/inversiones/resumen"),
    ]);
    allInversiones = items;
    lastResumen = resumen;
    renderAlertas(resumen.alertas_vencimiento || []);
    renderKPIs(resumen);
    renderArsUsdSplit(resumen);
    renderChart(resumen.por_tipo);
    renderTipoList(resumen.por_tipo);
    renderGrid();
  } catch (e) {
    console.error(e);
  }
}

// ── Formatters & helpers ──────────────────────────────────────────────────────

function fmtARS(n) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

function fmtUSD(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function rendColor(val) {
  return val >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Alertas de vencimiento ────────────────────────────────────────────────────

function renderAlertas(alertas) {
  const el = document.getElementById("alertas-venc");
  if (!alertas.length) { el.innerHTML = ""; return; }
  el.innerHTML = alertas.map((a) => {
    const urgente = a.dias_vencimiento <= 0;
    const cls = urgente
      ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
      : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300";
    const diasTxt = a.dias_vencimiento < 0
      ? `Venció hace ${Math.abs(a.dias_vencimiento)} día(s)`
      : a.dias_vencimiento === 0
      ? "Vence HOY"
      : `Vence en ${a.dias_vencimiento} día(s)`;
    const fmt = a.moneda === "USD" ? fmtUSD : fmtARS;
    return `<div class="flex items-center justify-between px-4 py-2.5 rounded-lg border ${cls} text-sm">
      <span>${a.icono} <strong>${a.nombre}</strong> — ${diasTxt}</span>
      <span class="font-semibold shrink-0 ml-4">${fmt(a.monto)}</span>
    </div>`;
  }).join("");
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

function renderKPIs(resumen) {
  const ars = resumen.ars;
  const usd = resumen.usd;
  const inflacion = getInflacion();
  const usdRate = getUsdRate();

  // ARS
  setText("kpi-ars-inv", fmtARS(ars.invertido));
  setText("kpi-ars-act", fmtARS(ars.actual));

  const arsRend = document.getElementById("kpi-ars-rend");
  if (arsRend) {
    arsRend.textContent = (ars.rendimiento >= 0 ? "+" : "") + fmtARS(ars.rendimiento);
    arsRend.className = `text-lg font-bold mt-1 ${rendColor(ars.rendimiento)}`;
  }
  const arsPct = document.getElementById("kpi-ars-pct");
  if (arsPct) {
    arsPct.textContent = (ars.rendimiento_pct >= 0 ? "+" : "") + ars.rendimiento_pct.toFixed(2) + "%";
    arsPct.className = `text-xs font-semibold mt-0.5 ${rendColor(ars.rendimiento_pct)}`;
  }

  // Real return vs inflation
  const arsRealEl = document.getElementById("kpi-ars-real");
  if (arsRealEl) {
    if (inflacion > 0 && ars.invertido > 0) {
      const realPct = ((1 + ars.rendimiento_pct / 100) / (1 + inflacion / 100) - 1) * 100;
      arsRealEl.textContent = (realPct >= 0 ? "+" : "") + realPct.toFixed(2) + "%";
      arsRealEl.className = `text-lg font-bold mt-1 ${rendColor(realPct)}`;
    } else {
      arsRealEl.textContent = "—";
      arsRealEl.className = "text-lg font-bold mt-1 text-slate-400";
    }
  }

  setText("kpi-ars-div", fmtARS(ars.dividendos || 0));

  // USD
  const usdSection = document.getElementById("usd-section");
  if (usd.cantidad > 0) {
    usdSection.classList.remove("hidden");
    setText("kpi-usd-inv", fmtUSD(usd.invertido));
    setText("kpi-usd-act", fmtUSD(usd.actual));

    const usdRend = document.getElementById("kpi-usd-rend");
    if (usdRend) {
      usdRend.textContent = (usd.rendimiento >= 0 ? "+" : "") + fmtUSD(usd.rendimiento);
      usdRend.className = `text-lg font-bold mt-1 ${rendColor(usd.rendimiento)}`;
    }
    const usdPct = document.getElementById("kpi-usd-pct");
    if (usdPct) {
      usdPct.textContent = (usd.rendimiento_pct >= 0 ? "+" : "") + usd.rendimiento_pct.toFixed(2) + "%";
      usdPct.className = `text-xs font-semibold mt-0.5 ${rendColor(usd.rendimiento_pct)}`;
    }

    const enArsEl = document.getElementById("kpi-usd-en-ars");
    if (enArsEl) {
      enArsEl.textContent = usdRate > 0 ? fmtARS(usd.actual * usdRate) : "—";
    }

    setText("kpi-usd-div", fmtUSD(usd.dividendos || 0));
  } else {
    usdSection.classList.add("hidden");
  }
}

// ── ARS vs USD split bar ──────────────────────────────────────────────────────

function renderArsUsdSplit(resumen) {
  const ars = resumen.ars;
  const usd = resumen.usd;
  const usdRate = getUsdRate();
  const arsTotal = ars.actual;
  const usdEnArs = usd.cantidad > 0 && usdRate > 0 ? usd.actual * usdRate : 0;
  const total = arsTotal + usdEnArs;

  const splitSection = document.getElementById("ars-usd-split");
  if (total <= 0 || usd.cantidad === 0 || usdRate === 0) {
    splitSection.classList.add("hidden");
    return;
  }
  splitSection.classList.remove("hidden");

  const arsPct = Math.round((arsTotal / total) * 100);
  const usdPct = 100 - arsPct;

  document.getElementById("split-bar").innerHTML = `
    <div style="width:${arsPct}%" class="bg-blue-500 h-full"></div>
    <div style="width:${usdPct}%" class="bg-emerald-500 h-full"></div>`;
  document.getElementById("split-labels").innerHTML = `
    <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>ARS ${arsPct}%</span>
    <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>USD ${usdPct}%</span>`;
}

// ── Donut chart ───────────────────────────────────────────────────────────────

const CHART_PALETTE = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316","#6366f1"];

function renderChart(porTipo) {
  const noDiv = document.getElementById("no-dist");
  if (!porTipo || porTipo.length === 0) {
    noDiv.classList.remove("hidden");
    if (distChart) { distChart.destroy(); distChart = null; }
    return;
  }
  noDiv.classList.add("hidden");
  const labels = porTipo.map((t) => `${t.icono} ${t.label}`);
  const values = porTipo.map((t) => t.ars + t.usd);

  if (distChart) {
    distChart.data.labels = labels;
    distChart.data.datasets[0].data = values;
    distChart.update();
  } else {
    distChart = new Chart(document.getElementById("dist-chart"), {
      type: "doughnut",
      data: { labels, datasets: [{ data: values, backgroundColor: CHART_PALETTE }] },
      options: {
        cutout: "65%",
        plugins: { legend: { position: "bottom", labels: { font: { size: 10 }, color: "#6b7280", boxWidth: 10 } } },
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  }
}

function renderTipoList(porTipo) {
  const el = document.getElementById("tipo-list");
  if (!porTipo || porTipo.length === 0) {
    el.innerHTML = '<p class="text-slate-400 text-sm">Sin inversiones activas</p>';
    return;
  }
  el.innerHTML = porTipo
    .map((t) => {
      const parts = [t.ars > 0 ? fmtARS(t.ars) : null, t.usd > 0 ? fmtUSD(t.usd) : null].filter(Boolean);
      return `<div class="flex items-center gap-3">
        <span class="text-xl">${t.icono}</span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">${t.label}</p>
            <p class="text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0">${parts.join(" / ") || "—"}</p>
          </div>
          <p class="text-xs text-slate-400">${t.count} inversión${t.count !== 1 ? "es" : ""}</p>
        </div>
      </div>`;
    })
    .join("");
}

// ── Grid de inversiones ───────────────────────────────────────────────────────

function setTab(tab) {
  currentTab = tab;
  ["activo", "cerrado", "todas"].forEach((t) => {
    document.getElementById(`tab-${t}`).className =
      t === tab
        ? "px-4 py-1.5 rounded-md text-sm font-medium bg-blue-700 text-white transition"
        : "px-4 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition";
  });
  renderGrid();
}

function renderGrid() {
  let items = allInversiones;
  if (currentTab === "activo") items = items.filter((i) => i.estado === "activo");
  else if (currentTab === "cerrado") items = items.filter((i) => i.estado !== "activo");

  const grid = document.getElementById("inversiones-grid");
  if (items.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
        <i data-lucide="trending-up" class="w-10 h-10"></i>
        <p class="text-sm">No hay inversiones registradas</p>
        <button onclick="openModal()" class="text-sm text-blue-600 dark:text-blue-400 hover:underline">+ Agregar la primera</button>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }
  grid.innerHTML = items.map((inv) => invCard(inv)).join("");
  if (window.lucide) lucide.createIcons();
}

function estadoBadge(inv) {
  const map = {
    activo: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
    cerrado: "bg-slate-100 dark:bg-slate-800 text-slate-500",
    vencido: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  };
  const labels = { activo: "Activa", cerrado: "Cerrada", vencido: "Vencida" };
  return { cls: map[inv.estado] || map.activo, text: labels[inv.estado] || inv.estado };
}

function invCard(inv) {
  const { cls: estadoCls, text: estadoText } = estadoBadge(inv);
  const positivo = inv.rendimiento >= 0;
  const rendCls = positivo ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  const rendSign = positivo ? "+" : "";
  const fmt = inv.moneda === "USD" ? fmtUSD : fmtARS;

  let vencInfo = "";
  if (inv.fecha_vencimiento) {
    const dias = inv.dias_vencimiento;
    if (dias !== null) {
      if (dias < 0) vencInfo = `<p class="text-xs text-red-500">Venció hace ${Math.abs(dias)}d</p>`;
      else if (dias === 0) vencInfo = `<p class="text-xs text-red-500">Vence hoy</p>`;
      else if (dias <= 7) vencInfo = `<p class="text-xs text-amber-500">Vence en ${dias}d</p>`;
      else {
        const d = new Date(inv.fecha_vencimiento + "T12:00:00");
        vencInfo = `<p class="text-xs text-slate-400">Vence ${d.toLocaleDateString("es-AR", { day:"2-digit", month:"2-digit", year:"numeric" })}</p>`;
      }
    }
  }

  const tnaInfo = inv.tasa_anual ? `<p class="text-xs text-slate-400">TNA ${inv.tasa_anual}%</p>` : "";

  const divInfo = (inv.total_dividendos_ars > 0 || inv.total_dividendos_usd > 0)
    ? `<p class="text-xs text-emerald-600 dark:text-emerald-400">
        Dividendos: ${inv.total_dividendos_ars > 0 ? fmtARS(inv.total_dividendos_ars) : ""}${inv.total_dividendos_ars > 0 && inv.total_dividendos_usd > 0 ? " · " : ""}${inv.total_dividendos_usd > 0 ? fmtUSD(inv.total_dividendos_usd) : ""}
       </p>`
    : "";

  const tesisInfo = inv.notas_tesis
    ? `<p class="text-xs text-slate-400 italic line-clamp-2 border-l-2 border-slate-200 dark:border-slate-700 pl-2">${inv.notas_tesis}</p>`
    : "";

  const nombre = inv.nombre.replace(/'/g, "\\'");

  return `
    <div class="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-5 flex flex-col gap-3">
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-2xl shrink-0">${inv.icono}</span>
          <div class="min-w-0">
            <p class="font-semibold text-slate-800 dark:text-white text-sm leading-tight truncate">${inv.nombre}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">${inv.tipo_label} · ${inv.moneda}</p>
          </div>
        </div>
        <span class="text-xs px-2 py-0.5 rounded-full ${estadoCls} font-medium shrink-0">${estadoText}</span>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <div>
          <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Invertido</p>
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-0.5">${fmt(inv.monto_invertido)}</p>
        </div>
        <div>
          <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Valor actual</p>
          <p class="text-sm font-semibold text-slate-800 dark:text-white mt-0.5">${fmt(inv.valor_actual)}</p>
        </div>
        <div>
          <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Rendimiento</p>
          <p class="text-sm font-semibold mt-0.5 ${rendCls}">${rendSign}${inv.rendimiento_pct.toFixed(1)}%</p>
          <p class="text-[10px] ${rendCls}">${rendSign}${fmt(inv.rendimiento)}</p>
        </div>
      </div>

      ${vencInfo}${tnaInfo}${divInfo}
      ${inv.notas ? `<p class="text-xs text-slate-400 italic truncate">${inv.notas}</p>` : ""}
      ${tesisInfo}

      <div class="flex gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800 flex-wrap">
        <button onclick="openValorModal(${inv.id})"
          class="flex-1 text-xs font-medium py-1.5 rounded-md border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition min-w-[80px]">
          Actualizar
        </button>
        <button onclick="openHistoricoModal(${inv.id})"
          class="flex-1 text-xs font-medium py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition min-w-[60px]">
          Historial
        </button>
        <button onclick="openDivModal(${inv.id})"
          class="flex-1 text-xs font-medium py-1.5 rounded-md border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition min-w-[70px]">
          Dividendos
        </button>
        <button onclick="openEdit(${inv.id})"
          class="text-xs font-medium py-1.5 px-2.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
          <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
        </button>
        <button onclick="deleteInversion(${inv.id}, '${nombre}')"
          class="text-xs font-medium py-1.5 px-2.5 rounded-md border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    </div>`;
}

// ── Modal agregar/editar ──────────────────────────────────────────────────────

const TIPOS_CON_VENCIMIENTO = ["plazo_fijo", "bonos", "fci"];
const TIPOS_CON_TNA = ["plazo_fijo"];
const TIPOS_CON_TICKER = ["acciones", "cedears", "bonos", "cripto"];

function onTipoChange() {
  const tipo = document.getElementById("i-tipo").value;
  document.getElementById("campo-vencimiento").classList.toggle("hidden", !TIPOS_CON_VENCIMIENTO.includes(tipo));
  document.getElementById("campo-tna").classList.toggle("hidden", !TIPOS_CON_TNA.includes(tipo));
  document.getElementById("campo-ticker").classList.toggle("hidden", !TIPOS_CON_TICKER.includes(tipo));

  const hint = document.getElementById("ticker-label-hint");
  const input = document.getElementById("i-ticker");
  if (tipo === "cripto") {
    hint.textContent = "(ID de CoinGecko)";
    input.placeholder = "Ej: bitcoin, ethereum, solana";
  } else {
    hint.textContent = "(Yahoo Finance)";
    input.placeholder = "Ej: GGAL.BA, AAPL, AL30.BA";
  }
}

function openModal() {
  editingId = null;
  document.getElementById("modal-title").textContent = "Nueva inversión";
  document.getElementById("inv-form").reset();
  document.getElementById("modal-error").classList.add("hidden");
  document.getElementById("campo-vencimiento").classList.add("hidden");
  document.getElementById("campo-tna").classList.add("hidden");
  document.getElementById("campo-ticker").classList.add("hidden");
  document.getElementById("i-fecha-inicio").value = new Date().toISOString().split("T")[0];
  document.querySelector('input[name="i-moneda"][value="ARS"]').checked = true;
  document.getElementById("modal").classList.remove("hidden");
}

function openEdit(id) {
  const inv = allInversiones.find((x) => x.id === id);
  if (!inv) return;
  editingId = id;
  document.getElementById("modal-title").textContent = "Editar inversión";
  document.getElementById("modal-error").classList.add("hidden");
  document.getElementById("i-tipo").value = inv.tipo;
  onTipoChange();
  document.getElementById("i-nombre").value = inv.nombre;
  document.querySelector(`input[name="i-moneda"][value="${inv.moneda}"]`).checked = true;
  document.getElementById("i-fecha-inicio").value = inv.fecha_inicio;
  document.getElementById("i-monto").value = inv.monto_invertido;
  document.getElementById("i-valor-actual").value = inv.valor_actual;
  document.getElementById("i-fecha-venc").value = inv.fecha_vencimiento || "";
  document.getElementById("i-tna").value = inv.tasa_anual || "";
  document.getElementById("i-notas").value = inv.notas || "";
  document.getElementById("i-tesis").value = inv.notas_tesis || "";
  document.getElementById("i-ticker").value = inv.ticker || "";
  document.getElementById("modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
  editingId = null;
}

document.getElementById("inv-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("modal-error");
  errEl.classList.add("hidden");

  const moneda = document.querySelector('input[name="i-moneda"]:checked').value;
  const monto = parseFloat(document.getElementById("i-monto").value);
  const valorActual = document.getElementById("i-valor-actual").value;
  const tna = document.getElementById("i-tna").value;
  const fechaVenc = document.getElementById("i-fecha-venc").value;

  const payload = {
    tipo: document.getElementById("i-tipo").value,
    nombre: document.getElementById("i-nombre").value.trim(),
    moneda,
    monto_invertido: monto,
    valor_actual: valorActual ? parseFloat(valorActual) : monto,
    fecha_inicio: document.getElementById("i-fecha-inicio").value,
    fecha_vencimiento: fechaVenc || null,
    tasa_anual: tna ? parseFloat(tna) : null,
    notas: document.getElementById("i-notas").value.trim(),
    notas_tesis: document.getElementById("i-tesis").value.trim(),
    ticker: document.getElementById("i-ticker").value.trim(),
  };

  const btn = e.target.querySelector('[type="submit"]');
  btn.disabled = true;
  btn.textContent = "Guardando...";

  try {
    if (editingId) {
      await apiFetch(`/api/inversiones/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await apiFetch("/api/inversiones", { method: "POST", body: JSON.stringify(payload) });
    }
    closeModal();
    await loadInversiones();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar";
  }
});

// ── Modal actualizar valor ────────────────────────────────────────────────────

function openValorModal(id) {
  const inv = allInversiones.find((x) => x.id === id);
  if (!inv) return;
  document.getElementById("valor-inv-id").value = id;
  document.getElementById("valor-nombre").textContent = `${inv.icono} ${inv.nombre}`;
  document.getElementById("valor-input").value = inv.valor_actual;
  document.getElementById("valor-estado").value = inv.estado;
  document.getElementById("valor-error").classList.add("hidden");
  document.getElementById("modal-valor").classList.remove("hidden");
}

function closeValorModal() {
  document.getElementById("modal-valor").classList.add("hidden");
}

document.getElementById("valor-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("valor-error");
  errEl.classList.add("hidden");
  const id = document.getElementById("valor-inv-id").value;
  const payload = {
    valor_actual: parseFloat(document.getElementById("valor-input").value),
    estado: document.getElementById("valor-estado").value,
  };
  const btn = e.target.querySelector('[type="submit"]');
  btn.disabled = true;
  try {
    await apiFetch(`/api/inversiones/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    closeValorModal();
    await loadInversiones();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
});

// ── Modal historial de valores ────────────────────────────────────────────────

async function openHistoricoModal(id) {
  currentHistInvId = id;
  const inv = allInversiones.find((x) => x.id === id);
  document.getElementById("hist-nombre").textContent = inv ? `${inv.icono} ${inv.nombre}` : "";
  document.getElementById("hist-tabla").innerHTML = '<p class="text-slate-400 text-sm">Cargando...</p>';
  document.getElementById("hist-fecha").value = new Date().toISOString().split("T")[0];
  document.getElementById("modal-historico").classList.remove("hidden");

  try {
    const items = await apiFetch(`/api/inversiones/${id}/historico`);
    renderHistoricoTable(items);
    renderHistoricoChart(items, inv?.moneda);
  } catch (e) {
    document.getElementById("hist-tabla").textContent = "Error al cargar";
  }
}

function closeHistoricoModal() {
  document.getElementById("modal-historico").classList.add("hidden");
  currentHistInvId = null;
}

function renderHistoricoTable(items) {
  if (!items.length) {
    document.getElementById("hist-tabla").innerHTML = '<p class="text-slate-400 text-sm">Sin registros históricos</p>';
    return;
  }
  document.getElementById("hist-tabla").innerHTML = `
    <table class="w-full text-xs">
      <thead><tr class="text-slate-400 border-b border-slate-100 dark:border-slate-800">
        <th class="text-left py-1.5">Fecha</th>
        <th class="text-right py-1.5">Valor</th>
      </tr></thead>
      <tbody>${[...items].reverse().map((h) => `<tr class="border-b border-slate-50 dark:border-slate-800/50">
        <td class="py-1.5 text-slate-500 dark:text-slate-400">${h.fecha}</td>
        <td class="py-1.5 text-right font-medium text-slate-800 dark:text-white">${h.valor.toLocaleString("es-AR")}</td>
      </tr>`).join("")}</tbody>
    </table>`;
}

function renderHistoricoChart(items, moneda) {
  const ctx = document.getElementById("hist-chart");
  if (histChart) { histChart.destroy(); histChart = null; }
  if (!items || items.length < 2) return;

  const color = moneda === "USD" ? "#10b981" : "#3b82f6";
  histChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: items.map((h) => h.fecha),
      datasets: [{
        data: items.map((h) => h.valor),
        borderColor: color,
        backgroundColor: color + "20",
        fill: true,
        tension: 0.3,
        pointRadius: items.length > 20 ? 0 : 3,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { font: { size: 9 }, maxTicksLimit: 8, color: "#6b7280" }, grid: { display: false } },
        y: { ticks: { font: { size: 9 }, color: "#6b7280" } },
      },
    },
  });
}

document.getElementById("hist-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentHistInvId) return;
  const btn = e.target.querySelector("button");
  btn.disabled = true;
  btn.textContent = "...";
  try {
    await apiFetch(`/api/inversiones/${currentHistInvId}/historico`, {
      method: "POST",
      body: JSON.stringify({
        valor: parseFloat(document.getElementById("hist-valor").value),
        fecha: document.getElementById("hist-fecha").value,
      }),
    });
    document.getElementById("hist-valor").value = "";
    const items = await apiFetch(`/api/inversiones/${currentHistInvId}/historico`);
    const inv = allInversiones.find((x) => x.id === currentHistInvId);
    renderHistoricoTable(items);
    renderHistoricoChart(items, inv?.moneda);
    await loadInversiones();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Agregar";
  }
});

// ── Modal dividendos ──────────────────────────────────────────────────────────

async function openDivModal(id) {
  currentDivInvId = id;
  const inv = allInversiones.find((x) => x.id === id);
  document.getElementById("div-nombre").textContent = inv ? `${inv.icono} ${inv.nombre}` : "";
  document.getElementById("div-tabla").innerHTML = '<p class="text-slate-400 text-sm">Cargando...</p>';
  document.getElementById("div-fecha").value = new Date().toISOString().split("T")[0];
  document.getElementById("modal-dividendos").classList.remove("hidden");

  try {
    const items = await apiFetch(`/api/inversiones/${id}/dividendos`);
    renderDivTotales(items);
    renderDivTabla(items);
  } catch (e) {
    document.getElementById("div-tabla").textContent = "Error al cargar";
  }
}

function closeDivModal() {
  document.getElementById("modal-dividendos").classList.add("hidden");
  currentDivInvId = null;
}

function renderDivTotales(items) {
  const arsTotal = items.filter((d) => d.moneda === "ARS").reduce((s, d) => s + d.monto, 0);
  const usdTotal = items.filter((d) => d.moneda === "USD").reduce((s, d) => s + d.monto, 0);
  const el = document.getElementById("div-totales");
  if (!items.length) {
    el.innerHTML = '<p class="text-sm text-slate-400">Sin dividendos registrados aún</p>';
    return;
  }
  el.innerHTML = [
    arsTotal > 0 ? `<div><p class="text-xs text-slate-500 mb-0.5">ARS cobrados</p><p class="text-lg font-bold text-emerald-600 dark:text-emerald-400">${fmtARS(arsTotal)}</p></div>` : "",
    usdTotal > 0 ? `<div><p class="text-xs text-slate-500 mb-0.5">USD cobrados</p><p class="text-lg font-bold text-emerald-600 dark:text-emerald-400">${fmtUSD(usdTotal)}</p></div>` : "",
  ].join("");
}

function renderDivTabla(items) {
  const el = document.getElementById("div-tabla");
  if (!items.length) { el.innerHTML = ""; return; }
  const tipoLabel = { dividendo: "Dividendo", cupon: "Cupón", renta: "Renta", otro: "Otro" };
  el.innerHTML = `
    <table class="w-full text-xs">
      <thead><tr class="text-slate-400 border-b border-slate-100 dark:border-slate-800">
        <th class="text-left py-1.5">Fecha</th>
        <th class="text-left py-1.5">Tipo</th>
        <th class="text-right py-1.5">Monto</th>
        <th class="py-1.5 w-6"></th>
      </tr></thead>
      <tbody>${items.map((d) => `<tr class="border-b border-slate-50 dark:border-slate-800/50">
        <td class="py-1.5 text-slate-500 dark:text-slate-400">${d.fecha}</td>
        <td class="py-1.5 text-slate-600 dark:text-slate-400">${tipoLabel[d.tipo] || d.tipo}${d.notas ? ` <span class="text-slate-400">· ${d.notas}</span>` : ""}</td>
        <td class="py-1.5 text-right font-medium text-emerald-600 dark:text-emerald-400">${d.moneda === "USD" ? fmtUSD(d.monto) : fmtARS(d.monto)}</td>
        <td class="py-1.5 text-right"><button onclick="deleteDividendo(${d.id})" class="text-red-400 hover:text-red-600 px-1 leading-none">✕</button></td>
      </tr>`).join("")}</tbody>
    </table>`;
}

async function deleteDividendo(divId) {
  if (!confirm("¿Eliminar este dividendo?")) return;
  try {
    await apiFetch(`/api/inversiones/dividendos/${divId}`, { method: "DELETE" });
    const items = await apiFetch(`/api/inversiones/${currentDivInvId}/dividendos`);
    renderDivTotales(items);
    renderDivTabla(items);
    await loadInversiones();
  } catch (e) {
    alert(e.message);
  }
}

document.getElementById("div-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentDivInvId) return;
  const btn = e.target.querySelector("button");
  btn.disabled = true;
  btn.textContent = "Guardando...";
  try {
    await apiFetch(`/api/inversiones/${currentDivInvId}/dividendos`, {
      method: "POST",
      body: JSON.stringify({
        monto: parseFloat(document.getElementById("div-monto").value),
        moneda: document.getElementById("div-moneda").value,
        fecha: document.getElementById("div-fecha").value,
        tipo: document.getElementById("div-tipo").value,
        notas: document.getElementById("div-notas").value.trim(),
      }),
    });
    document.getElementById("div-monto").value = "";
    document.getElementById("div-notas").value = "";
    const items = await apiFetch(`/api/inversiones/${currentDivInvId}/dividendos`);
    renderDivTotales(items);
    renderDivTabla(items);
    await loadInversiones();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Registrar";
  }
});

// ── Eliminar inversión ────────────────────────────────────────────────────────

async function deleteInversion(id, nombre) {
  if (!confirm(`¿Eliminar "${nombre}"?`)) return;
  try {
    await apiFetch(`/api/inversiones/${id}`, { method: "DELETE" });
    await loadInversiones();
  } catch (e) {
    alert(e.message);
  }
}

// ── Calculadora PF ────────────────────────────────────────────────────────────

function calcular() {
  const capital = parseFloat(document.getElementById("calc-capital").value);
  const tna = parseFloat(document.getElementById("calc-tna").value);
  const plazo = parseInt(document.getElementById("calc-plazo").value);
  const unidad = document.getElementById("calc-unidad").value;

  if (!capital || !tna || !plazo) return;

  const dias = unidad === "meses" ? Math.round(plazo * 30.44) : plazo;
  const rendPeriodo = (tna / 100 / 365) * dias;
  const final = capital * (1 + rendPeriodo);
  const ganancia = final - capital;
  const rendPct = rendPeriodo * 100;
  const tea = (Math.pow(1 + tna / 100 / 365, 365) - 1) * 100;

  setText("c-capital", fmtARS(capital));
  setText("c-final", fmtARS(final));
  setText("c-ganancia", "+" + fmtARS(ganancia));
  setText("c-rend-pct", "+" + rendPct.toFixed(2) + "%");
  setText("c-tea", tea.toFixed(2) + "% anual");
  setText("c-dias", `${dias} días`);

  // vs inflación
  const inflacion = getInflacion();
  if (inflacion > 0) {
    const infPeriodo = Math.pow(1 + inflacion / 100, dias / 365) - 1;
    const realPct = ((1 + rendPeriodo) / (1 + infPeriodo) - 1) * 100;
    setText("c-inf-label", `Inflación anual referencia: ${inflacion}%`);
    const infEl = document.getElementById("c-inf-rend");
    infEl.textContent = (realPct >= 0 ? "+" : "") + realPct.toFixed(2) + "% real";
    infEl.className = `text-xl font-bold ${rendColor(realPct)}`;
    setText("c-inf-desc", realPct >= 0
      ? "✓ La inversión supera la inflación del período"
      : "✗ La inversión no cubre la inflación del período");
  } else {
    setText("c-inf-label", "Configurá la inflación de referencia en el portafolio");
    setText("c-inf-rend", "—");
    document.getElementById("c-inf-rend").className = "text-xl font-bold text-slate-400";
    setText("c-inf-desc", "");
  }

  // vs dólar
  const usdRate = getUsdRate();
  if (usdRate > 0) {
    const capitalUSD = capital / usdRate;
    const finalUSD = final / usdRate;
    setText("c-usd-label", `Al tipo de cambio: $${usdRate.toLocaleString("es-AR")}/USD`);
    document.getElementById("c-usd-result").innerHTML = `
      <p class="text-sm text-slate-600 dark:text-slate-400">Capital: <strong class="text-slate-800 dark:text-white">${fmtUSD(capitalUSD)}</strong></p>
      <p class="text-sm text-slate-600 dark:text-slate-400">Al vencer: <strong class="text-slate-800 dark:text-white">${fmtUSD(finalUSD)}</strong></p>
      <p class="text-xs text-slate-400 mt-1">Asumiendo tipo de cambio fijo</p>`;
  } else {
    setText("c-usd-label", "Configurá el tipo de cambio en el portafolio");
    document.getElementById("c-usd-result").innerHTML = '<p class="text-slate-400">—</p>';
  }

  document.getElementById("calc-resultado").classList.remove("hidden");
}

// ── CSV export (with JWT auth) ────────────────────────────────────────────────

document.getElementById("btn-export").addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    const token = localStorage.getItem("token");
    const resp = await fetch("/api/inversiones/exportar-csv", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error("Error al exportar");
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inversiones.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(err.message);
  }
});

// ── Cerrar modales al click fuera ─────────────────────────────────────────────

["modal", "modal-valor", "modal-historico", "modal-dividendos"].forEach((id) => {
  document.getElementById(id).addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.classList.add("hidden");
      if (id === "modal") editingId = null;
      if (id === "modal-historico") currentHistInvId = null;
      if (id === "modal-dividendos") currentDivInvId = null;
    }
  });
});

// ── Cotizaciones ──────────────────────────────────────────────────────────────

async function fetchCotizaciones() {
  const btn = document.getElementById("btn-refresh-cotiz");
  const statusEl = document.getElementById("cotiz-status");
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Actualizando...';
  if (window.lucide) lucide.createIcons();
  statusEl.textContent = "Consultando fuentes externas...";
  try {
    cotizacionesData = await apiFetch("/api/inversiones/cotizaciones");
    renderCotizaciones(cotizacionesData);
    const now = new Date();
    statusEl.textContent = `Última actualización: ${now.toLocaleTimeString("es-AR")}`;
  } catch (e) {
    statusEl.textContent = "Error al cargar cotizaciones. Intentá de nuevo.";
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4"></i> Actualizar precios';
    if (window.lucide) lucide.createIcons();
  }
}

function renderCotizaciones(data) {
  renderDolarPanel(data.dolar || []);
  renderAccionesPanel(data.acciones || {});
  renderCriptoPanel(data.cripto || {});
  if ((data.errores || []).includes("yfinance_no_instalado")) {
    document.getElementById("cotiz-status").textContent +=
      " · yfinance no instalado — ejecutá: pip install yfinance";
  }
}

const DOLAR_CASA = {
  oficial:         { label: "Oficial",   icon: "🏛" },
  blue:            { label: "Blue",      icon: "💵" },
  bolsa:           { label: "MEP / Bolsa", icon: "📊" },
  contadoconliqui: { label: "CCL",       icon: "🌎" },
  mayorista:       { label: "Mayorista", icon: "🏦" },
  cripto:          { label: "Cripto",    icon: "₿" },
  tarjeta:         { label: "Tarjeta",   icon: "💳" },
};

function renderDolarPanel(dolares) {
  const el = document.getElementById("cotiz-dolar-grid");
  if (!dolares.length) {
    el.innerHTML = '<p class="text-slate-400 text-sm col-span-full">No se pudo obtener el tipo de cambio en este momento.</p>';
    return;
  }
  el.innerHTML = dolares.map((d) => {
    const info = DOLAR_CASA[d.casa] || { label: d.nombre, icon: "💲" };
    const compra = d.compra
      ? `<div><p class="text-[10px] text-slate-400 mb-0.5">Compra</p><p class="text-base font-bold text-slate-800 dark:text-white">${fmtARS(d.compra)}</p></div>`
      : "";
    const venta = d.venta
      ? `<div class="text-right"><p class="text-[10px] text-slate-400 mb-0.5">Venta</p><p class="text-base font-bold text-blue-600 dark:text-blue-400">${fmtARS(d.venta)}</p></div>`
      : "";
    return `<div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">${info.icon} ${info.label}</p>
      <div class="flex justify-between items-end gap-2">${compra}${venta}</div>
    </div>`;
  }).join("");
}

function renderAccionesPanel(acciones) {
  const items = Object.values(acciones);
  const section = document.getElementById("cotiz-activos-section");
  if (!items.length) { section.classList.add("hidden"); return; }
  section.classList.remove("hidden");

  const TIPO_ICON = { acciones: "📈", cedears: "🌎", bonos: "📜" };
  document.getElementById("cotiz-activos-tbody").innerHTML = items.map((a) => {
    const precioTxt = a.precio != null
      ? `<span class="font-bold text-slate-800 dark:text-white">${a.precio.toLocaleString("es-AR", { maximumFractionDigits: 4 })}</span>`
      : '<span class="text-slate-400">No disponible</span>';
    return `<tr class="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
      <td class="px-4 py-3">
        <span class="mr-1">${TIPO_ICON[a.tipo] || "📈"}</span>
        <span class="font-medium text-slate-700 dark:text-slate-200">${a.nombre}</span>
      </td>
      <td class="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">${a.ticker}</td>
      <td class="px-4 py-3 text-right">${precioTxt}</td>
      <td class="px-4 py-3 text-right text-xs text-slate-400">${a.currency || a.moneda}</td>
      <td class="px-4 py-3 text-right">
        ${a.precio != null
          ? `<button onclick="openValorModalConPrecio(${a.inv_id}, ${a.precio})"
              class="text-xs font-medium px-3 py-1.5 rounded-md border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition whitespace-nowrap">
              Usar precio
            </button>`
          : ""}
      </td>
    </tr>`;
  }).join("");
}

function renderCriptoPanel(cripto) {
  const items = Object.values(cripto);
  const section = document.getElementById("cotiz-cripto-section");
  if (!items.length) { section.classList.add("hidden"); return; }
  section.classList.remove("hidden");

  document.getElementById("cotiz-cripto-tbody").innerHTML = items.map((c) => {
    const usdTxt = c.precio_usd != null ? `<span class="font-bold text-slate-800 dark:text-white">${fmtUSD(c.precio_usd)}</span>` : '<span class="text-slate-400">—</span>';
    const arsTxt = c.precio_ars != null ? `<span class="font-bold text-slate-800 dark:text-white">${fmtARS(c.precio_ars)}</span>` : '<span class="text-slate-400">—</span>';
    return `<tr class="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
      <td class="px-4 py-3">
        <span class="mr-1">₿</span>
        <span class="font-medium text-slate-700 dark:text-slate-200">${c.nombre}</span>
      </td>
      <td class="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">${c.ticker}</td>
      <td class="px-4 py-3 text-right">${usdTxt}</td>
      <td class="px-4 py-3 text-right">${arsTxt}</td>
      <td class="px-4 py-3 text-right">
        ${c.precio_usd != null
          ? `<button onclick="openValorModalConPrecio(${c.inv_id}, ${c.precio_usd})"
              class="text-xs font-medium px-3 py-1.5 rounded-md border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition whitespace-nowrap">
              Usar precio
            </button>`
          : ""}
      </td>
    </tr>`;
  }).join("");
}

function openValorModalConPrecio(id, precio) {
  openValorModal(id);
  document.getElementById("valor-input").value = precio;
}

// ── Simulador de cartera objetivo ─────────────────────────────────────────────

function simOnMonedaChange() {
  const moneda = document.getElementById("sim-moneda").value;
  const prefix = moneda === "USD" ? "U$S" : "$";
  document.getElementById("sim-moneda-prefix").textContent = prefix;
  document.getElementById("sim-capital-prefix").textContent = prefix;
}

function simUsarPortafolio() {
  if (!lastResumen) return;
  const moneda = document.getElementById("sim-moneda").value;
  const val = moneda === "USD" ? lastResumen.usd.actual : lastResumen.ars.actual;
  document.getElementById("sim-capital").value = Math.round(val);
}

function simUsarInflacion() {
  const inf = getInflacion();
  if (inf > 0) document.getElementById("sim-tna").value = inf;
}

function simCalcular() {
  const meta = parseFloat(document.getElementById("sim-meta").value);
  const capital = parseFloat(document.getElementById("sim-capital").value) || 0;
  const fechaStr = document.getElementById("sim-fecha").value;
  const tnaAnual = parseFloat(document.getElementById("sim-tna").value) || 0;
  const frecuencia = document.getElementById("sim-frecuencia").value;
  const moneda = document.getElementById("sim-moneda").value;

  if (!meta || !fechaStr) { alert("Completá la meta y la fecha objetivo."); return; }

  const hoy = new Date();
  const fechaMeta = new Date(fechaStr);
  const mesesTotal = Math.max(1, Math.round((fechaMeta - hoy) / (1000 * 60 * 60 * 24 * 30.44)));

  const periodosPorMes = frecuencia === "quincenal" ? 2 : frecuencia === "semanal" ? 4.33 : 1;
  const totalPeriodos = Math.round(mesesTotal * periodosPorMes);
  const tasaPeriodo = tnaAnual > 0 ? Math.pow(1 + tnaAnual / 100, 1 / (12 * periodosPorMes)) - 1 : 0;

  // VF del capital actual
  const vfCapital = capital * Math.pow(1 + tasaPeriodo, totalPeriodos);

  let aporte = 0;
  if (meta > vfCapital) {
    if (tasaPeriodo > 0) {
      aporte = (meta - vfCapital) * tasaPeriodo / (Math.pow(1 + tasaPeriodo, totalPeriodos) - 1);
    } else {
      aporte = (meta - capital) / totalPeriodos;
    }
  }

  const totalAportado = capital + aporte * totalPeriodos;
  const intereses = meta - totalAportado;

  const fmt = moneda === "USD" ? fmtUSD : fmtARS;
  const lblFrec = frecuencia === "quincenal" ? "quincenal" : frecuencia === "semanal" ? "semanal" : "mensual";

  setText("sim-res-frecuencia-label", `Aporte ${lblFrec} necesario`);
  setText("sim-res-aporte", fmt(aporte));
  setText("sim-res-plazo", `en ${mesesTotal} meses (${Math.round(mesesTotal / 12 * 10) / 10} años)`);
  setText("sim-res-capital", fmt(capital));
  setText("sim-res-meta", fmt(meta));
  setText("sim-res-total-aportado", fmt(totalAportado));
  setText("sim-res-intereses", "+" + fmt(Math.max(0, intereses)));

  // Proyección anual: calcular valor del portafolio año a año
  const anios = Math.ceil(mesesTotal / 12);
  const labels = [];
  const valoresPortafolio = [];
  const valoresAportado = [];

  for (let a = 0; a <= anios; a++) {
    const periodoA = Math.round(a * 12 * periodosPorMes);
    const vf = capital * Math.pow(1 + tasaPeriodo, periodoA)
      + (aporte > 0 && tasaPeriodo > 0
          ? aporte * (Math.pow(1 + tasaPeriodo, periodoA) - 1) / tasaPeriodo
          : aporte * periodoA);
    labels.push(a === 0 ? "Hoy" : `Año ${a}`);
    valoresPortafolio.push(Math.round(vf));
    valoresAportado.push(Math.round(capital + aporte * periodoA));
  }

  // Tabla anual
  const tbody = document.getElementById("sim-tabla-body");
  tbody.innerHTML = labels.map((lbl, i) => {
    const interesAcum = Math.max(0, valoresPortafolio[i] - valoresAportado[i]);
    return `<tr class="border-b border-slate-50 dark:border-slate-800/50 ${i === labels.length - 1 ? "bg-blue-50 dark:bg-blue-950/30 font-semibold" : ""}">
      <td class="px-4 py-2.5 text-slate-700 dark:text-slate-300">${lbl}</td>
      <td class="px-4 py-2.5 text-right text-slate-800 dark:text-white">${fmt(valoresPortafolio[i])}</td>
      <td class="px-4 py-2.5 text-right text-slate-600 dark:text-slate-400">${fmt(valoresAportado[i])}</td>
      <td class="px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400">+${fmt(interesAcum)}</td>
    </tr>`;
  }).join("");

  // Gráfico
  const ctx = document.getElementById("sim-chart").getContext("2d");
  if (simChart) simChart.destroy();
  const isDark = document.documentElement.classList.contains("dark");
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const textColor = isDark ? "#94a3b8" : "#64748b";
  simChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Aportado",
          data: valoresAportado,
          backgroundColor: isDark ? "rgba(59,130,246,0.5)" : "rgba(59,130,246,0.4)",
          borderRadius: 4,
          stack: "s",
        },
        {
          label: "Intereses",
          data: valoresPortafolio.map((v, i) => Math.max(0, v - valoresAportado[i])),
          backgroundColor: isDark ? "rgba(16,185,129,0.6)" : "rgba(16,185,129,0.5)",
          borderRadius: 4,
          stack: "s",
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: textColor, boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
        y: { stacked: true, grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 }, callback: (v) => fmt(v) } },
      },
    },
  });

  document.getElementById("sim-resultado").classList.remove("hidden");
  document.getElementById("sim-resultado").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ── Init ──────────────────────────────────────────────────────────────────────

init();
