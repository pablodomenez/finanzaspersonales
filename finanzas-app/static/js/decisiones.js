// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null || isNaN(n)) return "—";
  return "$" + Math.abs(n).toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function fmtDelta(n) {
  if (!n) return "";
  const sign = n >= 0 ? "+" : "-";
  return `${sign}${fmt(Math.abs(n))} vs mes ant.`;
}

// ── selects de mes/año ────────────────────────────────────────────────────────

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

(function initSelects() {
  const now = new Date();
  const mSel = document.getElementById("month-select");
  const ySel = document.getElementById("year-select");
  MONTHS.forEach((m, i) => {
    const opt = document.createElement("option");
    opt.value = i + 1;
    opt.textContent = m;
    if (i + 1 === now.getMonth() + 1) opt.selected = true;
    mSel.appendChild(opt);
  });
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    if (y === now.getFullYear()) opt.selected = true;
    ySel.appendChild(opt);
  }
})();

// ── card configs ──────────────────────────────────────────────────────────────

const TIPO_CONFIG = {
  ahorro:      { badge: "Ahorro potencial",  badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", accent: "text-emerald-500", border: "border-emerald-100 dark:border-emerald-800/30", emoji: "🐷", link: "Ver detalle" },
  inversion:   { badge: "Oportunidad",       badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",             accent: "text-blue-500",   border: "border-blue-100 dark:border-blue-800/30",   emoji: "📈", link: "Simular inversión" },
  alerta:      { badge: "Alerta de gasto",   badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",         accent: "text-amber-500",  border: "border-amber-100 dark:border-amber-800/30", emoji: "⚠️", link: "Ver análisis" },
  presupuesto: { badge: "Límite cercano",    badgeColor: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",                 accent: "text-red-500",    border: "border-red-100 dark:border-red-800/30",     emoji: "💳", link: "Ver presupuesto" },
  positivo:    { badge: "Todo en orden",     badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", accent: "text-emerald-500", border: "border-emerald-100 dark:border-emerald-800/30", emoji: "✅", link: "Ver detalle" },
  inicio:      { badge: "Comenzá",           badgeColor: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",     accent: "text-violet-500", border: "border-violet-100 dark:border-violet-800/30",  emoji: "🚀", link: "Ver más" },
};

const HABIT_CARD_CONFIG = {
  badge: "Mejora de hábito",
  badgeColor: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  accent: "text-violet-600 dark:text-violet-400",
  border: "border-violet-100 dark:border-violet-800/30",
  emoji: "🎯",
  link: "Ver progreso",
};

// ── render decision cards ─────────────────────────────────────────────────────

function renderDecisionCards(recomendaciones, habitos) {
  const container = document.getElementById("decision-cards");
  const recs = recomendaciones.slice(0, 3);

  const cards = recs.map((rec) => {
    const cfg = TIPO_CONFIG[rec.tipo] || TIPO_CONFIG.inicio;
    const msgWords = rec.mensaje.split(" ");
    // Extract first number/percentage for the hero value
    const heroMatch = rec.mensaje.match(/\$[\d.,]+|[\d.,]+%/);
    const hero = heroMatch ? heroMatch[0] : rec.titulo.split(" ").slice(-1)[0];
    const desc = rec.mensaje;

    return `
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 card-hover flex flex-col justify-between min-h-[180px] relative overflow-hidden">
        <div>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.badgeColor} mb-3">
            ${cfg.badge}
          </span>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-tight mb-1">${rec.titulo}</p>
          <p class="text-2xl font-black ${cfg.accent} leading-tight mb-1">${hero}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">${desc.replace(heroMatch?.[0] || "", "").trim()}</p>
        </div>
        <div class="absolute top-4 right-4 text-4xl opacity-20 select-none">${cfg.emoji}</div>
        <button class="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1 hover:text-violet-600 dark:hover:text-violet-400 transition">
          ${cfg.link} <i data-lucide="chevron-right" class="w-3 h-3"></i>
        </button>
      </div>
    `;
  });

  // 4th card: hábitos
  const streak = habitos.streak;
  const habitCard = `
    <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 card-hover flex flex-col justify-between min-h-[180px] relative overflow-hidden">
      <div>
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${HABIT_CARD_CONFIG.badgeColor} mb-3">
          ⭐ ${HABIT_CARD_CONFIG.badge}
        </span>
        <p class="text-xs text-slate-500 dark:text-slate-400 leading-tight mb-1">Llevas</p>
        <p class="text-3xl font-black ${HABIT_CARD_CONFIG.accent} leading-tight">${streak} ${streak === 1 ? "día" : "días"}</p>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">registrando tus gastos</p>
        <p class="text-xs text-slate-400 dark:text-slate-500 mt-2 leading-relaxed">
          ${streak >= 7 ? "¡Excelente! Mantené la consistencia para seguir mejorando." : streak >= 3 ? "Vas bien. La clave está en la consistencia diaria." : "Registrá hoy y empezá a construir el hábito."}
        </p>
      </div>
      <div class="absolute top-4 right-4 text-4xl opacity-20 select-none">${HABIT_CARD_CONFIG.emoji}</div>
      <a href="#habitos" class="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1 hover:text-violet-600 dark:hover:text-violet-400 transition">
        ${HABIT_CARD_CONFIG.link} <i data-lucide="chevron-right" class="w-3 h-3"></i>
      </a>
    </div>
  `;

  container.innerHTML = cards.join("") + habitCard;
  if (window.lucide) lucide.createIcons();
}

// ── salud financiera ──────────────────────────────────────────────────────────

function computeHealth(data) {
  const { resumen, habitos, gamificacion, recomendaciones } = data;

  const savingsRate = resumen.tasa_ahorro || 0;
  let ahorroScore = savingsRate >= 20 ? 95 : savingsRate >= 10 ? 70 : savingsRate >= 5 ? 45 : savingsRate > 0 ? 20 : 5;

  const alertCount = recomendaciones.filter(r => r.tipo === "presupuesto" || r.tipo === "alerta").length;
  let gastosScore = Math.max(20, 100 - alertCount * 20);

  let habitosScore = Math.min(100, habitos.streak * 14);
  if (habitosScore === 0 && habitos.total_dias > 0) habitosScore = 20;

  let invScore = gamificacion.nivel_num >= 3 ? 90 : gamificacion.nivel_num >= 2 ? 60 : 25;

  const overall = Math.round(ahorroScore * 0.30 + gastosScore * 0.25 + habitosScore * 0.25 + invScore * 0.20);

  return { overall, ahorro: ahorroScore, gastos: gastosScore, habitos: habitosScore, inversiones: invScore };
}

function renderHealth(data) {
  const scores = computeHealth(data);
  const s = scores.overall;

  // Ring: circumference = 2 * π * 36 ≈ 226.2
  const circ = 226.2;
  const offset = circ * (1 - s / 100);
  const ring = document.getElementById("health-ring");
  ring.style.strokeDashoffset = offset;
  ring.style.stroke = s >= 70 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444";

  document.getElementById("health-score").textContent = s;

  let label, desc, badgeCls, badgeTxt;
  if (s >= 75) {
    label = "Vas por buen camino 💪"; desc = "Tu situación financiera es saludable. Seguí así.";
    badgeCls = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"; badgeTxt = "● Buena";
  } else if (s >= 50) {
    label = "En construcción 🔨"; desc = "Hay margen para mejorar. Revisá las recomendaciones.";
    badgeCls = "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"; badgeTxt = "● Regular";
  } else {
    label = "Atención requerida ⚠️"; desc = "Tu situación necesita ajustes. Empezá por las alertas.";
    badgeCls = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"; badgeTxt = "● Mejorar";
  }

  document.getElementById("health-label").textContent = label;
  document.getElementById("health-desc").textContent = desc;
  const badge = document.getElementById("health-badge");
  badge.className = `inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-semibold ${badgeCls}`;
  badge.textContent = badgeTxt;

  // Sub-métricas
  [
    ["sub-ahorro",   scores.ahorro],
    ["sub-gastos",   scores.gastos],
    ["sub-habitos",  scores.habitos],
    ["sub-inv",      scores.inversiones],
  ].forEach(([id, val]) => {
    document.getElementById(`${id}-val`).textContent = `${val}/100`;
    document.getElementById(`${id}-bar`).style.width = `${val}%`;
  });

  // Nivel
  const g = data.gamificacion;
  document.getElementById("nivel-nombre").textContent = g.nivel;
  document.getElementById("nivel-puntos").textContent = `${g.puntos} pts`;
  document.getElementById("nivel-bar").style.width = `${g.nivel_pct}%`;
}

// ── acciones recomendadas ─────────────────────────────────────────────────────

const PRIORIDAD_MAP = {
  1: { txt: "Alta prioridad",  cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  2: { txt: "Media prioridad", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  3: { txt: "Baja prioridad",  cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
};

const TIPO_ICON = {
  ahorro: "piggy-bank", inversion: "trending-up", alerta: "alert-triangle",
  presupuesto: "wallet", positivo: "check-circle", inicio: "lightbulb",
};

const TIPO_ICON_BG = {
  ahorro: "bg-emerald-50 dark:bg-emerald-900/20", inversion: "bg-blue-50 dark:bg-blue-900/20",
  alerta: "bg-amber-50 dark:bg-amber-900/20", presupuesto: "bg-red-50 dark:bg-red-900/20",
  positivo: "bg-emerald-50 dark:bg-emerald-900/20", inicio: "bg-violet-50 dark:bg-violet-900/20",
};
const TIPO_ICON_CLR = {
  ahorro: "text-emerald-600", inversion: "text-blue-600", alerta: "text-amber-600",
  presupuesto: "text-red-600", positivo: "text-emerald-600", inicio: "text-violet-600",
};

function renderAcciones(recs) {
  const list = document.getElementById("acciones-list");
  list.innerHTML = recs.slice(0, 5).map((rec) => {
    const p = PRIORIDAD_MAP[rec.prioridad] || PRIORIDAD_MAP[3];
    const icon = TIPO_ICON[rec.tipo] || "info";
    const bg = TIPO_ICON_BG[rec.tipo] || "bg-slate-50";
    const clr = TIPO_ICON_CLR[rec.tipo] || "text-slate-600";
    return `
      <div class="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer group">
        <div class="w-8 h-8 rounded-lg ${bg} ${clr} flex items-center justify-center flex-shrink-0 mt-0.5">
          <i data-lucide="${icon}" class="w-4 h-4"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <p class="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-tight">${rec.titulo}</p>
            <span class="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${p.cls}">${p.txt}</span>
          </div>
          <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">${rec.mensaje}</p>
        </div>
        <i data-lucide="chevron-right" class="w-4 h-4 text-slate-300 dark:text-slate-600 flex-shrink-0 mt-1 group-hover:text-violet-500 transition"></i>
      </div>
    `;
  }).join("");
  if (window.lucide) lucide.createIcons();
}

// ── tendencia / sparkline ─────────────────────────────────────────────────────

let sparkChart = null;

function renderTendencia(crecimiento) {
  const balances = crecimiento.map(m => m.balance);
  const labels = crecimiento.map(m => m.mes);

  const lastTwo = balances.slice(-2);
  let pct = 0;
  if (lastTwo.length === 2 && lastTwo[0] !== 0) {
    pct = ((lastTwo[1] - lastTwo[0]) / Math.abs(lastTwo[0])) * 100;
  }

  const positive = pct >= 0;
  document.getElementById("tendencia-pct").textContent = (positive ? "+" : "") + pct.toFixed(0) + "%";
  document.getElementById("tendencia-pct").className = `text-3xl font-black leading-none ${positive ? "text-emerald-500" : "text-red-500"}`;
  document.getElementById("tendencia-desc").textContent = positive
    ? "Mejoraste tu situación financiera"
    : "Tu situación bajó respecto al mes anterior";

  // Sparkline
  const ctx = document.getElementById("sparkline-chart").getContext("2d");
  if (sparkChart) sparkChart.destroy();

  const isDark = document.documentElement.classList.contains("dark");
  const lineColor = positive ? "#10b981" : "#ef4444";

  sparkChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: balances,
        borderColor: lineColor,
        borderWidth: 2,
        fill: true,
        backgroundColor: positive ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: ctx => fmt(ctx.raw) }
      }},
      scales: {
        x: { display: false },
        y: { display: false },
      },
    },
  });

  // Métricas laterales
  const income6 = crecimiento.map(m => m.income);
  const expense6 = crecimiento.map(m => m.expense);
  const deltaIncome = income6.length >= 2 && income6[income6.length - 2] !== 0
    ? ((income6.at(-1) - income6.at(-2)) / income6.at(-2)) * 100 : 0;
  const deltaExpense = expense6.length >= 2 && expense6[expense6.length - 2] !== 0
    ? ((expense6.at(-1) - expense6.at(-2)) / expense6.at(-2)) * 100 : 0;
  const deltaBalance = pct;

  const metrics = [
    { label: "Ahorro",    icon: "home",        val: deltaBalance,  },
    { label: "Gastos",    icon: "receipt",      val: -deltaExpense, },
    { label: "Ingresos",  icon: "trending-up",  val: deltaIncome,   },
    { label: "Balance",   icon: "bar-chart-2",  val: deltaBalance,  },
  ];

  document.getElementById("tendencia-metrics").innerHTML = metrics.map(m => {
    const pos = m.val >= 0;
    return `
      <div class="flex items-center justify-between text-xs">
        <div class="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
          <i data-lucide="${m.icon}" class="w-3 h-3"></i>
          ${m.label}
        </div>
        <span class="font-semibold ${pos ? "text-emerald-500" : "text-red-500"} flex items-center gap-0.5">
          ${pos ? "+" : ""}${m.val.toFixed(0)}%
          <i data-lucide="${pos ? "arrow-up" : "arrow-down"}" class="w-3 h-3"></i>
        </span>
      </div>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

// ── hábitos ───────────────────────────────────────────────────────────────────

function renderHabitos(habitos) {
  document.getElementById("streak-num").textContent = habitos.streak;
  document.getElementById("total-dias").textContent = habitos.total_dias;

  const hoyEl = document.getElementById("hoy-check");
  hoyEl.textContent = habitos.registro_hoy ? "✅" : "❌";
  hoyEl.className = "text-2xl text-center";

  const semana = document.getElementById("semana-dots");
  semana.innerHTML = habitos.semana.map(d => {
    let cls, dotCls;
    if (d.futuro) {
      cls = "text-slate-300 dark:text-slate-600";
      dotCls = "bg-slate-100 dark:bg-slate-700";
    } else if (d.registrado) {
      cls = "text-violet-600 dark:text-violet-400 font-bold";
      dotCls = "bg-violet-500";
    } else {
      cls = "text-slate-400 dark:text-slate-500";
      dotCls = "bg-slate-200 dark:bg-slate-700";
    }
    return `
      <div class="flex-1 flex flex-col items-center gap-1">
        <span class="text-[10px] font-semibold ${cls}">${d.dia}</span>
        <div class="w-6 h-6 rounded-full ${dotCls} flex items-center justify-center text-[10px] text-white">
          ${d.registrado && !d.futuro ? "✓" : ""}
        </div>
      </div>
    `;
  }).join("");

  const motivaciones = [
    "La consistencia es la clave del éxito financiero. Seguí registrando cada día.",
    "Cada transacción registrada es un paso hacia la libertad financiera.",
    "Los mejores resultados vienen de hábitos pequeños y consistentes.",
  ];
  document.getElementById("habito-motivacion").textContent =
    motivaciones[habitos.streak % motivaciones.length];
}

// ── logros ────────────────────────────────────────────────────────────────────

const LOGROS_PENDIENTES = [
  { icono: "🎉", nombre: "Primer registro",    desc: "Registrá tu primera transacción" },
  { icono: "🔥", nombre: "Semana perfecta",    desc: "7 días seguidos registrando" },
  { icono: "📋", nombre: "Planificador",       desc: "3 o más presupuestos definidos" },
  { icono: "🎯", nombre: "Soñador con plan",   desc: "Tu primera meta financiera" },
  { icono: "🏆", nombre: "Meta cumplida",      desc: "Alcanzaste una meta" },
  { icono: "📈", nombre: "Inversor",           desc: "Primera inversión activa" },
  { icono: "💚", nombre: "Primer mes ahorrando", desc: "Balance positivo en un mes" },
  { icono: "🌱", nombre: "Hábito formado",     desc: "3 meses con balance positivo" },
];

function renderLogros(logros) {
  const obtenidosNombres = new Set(logros.map(l => l.nombre));
  document.getElementById("logros-count").textContent = `${logros.length} desbloqueados`;

  const grid = document.getElementById("logros-grid");
  grid.innerHTML = LOGROS_PENDIENTES.map(l => {
    const got = obtenidosNombres.has(l.nombre);
    return `
      <div class="flex items-center gap-2 p-2 rounded-xl ${got ? "bg-violet-50 dark:bg-violet-900/20" : "bg-slate-50 dark:bg-slate-800 opacity-50"} transition">
        <span class="text-xl ${got ? "" : "grayscale"}">${l.icono}</span>
        <div class="min-w-0">
          <p class="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">${l.nombre}</p>
          <p class="text-[10px] text-slate-500 dark:text-slate-400 truncate">${l.desc}</p>
        </div>
      </div>
    `;
  }).join("");
}

// ── resumen del mes ───────────────────────────────────────────────────────────

function renderResumen(resumen) {
  document.getElementById("resumen-mes-label").textContent = `${resumen.mes} ${resumen.anio}`;
  document.getElementById("resumen-income").textContent = fmt(resumen.ingresos);
  document.getElementById("resumen-expense").textContent = fmt(resumen.gastos);

  const bal = resumen.balance;
  const balEl = document.getElementById("resumen-balance");
  balEl.textContent = (bal >= 0 ? "+" : "-") + fmt(Math.abs(bal)).replace("$", "") + " ARS";
  balEl.className = `text-2xl font-black ${bal >= 0 ? "text-emerald-500" : "text-red-500"}`;

  document.getElementById("resumen-tasa").textContent = resumen.tasa_ahorro + "%";

  const bd = resumen.vs_mes_anterior;
  const inDelta = document.getElementById("resumen-income-delta");
  inDelta.textContent = fmtDelta(bd.ingresos_delta);
  inDelta.className = `text-xs mt-1 ${bd.ingresos_delta >= 0 ? "text-emerald-500" : "text-red-500"}`;

  const exDelta = document.getElementById("resumen-expense-delta");
  exDelta.textContent = fmtDelta(bd.gastos_delta);
  exDelta.className = `text-xs mt-1 ${bd.gastos_delta <= 0 ? "text-emerald-500" : "text-red-500"}`;

  const badge = document.getElementById("resumen-balance-badge");
  if (bal >= 0) {
    badge.className = "px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    badge.textContent = "✓ Balance positivo";
  } else {
    badge.className = "px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    badge.textContent = "⚠ Balance negativo";
  }

  if (resumen.top_categoria) {
    const row = document.getElementById("top-categoria-row");
    row.classList.remove("hidden");
    row.classList.add("flex");
    document.getElementById("top-cat-icon").textContent = resumen.top_categoria.icono || "📦";
    document.getElementById("top-cat-nombre").textContent = resumen.top_categoria.nombre;
    document.getElementById("top-cat-monto").textContent = fmt(resumen.top_categoria.monto);
  }
}

// ── insights personalizados ───────────────────────────────────────────────────

const INSIGHT_TAGS = {
  "Patrón detectado": "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  "Patrón positivo":  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Riesgo potencial": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "Tendencia positiva": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

function buildInsights(data) {
  const { patrones, habitos, gamificacion, resumen, recomendaciones } = data;
  const insights = [];

  patrones.forEach(p => {
    const isPositive = p.mensaje.toLowerCase().includes("ahorr") || p.icono === "pie-chart";
    const isRisk = p.mensaje.toLowerCase().includes("riesgo") || p.mensaje.toLowerCase().includes("elevado");
    const tag = isRisk ? "Riesgo potencial" : isPositive ? "Patrón positivo" : "Patrón detectado";
    insights.push({
      icon: p.icono === "pie-chart" ? "📊" : "📅",
      titulo: "Patrón de gasto",
      desc: p.mensaje,
      tag,
    });
  });

  if (habitos.streak >= 7) {
    insights.push({ icon: "🔥", titulo: "Semana perfecta", desc: `${habitos.streak} días consecutivos registrando tus movimientos.`, tag: "Tendencia positiva" });
  }
  if (habitos.total_dias > 20) {
    insights.push({ icon: "📆", titulo: "Usuario constante", desc: `Registraste movimientos en ${habitos.total_dias} días en total.`, tag: "Tendencia positiva" });
  }

  if (resumen.tasa_ahorro >= 15) {
    insights.push({ icon: "💰", titulo: "Tu mejor día para ahorrar", desc: `Tasa de ahorro del ${resumen.tasa_ahorro}%. Podés destinar parte a inversiones.`, tag: "Patrón positivo" });
  }

  if (resumen.vs_mes_anterior.gastos_delta > 0) {
    insights.push({ icon: "⏰", titulo: "Atención con fin de mes", desc: `Tus gastos subieron ${fmt(resumen.vs_mes_anterior.gastos_delta)} vs el mes anterior.`, tag: "Riesgo potencial" });
  }

  if (gamificacion.nivel_num >= 2) {
    insights.push({ icon: "📈", titulo: "Crecimiento constante", desc: `Alcanzaste el nivel ${gamificacion.nivel}. Seguís mejorando.`, tag: "Tendencia positiva" });
  }

  // Fallback
  if (insights.length === 0) {
    insights.push({ icon: "🚀", titulo: "Empezá a registrar", desc: "Con más datos, podré detectar patrones personalizados para vos.", tag: "Patrón detectado" });
  }

  return insights;
}

function renderInsights(insights) {
  const track = document.getElementById("insights-track");
  track.innerHTML = insights.map(ins => {
    const tagCls = INSIGHT_TAGS[ins.tag] || INSIGHT_TAGS["Patrón detectado"];
    return `
      <div class="flex-shrink-0 w-56 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 card-hover">
        <div class="w-10 h-10 bg-violet-50 dark:bg-violet-900/20 rounded-xl flex items-center justify-center text-xl mb-3">
          ${ins.icon}
        </div>
        <p class="text-sm font-bold text-slate-800 dark:text-white mb-1 leading-tight">${ins.titulo}</p>
        <p class="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">${ins.desc}</p>
        <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full ${tagCls}">${ins.tag}</span>
      </div>
    `;
  }).join("");
}

function scrollInsights(dir) {
  const track = document.getElementById("insights-track");
  track.scrollBy({ left: dir * 240, behavior: "smooth" });
}

// ── main load ─────────────────────────────────────────────────────────────────

async function loadData() {
  const month = document.getElementById("month-select").value;
  const year = document.getElementById("year-select").value;

  try {
    const data = await apiFetch(`/api/decisiones/insights?month=${month}&year=${year}`);

    renderDecisionCards(data.recomendaciones, data.habitos);
    renderHealth(data);
    renderAcciones(data.recomendaciones);
    renderTendencia(data.crecimiento);
    renderHabitos(data.habitos);
    renderLogros(data.gamificacion.logros);
    renderResumen(data.resumen);
    renderInsights(buildInsights(data));

    if (window.lucide) lucide.createIcons();
  } catch (e) {
    console.error("Error cargando decisiones:", e);
    document.getElementById("decision-cards").innerHTML =
      `<div class="col-span-4 text-center py-10 text-red-400 text-sm">Error al cargar los datos. Verificá tu sesión.</div>`;
  }
}

// User greeting
(async function init() {
  try {
    const token = getToken();
    if (!token) { window.location = "/login.html"; return; }
    const me = await apiFetch("/api/auth/me");
    const firstName = (me.name || "").split(" ")[0];
    document.getElementById("greeting").textContent = `Hola, ${firstName} 👋`;
  } catch (_) {}
  loadData();
})();
