requireAuth();
initPageCommons();

const FULL_MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const CHART_PALETTE = ["#3b82f6","#ef4444","#10b981","#f59e0b","#8b5cf6","#ec4899","#14b8a6","#f97316","#6366f1","#84cc16"];

const TIPS = [
  "Automatizar tus ahorros mejora tu disciplina financiera y elimina la tentación de gastar.",
  "Llevar un registro diario de gastos te permite detectar patrones y tomar mejores decisiones.",
  "Seguir la regla 50/30/20: 50% necesidades, 30% deseos, 20% ahorro.",
  "Revisar tus suscripciones mensualmente puede ahorrarte dinero sin percibirlo.",
  "Un fondo de emergencia de 3-6 meses de gastos te protege ante imprevistos.",
  "Comprar en cuotas sin interés solo vale la pena si ya tenés el dinero disponible.",
  "Invertir aunque sea un pequeño monto mensual genera el hábito del ahorro productivo.",
  "Comparar precios antes de comprar puede reducir tus gastos hasta un 20%.",
  "Planificar las compras del supermercado evita gastos impulsivos y reduce desperdicios.",
  "Revisar tu tarjeta de crédito antes del resumen te evita sorpresas al vencimiento.",
];

let lineChart = null;
let donutChart = null;

// ── Greeting ──────────────────────────────────────────────────────────────────
(function setGreeting() {
  const name = localStorage.getItem("user_name") || "usuario";
  const h = new Date().getHours();
  const prefix = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  const el = document.getElementById("greeting");
  if (el) el.textContent = `${prefix}, ${name} 👋`;
})();

// ── Random tip ────────────────────────────────────────────────────────────────
(function setTip() {
  const el = document.getElementById("tip-text");
  if (el) el.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
})();

// ── Helpers ───────────────────────────────────────────────────────────────────
function pctChange(current, prev) {
  if (!prev || prev === 0) return null;
  return ((current - prev) / Math.abs(prev)) * 100;
}

function renderChangeBadge(pct, inverse = false) {
  if (pct === null) return '<span class="text-gray-400">— vs mes anterior</span>';
  const good = inverse ? pct <= 0 : pct >= 0;
  const colorCls = good
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-500 dark:text-red-400";
  const arrow = pct >= 0 ? "↑" : "↓";
  return `<span class="${colorCls} font-semibold">${arrow}${Math.abs(pct).toFixed(1)}%</span> <span class="text-gray-400">vs mes anterior</span>`;
}

// ── Main dashboard load ───────────────────────────────────────────────────────
async function loadDashboard() {
  const month = +document.getElementById("month-select").value;
  const year  = +document.getElementById("year-select").value;

  const periodLabel = document.getElementById("chart-period-label");
  if (periodLabel) periodLabel.textContent = FULL_MONTHS[month - 1];

  try {
    const data = await apiFetch(`/api/dashboard/summary?month=${month}&year=${year}`);
    window._dashboardData = data;
    const trend = data.monthly_trend || [];

    // Locate current and previous month in trend
    const curIdx  = trend.findIndex(m => m.month === month && m.year === year);
    const prevData = curIdx > 0 ? trend[curIdx - 1] : null;

    // ── KPIs ────────────────────────────────────────────────────────────────
    const savings     = data.total_income - data.total_expense;
    const prevSavings = prevData ? (prevData.income - prevData.expense) : null;

    document.getElementById("kpi-balance").textContent  = formatCurrency(data.balance);
    document.getElementById("kpi-income").textContent   = formatCurrency(data.total_income);
    document.getElementById("kpi-expense").textContent  = formatCurrency(data.total_expense);
    document.getElementById("kpi-savings").textContent  = formatCurrency(savings);

    document.getElementById("kpi-balance-change").innerHTML  = renderChangeBadge(pctChange(data.balance, prevData ? prevData.income - prevData.expense : null));
    document.getElementById("kpi-income-change").innerHTML   = renderChangeBadge(pctChange(data.total_income, prevData?.income));
    document.getElementById("kpi-expense-change").innerHTML  = renderChangeBadge(pctChange(data.total_expense, prevData?.expense), true);
    document.getElementById("kpi-savings-change").innerHTML  = renderChangeBadge(pctChange(savings, prevSavings));

    // ── Line chart ──────────────────────────────────────────────────────────
    const tLabels  = trend.map(m => MONTH_NAMES[m.month - 1] + " " + String(m.year).slice(2));
    const iData    = trend.map(m => m.income);
    const eData    = trend.map(m => m.expense);
    const sData    = trend.map(m => m.income - m.expense);

    const lineCtx = document.getElementById("line-chart");
    if (lineChart) {
      lineChart.data.labels = tLabels;
      lineChart.data.datasets[0].data = iData;
      lineChart.data.datasets[1].data = eData;
      lineChart.data.datasets[2].data = sData;
      lineChart.update();
    } else {
      lineChart = new Chart(lineCtx, {
        type: "line",
        data: {
          labels: tLabels,
          datasets: [
            {
              label: "Ingresos", data: iData,
              borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.07)",
              tension: 0.4, fill: true, pointBackgroundColor: "#10b981",
              pointRadius: 4, pointHoverRadius: 6, borderWidth: 2,
            },
            {
              label: "Gastos", data: eData,
              borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.07)",
              tension: 0.4, fill: true, pointBackgroundColor: "#ef4444",
              pointRadius: 4, pointHoverRadius: 6, borderWidth: 2,
            },
            {
              label: "Ahorro", data: sData,
              borderColor: "#6366f1", backgroundColor: "rgba(99,102,241,0.07)",
              tension: 0.4, fill: true, pointBackgroundColor: "#6366f1",
              pointRadius: 4, pointHoverRadius: 6, borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#9ca3af" } },
            y: {
              beginAtZero: true,
              grid: { color: "rgba(0,0,0,0.04)" },
              ticks: {
                font: { size: 10 }, color: "#9ca3af",
                callback: v => "$" + (Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + "k" : v),
              },
            },
          },
        },
      });
    }

    // ── Donut chart ─────────────────────────────────────────────────────────
    const noExp = document.getElementById("no-expenses");
    const donutCenter = document.getElementById("donut-center");
    document.getElementById("donut-total").textContent = formatCurrency(data.total_expense);

    if (data.by_category.length === 0) {
      noExp.classList.remove("hidden");
      donutCenter.classList.add("hidden");
      if (donutChart) { donutChart.destroy(); donutChart = null; }
      document.getElementById("category-list").innerHTML = '<p class="text-xs text-gray-400">Sin gastos este mes</p>';
      document.getElementById("top-category-insight").textContent = "";
    } else {
      noExp.classList.add("hidden");
      donutCenter.classList.remove("hidden");

      const labels  = data.by_category.map(c => `${c.icon} ${c.name}`);
      const amounts = data.by_category.map(c => c.amount);

      if (donutChart) {
        donutChart.data.labels = labels;
        donutChart.data.datasets[0].data = amounts;
        donutChart.update();
      } else {
        donutChart = new Chart(document.getElementById("donut-chart"), {
          type: "doughnut",
          data: { labels, datasets: [{ data: amounts, backgroundColor: CHART_PALETTE, borderWidth: 0, hoverOffset: 4 }] },
          options: {
            cutout: "72%",
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.raw)}` } },
            },
            responsive: true, maintainAspectRatio: false,
          },
        });
      }

      // Category list beside donut
      const sorted  = [...data.by_category].sort((a, b) => b.amount - a.amount);
      const catList = document.getElementById("category-list");
      catList.innerHTML = sorted.map((c, i) => {
        const pct = data.total_expense > 0 ? Math.round((c.amount / data.total_expense) * 100) : 0;
        return `
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${CHART_PALETTE[i % CHART_PALETTE.length]}"></span>
              <span class="text-xs text-gray-600 dark:text-slate-400 truncate">${c.name}</span>
            </div>
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <span class="text-xs font-semibold text-gray-800 dark:text-white">${formatCurrency(c.amount)}</span>
              <span class="text-xs text-gray-400 w-7 text-right">${pct}%</span>
            </div>
          </div>`;
      }).join("");

      // Insight text
      const top = sorted[0];
      const topPct = data.total_expense > 0 ? Math.round((top.amount / data.total_expense) * 100) : 0;
      document.getElementById("top-category-insight").textContent =
        `Tu mayor gasto es ${top.name} (${topPct}%)`;
    }

    // ── Insights ────────────────────────────────────────────────────────────
    renderInsights(data, prevData);

    // ── Recent transactions ──────────────────────────────────────────────────
    renderRecentTransactions(data.recent_transactions);

    // ── Score ────────────────────────────────────────────────────────────────
    renderScore(data);

  } catch (err) {
    console.error("Dashboard error:", err);
  }
}

// ── Insights ──────────────────────────────────────────────────────────────────
function renderInsights(data, prev) {
  const insights = [];

  if (data.total_income === 0 && data.total_expense === 0) {
    insights.push({
      icon: "info",
      color: "blue",
      title: "Sin movimientos aún",
      desc: "Registrá tus gastos e ingresos para ver insights personalizados.",
    });
  } else {
    // 1. Savings rate
    if (data.total_income > 0) {
      const rate = ((data.total_income - data.total_expense) / data.total_income) * 100;
      if (rate < 0) {
        insights.push({
          icon: "alert-triangle", color: "red",
          title: "Gastos mayores a ingresos",
          desc: `Estás gastando ${formatCurrency(data.total_expense - data.total_income)} más de lo que ingresás.`,
        });
      } else if (rate >= 20) {
        insights.push({
          icon: "check-circle", color: "green",
          title: "¡Buen trabajo!",
          desc: `Estás ahorrando el ${rate.toFixed(0)}% de tus ingresos este mes.`,
        });
      } else {
        insights.push({
          icon: "trending-up", color: "amber",
          title: "Podés ahorrar más",
          desc: `Ahorrás el ${rate.toFixed(0)}%. El objetivo recomendado es el 20%.`,
        });
      }
    }

    // 2. Expense change vs previous month
    if (prev && prev.expense > 0) {
      const chg = pctChange(data.total_expense, prev.expense);
      if (chg !== null && chg > 15) {
        insights.push({
          icon: "trending-up", color: "orange",
          title: "Gastos en aumento",
          desc: `Tus gastos subieron ${chg.toFixed(0)}% respecto al mes anterior.`,
        });
      } else if (chg !== null && chg < -10) {
        insights.push({
          icon: "thumbs-up", color: "green",
          title: "Reduciste tus gastos",
          desc: `Bajaste tus gastos un ${Math.abs(chg).toFixed(0)}% respecto al mes anterior.`,
        });
      }
    }

    // 3. Top spending category
    if (data.by_category.length > 0) {
      const sorted = [...data.by_category].sort((a, b) => b.amount - a.amount);
      const top    = sorted[0];
      insights.push({
        icon: "pie-chart", color: "blue",
        title: `Mayor gasto: ${top.name}`,
        desc: `${formatCurrency(top.amount)} este mes. ${top.amount > (data.total_expense * 0.4) ? "Representa más del 40% de tus gastos." : "Revisá si podés optimizarlo."}`,
      });
    }

    // 4. Savings suggestion
    if (data.total_income > 0) {
      const target  = data.total_income * 0.2;
      const current = data.total_income - data.total_expense;
      if (current < target) {
        const needed = target - current;
        insights.push({
          icon: "lightbulb", color: "violet",
          title: "Podrías ahorrar más",
          desc: `Si reducís ${formatCurrency(needed)} en gastos, llegarías al 20% de ahorro recomendado.`,
        });
      }
    }
  }

  const colorMap = {
    red:    "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
    green:  "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
    blue:   "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    orange: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
    amber:  "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
    violet: "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400",
  };

  const el = document.getElementById("insights-list");
  if (insights.length === 0) {
    el.innerHTML = '<p class="text-xs text-gray-400">Sin insights disponibles</p>';
    return;
  }

  el.innerHTML = insights.slice(0, 4).map(ins => `
    <div class="flex items-start gap-2.5">
      <div class="w-7 h-7 rounded-full ${colorMap[ins.color] || colorMap.blue} flex items-center justify-center flex-shrink-0 mt-0.5">
        <i data-lucide="${ins.icon}" class="w-3.5 h-3.5"></i>
      </div>
      <div class="min-w-0">
        <p class="text-xs font-semibold text-gray-800 dark:text-white leading-tight">${ins.title}</p>
        <p class="text-xs text-gray-500 dark:text-slate-400 mt-0.5 leading-snug">${ins.desc}</p>
      </div>
    </div>`).join("");

  lucide.createIcons();
}

// ── Recent transactions ───────────────────────────────────────────────────────
function renderRecentTransactions(transactions) {
  const list = document.getElementById("recent-list");
  if (!transactions || transactions.length === 0) {
    list.innerHTML = '<p class="text-xs text-gray-400 py-2">Sin transacciones recientes</p>';
    return;
  }
  list.innerHTML = transactions.map(t => `
    <div class="flex items-center justify-between py-2.5 border-b border-gray-50 dark:border-slate-800 last:border-0">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-base flex-shrink-0">${t.category.icon}</div>
        <div class="min-w-0">
          <p class="text-sm font-medium text-gray-800 dark:text-slate-200 truncate leading-tight">${t.description || t.category.name}</p>
          <p class="text-xs text-gray-400 mt-0.5">${formatDate(t.date)}</p>
        </div>
      </div>
      <span class="font-semibold text-sm flex-shrink-0 ml-2 ${t.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}">
        ${t.type === "income" ? "+" : "−"}${formatCurrency(t.amount)}
      </span>
    </div>`).join("");
}

// ── Financial score ───────────────────────────────────────────────────────────
function renderScore(data) {
  let savingsScore = 0, controlScore = 0, consistencyScore = 0;

  if (data.total_income > 0) {
    const rate = (data.total_income - data.total_expense) / data.total_income;
    savingsScore = Math.min(100, Math.max(0, Math.round(rate * 100 * 2.5)));
  }

  if (data.total_expense > 0 && data.total_income > 0) {
    const ratio  = data.total_expense / data.total_income;
    controlScore = Math.min(100, Math.max(0, Math.round((1 - Math.max(0, ratio - 0.5)) * 200)));
  }

  consistencyScore = data.recent_transactions && data.recent_transactions.length > 0 ? 80 : 20;

  const score   = Math.round((savingsScore + controlScore + consistencyScore) / 3);
  const pct     = score / 100;
  const circ    = 2 * Math.PI * 32;
  const offset  = circ * (1 - pct);

  const circEl = document.getElementById("score-circle");
  const valEl  = document.getElementById("score-value");
  const msgEl  = document.getElementById("score-message");

  if (circEl) circEl.style.strokeDashoffset = offset;
  if (valEl) valEl.textContent = score;

  const msg = score >= 80 ? "Excelente gestión financiera 🎉"
            : score >= 60 ? "Buen trabajo, seguí mejorando 👍"
            : score >= 40 ? "Hay margen para mejorar 💪"
            : "Empezá a registrar tus finanzas 📊";
  if (msgEl) msgEl.textContent = msg;

  const sb = document.getElementById("score-bar-savings");
  const cb = document.getElementById("score-bar-control");
  const csb = document.getElementById("score-bar-consistency");
  if (sb) sb.style.width = savingsScore + "%";
  if (cb) cb.style.width = controlScore + "%";
  if (csb) csb.style.width = consistencyScore + "%";
}

// ── Budgets ───────────────────────────────────────────────────────────────────
async function loadBudgets() {
  const month = +document.getElementById("month-select").value;
  const year  = +document.getElementById("year-select").value;

  const periodEl = document.getElementById("budget-period-label");
  if (periodEl) periodEl.textContent = FULL_MONTHS[month - 1];

  try {
    const budgets = await apiFetch(`/api/budgets?month=${month}&year=${year}`);
    _cachedBudgets = budgets || [];
    refreshNotifDot();
    const el = document.getElementById("budget-list");

    if (!budgets || budgets.length === 0) {
      el.innerHTML = `
        <p class="text-xs text-gray-400">Sin presupuestos configurados.</p>
        <a href="/budgets.html" class="text-xs text-violet-600 dark:text-violet-400 hover:underline">Crear presupuesto →</a>`;
      return;
    }

    el.innerHTML = budgets.slice(0, 4).map(b => {
      const pct      = b.percentage;
      const barColor = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
      const pctColor = pct >= 100 ? "text-red-500" : pct >= 80 ? "text-amber-500" : "text-gray-400";
      return `
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-base flex-shrink-0">${b.category.icon}</span>
              <span class="text-sm font-medium text-gray-700 dark:text-slate-300 truncate">${b.category.name}</span>
            </div>
            <span class="text-xs text-gray-500 dark:text-slate-400 flex-shrink-0 ml-2">${formatCurrency(b.spent)} / ${formatCurrency(b.limit_amount)}</span>
          </div>
          <div class="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-1.5">
            <div class="${barColor} h-1.5 rounded-full progress-bar" style="width:${Math.min(pct, 100)}%"></div>
          </div>
          <p class="text-right text-xs ${pctColor} mt-0.5">${pct}%</p>
        </div>`;
    }).join("");
  } catch (_) {}
}

// ── Financial calendar (servicios) ────────────────────────────────────────────
async function loadCalendar() {
  const MONTH_SHORT_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  try {
    const servicios = await apiFetch("/api/servicios");
    const activos   = (servicios || []).filter(s => s.activo && s.dias_restantes !== null && s.dias_restantes !== undefined);
    const el        = document.getElementById("calendar-list");

    if (activos.length === 0) {
      el.innerHTML = `
        <p class="text-xs text-gray-400">Sin servicios activos.</p>
        <a href="/servicios.html" class="text-xs text-violet-600 dark:text-violet-400 hover:underline">Agregar servicio →</a>`;
      return;
    }

    const sorted = [...activos]
      .sort((a, b) => a.dias_restantes - b.dias_restantes)
      .slice(0, 4);

    _cachedServicios = activos;
    refreshNotifDot();

    el.innerHTML = sorted.map(s => {
      const dias      = s.dias_restantes;
      const venceLabel = dias < 0   ? "Vencido"
                       : dias === 0 ? "Vence hoy"
                       : dias === 1 ? "Vence mañana"
                       : `Vence en ${dias} días`;
      const barColor  = dias < 0 ? "bg-gray-400" : dias <= 3 ? "bg-red-500" : dias <= 7 ? "bg-amber-500" : "bg-blue-500";
      const pct       = Math.max(0, Math.min(100, Math.round((30 - Math.max(0, dias)) / 30 * 100)));

      let dayStr = "—", monthStr = "—";
      if (s.proximo_vencimiento) {
        try {
          const d  = new Date(s.proximo_vencimiento + "T00:00:00");
          dayStr   = d.getDate().toString().padStart(2, "0");
          monthStr = MONTH_SHORT_ES[d.getMonth()].toUpperCase();
        } catch (_) {}
      }

      return `
        <div class="flex items-center gap-3">
          <div class="flex flex-col items-center justify-center w-11 h-11 rounded-xl bg-gray-100 dark:bg-slate-800 flex-shrink-0">
            <span class="text-sm font-bold text-gray-800 dark:text-white leading-none">${dayStr}</span>
            <span class="text-xs text-gray-400 leading-none mt-0.5">${monthStr}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <p class="text-sm font-medium text-gray-800 dark:text-slate-200 truncate leading-tight">${s.nombre}</p>
              <span class="text-xs font-semibold text-gray-500 dark:text-slate-400 ml-2 flex-shrink-0">${pct}%</span>
            </div>
            <p class="text-xs text-gray-400 mt-0.5">${venceLabel}</p>
            <div class="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-1 mt-1.5">
              <div class="${barColor} h-1 rounded-full progress-bar" style="width:${pct}%"></div>
            </div>
          </div>
        </div>`;
    }).join("");
  } catch (_) {}
}

// ── Orchestration ─────────────────────────────────────────────────────────────
async function loadAll() {
  await loadDashboard();
  await Promise.all([loadBudgets(), loadCalendar()]);
  lucide.createIcons();
}

document.getElementById("month-select").addEventListener("change", loadAll);
document.getElementById("year-select").addEventListener("change", loadAll);

loadAll();

// ═══════════════════════════════════════════════════════════════════════════════
// ALERTS CACHE
// ═══════════════════════════════════════════════════════════════════════════════
let _cachedServicios = [];
let _cachedBudgets   = [];

function refreshNotifDot() {
  const hasServiceAlert = _cachedServicios.some(s => s.dias_restantes <= 3);
  const hasBudgetAlert  = _cachedBudgets.some(b => b.percentage >= 80);
  const dot = document.getElementById("notif-dot");
  if (dot) dot.classList.toggle("hidden", !(hasServiceAlert || hasBudgetAlert));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════════════════════
const SEARCH_PAGES = [
  { label: "Dashboard",      icon: "layout-dashboard", url: "/dashboard.html" },
  { label: "Transacciones",  icon: "arrow-left-right", url: "/transactions.html" },
  { label: "Presupuestos",   icon: "wallet",           url: "/budgets.html" },
  { label: "Metas",          icon: "target",           url: "/goals.html" },
  { label: "Deudas",         icon: "credit-card",      url: "/debts.html" },
  { label: "Tarjetas",       icon: "credit-card",      url: "/cards.html" },
  { label: "Informes",       icon: "bar-chart-2",      url: "/reports.html" },
  { label: "Servicios",      icon: "calendar",         url: "/servicios.html" },
  { label: "Decisiones",     icon: "lightbulb",        url: "/decisiones.html" },
  { label: "Inversiones",    icon: "trending-up",      url: "/inversiones.html" },
];

let _searchIndex = -1;

function openSearch() {
  const overlay = document.getElementById("search-overlay");
  overlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  lucide.createIcons();
  setTimeout(() => {
    const inp = document.getElementById("search-input");
    if (inp) { inp.value = ""; inp.focus(); }
    document.getElementById("search-results").innerHTML =
      '<p class="text-xs text-gray-400 px-3 py-6 text-center">Escribí para buscar...</p>';
    _searchIndex = -1;
  }, 30);
}

function closeSearch() {
  document.getElementById("search-overlay").classList.add("hidden");
  document.body.style.overflow = "";
  _searchIndex = -1;
}

function closeSearchOnOverlay(e) {
  if (e.target === document.getElementById("search-overlay")) closeSearch();
}

function runSearch(query) {
  const q = query.trim().toLowerCase();
  const container = document.getElementById("search-results");
  _searchIndex = -1;

  if (q.length < 2) {
    container.innerHTML = '<p class="text-xs text-gray-400 px-3 py-6 text-center">Escribí para buscar...</p>';
    return;
  }

  const results = [];

  // Pages
  SEARCH_PAGES.forEach(p => {
    if (p.label.toLowerCase().includes(q)) {
      results.push({ group: "Secciones", icon: p.icon, label: p.label, sub: p.url, url: p.url });
    }
  });

  // Recent transactions (from cached DOM data via dashboard data)
  if (window._dashboardData) {
    (window._dashboardData.recent_transactions || []).forEach(t => {
      const desc = (t.description || t.category.name || "").toLowerCase();
      const cat  = (t.category.name || "").toLowerCase();
      if (desc.includes(q) || cat.includes(q)) {
        const sign  = t.type === "income" ? "+" : "−";
        results.push({
          group: "Transacciones recientes",
          icon: null, emoji: t.category.icon,
          label: t.description || t.category.name,
          sub: `${t.category.name} · ${sign}${formatCurrency(t.amount)}`,
          url: "/transactions.html",
        });
      }
    });
  }

  // Services
  _cachedServicios.forEach(s => {
    if (s.nombre.toLowerCase().includes(q)) {
      results.push({
        group: "Servicios",
        icon: "calendar",
        label: s.nombre,
        sub: s.dias_restantes <= 0 ? "Vencido" : `Vence en ${s.dias_restantes} días`,
        url: "/servicios.html",
      });
    }
  });

  // Budgets
  _cachedBudgets.forEach(b => {
    if (b.category.name.toLowerCase().includes(q)) {
      results.push({
        group: "Presupuestos",
        icon: null, emoji: b.category.icon,
        label: b.category.name,
        sub: `${b.percentage}% usado · ${formatCurrency(b.spent)} / ${formatCurrency(b.limit_amount)}`,
        url: "/budgets.html",
      });
    }
  });

  if (results.length === 0) {
    container.innerHTML = `<p class="text-xs text-gray-400 px-3 py-6 text-center">Sin resultados para "<strong>${escapeHtml(query)}</strong>"</p>`;
    return;
  }

  // Group results
  const groups = {};
  results.forEach(r => {
    if (!groups[r.group]) groups[r.group] = [];
    groups[r.group].push(r);
  });

  let html = "";
  let idx = 0;
  Object.entries(groups).forEach(([group, items]) => {
    html += `<p class="text-xs font-semibold text-gray-400 dark:text-slate-500 px-3 pt-3 pb-1 uppercase tracking-wider">${group}</p>`;
    items.forEach(item => {
      const iconHtml = item.emoji
        ? `<span class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-base flex-shrink-0">${item.emoji}</span>`
        : `<span class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0"><i data-lucide="${item.icon}" class="w-4 h-4 text-gray-500 dark:text-slate-400"></i></span>`;
      html += `
        <div class="search-result-item flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
             data-url="${item.url}" data-idx="${idx}" onclick="goSearchResult('${item.url}')">
          ${iconHtml}
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-800 dark:text-white truncate">${escapeHtml(item.label)}</p>
            <p class="text-xs text-gray-400 truncate">${escapeHtml(item.sub)}</p>
          </div>
        </div>`;
      idx++;
    });
  });

  container.innerHTML = html;
  lucide.createIcons();
}

function goSearchResult(url) {
  closeSearch();
  window.location.href = url;
}

function searchKeyNav(e) {
  const items = document.querySelectorAll(".search-result-item");
  if (!items.length) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    _searchIndex = Math.min(_searchIndex + 1, items.length - 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    _searchIndex = Math.max(_searchIndex - 1, 0);
  } else if (e.key === "Enter" && _searchIndex >= 0) {
    const url = items[_searchIndex].dataset.url;
    if (url) goSearchResult(url);
    return;
  }
  items.forEach((el, i) => el.classList.toggle("bg-gray-50", i === _searchIndex));
  items.forEach((el, i) => el.classList.toggle("dark:bg-slate-800", i === _searchIndex));
  if (items[_searchIndex]) items[_searchIndex].scrollIntoView({ block: "nearest" });
}

function escapeHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════
let _notifPanelOpen = false;

function toggleNotifPanel() {
  _notifPanelOpen ? closeNotifPanel() : openNotifPanel();
}

function openNotifPanel() {
  _notifPanelOpen = true;
  const panel = document.getElementById("notif-panel");
  panel.classList.remove("hidden");
  buildNotifAlerts();
}

function closeNotifPanel() {
  _notifPanelOpen = false;
  document.getElementById("notif-panel").classList.add("hidden");
}

async function buildNotifAlerts() {
  const lastRead = +(localStorage.getItem("notif_last_read") || 0);
  const now      = Date.now();
  const alerts   = [];

  // Services
  _cachedServicios.forEach(s => {
    if (s.dias_restantes === null || s.dias_restantes === undefined) return;
    const d = s.dias_restantes;
    if (d <= 7) {
      const urgent = d <= 3;
      alerts.push({
        type: urgent ? "red" : "amber",
        icon: "calendar",
        title: s.nombre,
        desc: d < 0 ? "Servicio vencido" : d === 0 ? "Vence hoy" : d === 1 ? "Vence mañana" : `Vence en ${d} días`,
        url: "/servicios.html",
        ts: now - (7 - d) * 86400000,
      });
    }
  });

  // Budgets
  _cachedBudgets.forEach(b => {
    if (b.percentage >= 100) {
      alerts.push({
        type: "red",
        icon: "wallet",
        title: `Presupuesto ${b.category.name}`,
        desc: `Límite superado (${b.percentage}% usado)`,
        url: "/budgets.html",
        ts: now,
      });
    } else if (b.percentage >= 80) {
      alerts.push({
        type: "amber",
        icon: "wallet",
        title: `Presupuesto ${b.category.name}`,
        desc: `Cerca del límite (${b.percentage}% usado)`,
        url: "/budgets.html",
        ts: now - 3600000,
      });
    }
  });

  // Debts (fetch only when panel is opened)
  try {
    const debts = await apiFetch("/api/debts");
    const today = new Date(); today.setHours(0,0,0,0);
    (debts || []).forEach(d => {
      if (d.paid || !d.due_date) return;
      const due = new Date(d.due_date + "T00:00:00");
      const diff = Math.round((due - today) / 86400000);
      if (diff <= 7) {
        alerts.push({
          type: diff <= 0 ? "red" : "amber",
          icon: "credit-card",
          title: `Deuda con ${d.person_name}`,
          desc: diff < 0 ? `Vencida hace ${Math.abs(diff)} días` : diff === 0 ? "Vence hoy" : `Vence en ${diff} días`,
          url: "/debts.html",
          ts: now - Math.max(0, diff) * 86400000,
        });
      }
    });
  } catch (_) {}

  const list = document.getElementById("notif-list");
  const countEl = document.getElementById("notif-count");

  if (alerts.length === 0) {
    list.innerHTML = `
      <div class="flex flex-col items-center py-8 gap-2 text-gray-400 dark:text-slate-500">
        <i data-lucide="check-circle" class="w-8 h-8 opacity-50"></i>
        <p class="text-xs">Todo al día, sin alertas pendientes</p>
      </div>`;
    countEl.classList.add("hidden");
    lucide.createIcons();
    return;
  }

  countEl.textContent = alerts.length;
  countEl.classList.remove("hidden");

  const colorMap = {
    red:   { bg: "bg-red-100 dark:bg-red-900/30",   text: "text-red-600 dark:text-red-400" },
    amber: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400" },
  };

  list.innerHTML = alerts.map(a => {
    const c = colorMap[a.type] || colorMap.amber;
    const isNew = a.ts > lastRead;
    return `
      <a href="${a.url}" onclick="closeNotifPanel()" class="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer block">
        <div class="w-8 h-8 rounded-full ${c.bg} ${c.text} flex items-center justify-center flex-shrink-0 mt-0.5">
          <i data-lucide="${a.icon}" class="w-4 h-4"></i>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-medium text-gray-800 dark:text-white truncate">${escapeHtml(a.title)}</p>
            ${isNew ? '<span class="w-2 h-2 bg-violet-500 rounded-full flex-shrink-0"></span>' : ''}
          </div>
          <p class="text-xs text-gray-500 dark:text-slate-400 mt-0.5">${escapeHtml(a.desc)}</p>
        </div>
      </a>`;
  }).join("");

  lucide.createIcons();
}

function markAllNotifRead() {
  localStorage.setItem("notif_last_read", Date.now().toString());
  buildNotifAlerts();
  refreshNotifDot();
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELP / FAQ
// ═══════════════════════════════════════════════════════════════════════════════
const FAQ_DATA = [
  {
    section: "📊 Dashboard",
    items: [
      {
        q: "¿Qué muestra el dashboard?",
        a: "El dashboard es tu resumen financiero mensual. Muestra tus ingresos, gastos, ahorro y saldo total del mes seleccionado, junto con gráficos de evolución y distribución por categoría.",
      },
      {
        q: "¿Cómo interpreto el Score financiero?",
        a: "El score (0-100) mide tu salud financiera en base a 3 factores: tasa de ahorro (cuánto guardás), control de gastos (no gastar más de lo que ingresás) y consistencia (registrar movimientos regularmente). Un score ≥80 es excelente.",
      },
      {
        q: "¿Qué son los Insights?",
        a: "Son análisis automáticos de tu situación financiera: te avisan si tus gastos subieron, si estás ahorrando bien o si podés mejorar. Se actualizan cada vez que cambiás el período.",
      },
    ],
  },
  {
    section: "💸 Transacciones",
    items: [
      {
        q: "¿Cómo registro un ingreso o gasto?",
        a: "Hacé click en el botón "+ Nuevo movimiento" del header. Elegí si es ingreso o gasto, seleccioná una categoría, completá el monto y una descripción opcional, y guardá. El dashboard se actualizará automáticamente.",
      },
      {
        q: "¿Puedo editar o eliminar movimientos?",
        a: "Sí. Desde la sección Transacciones podés ver todos tus movimientos. Hacé click en el ícono de editar o eliminar en cualquier fila. Los cambios se reflejan de inmediato en el dashboard y los presupuestos.",
      },
    ],
  },
  {
    section: "📋 Presupuestos",
    items: [
      {
        q: "¿Cómo configuro un presupuesto?",
        a: "En la sección Presupuestos, elegí una categoría y establecé un límite mensual de gasto. El sistema calculará automáticamente cuánto llevás gastado y te alertará cuando te acerques al límite.",
      },
      {
        q: "¿Qué significan los colores del presupuesto?",
        a: "Verde: menos del 80% usado (bien). Amarillo: entre 80% y 99% (atención). Rojo: límite superado (100% o más). Recibirás alertas en la campanita cuando llegues al 80%.",
      },
    ],
  },
  {
    section: "🎯 Metas de ahorro",
    items: [
      {
        q: "¿Cómo creo una meta?",
        a: "En la sección Metas, hacé click en "+ Nueva meta", poné un nombre, el monto objetivo y una fecha límite opcional. Podés ir agregando ahorros parciales desde el botón "+ Ahorrar" de cada meta.",
      },
    ],
  },
  {
    section: "💳 Tarjetas de crédito",
    items: [
      {
        q: "¿Cómo funciona el seguimiento de cuotas?",
        a: "Al agregar un gasto con cuotas, el sistema distribuye automáticamente el monto entre los meses correspondientes. Podés ver cuánto te queda por pagar en cada tarjeta y el resumen mensual de compromisos.",
      },
    ],
  },
  {
    section: "🔔 Servicios y alertas",
    items: [
      {
        q: "¿Cómo agrego un servicio recurrente?",
        a: "En la sección Servicios, podés registrar tus servicios mensuales (Netflix, internet, alquiler, etc.) con su fecha de vencimiento. El calendario del dashboard los muestra ordenados por proximidad.",
      },
      {
        q: "¿Cómo funcionan las alertas de la campanita?",
        a: "La campanita reúne todas tus alertas activas: servicios que vencen en los próximos 7 días, presupuestos que superaron el 80% y deudas próximas a vencer. El punto violeta indica que hay alertas sin leer.",
      },
    ],
  },
  {
    section: "🔍 Búsqueda",
    items: [
      {
        q: "¿Qué puedo buscar con la lupa?",
        a: "Podés buscar transacciones recientes por descripción o categoría, navegar rápidamente a cualquier sección de la app, y encontrar servicios o presupuestos por nombre. También podés abrirla con Ctrl+K.",
      },
    ],
  },
];

function openHelp() {
  const overlay = document.getElementById("help-overlay");
  const panel   = document.getElementById("help-panel");
  overlay.classList.remove("hidden");
  panel.classList.remove("hidden");
  buildFAQ();
  lucide.createIcons();
}

function closeHelp() {
  document.getElementById("help-overlay").classList.add("hidden");
  document.getElementById("help-panel").classList.add("hidden");
}

function buildFAQ() {
  const container = document.getElementById("faq-container");
  if (container.innerHTML.trim()) return; // already built

  container.innerHTML = FAQ_DATA.map((section, si) => `
    <div class="mb-4">
      <p class="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">${section.section}</p>
      <div class="space-y-1">
        ${section.items.map((item, ii) => `
          <div class="rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            <button onclick="toggleFAQ('faq-${si}-${ii}')"
                    class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors gap-3">
              <span class="text-sm font-medium text-gray-800 dark:text-slate-200">${escapeHtml(item.q)}</span>
              <i data-lucide="chevron-down" class="w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200" id="icon-faq-${si}-${ii}"></i>
            </button>
            <div id="faq-${si}-${ii}" class="hidden px-4 pb-3">
              <p class="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">${escapeHtml(item.a)}</p>
            </div>
          </div>`).join("")}
      </div>
    </div>`).join("");

  lucide.createIcons();
}

function toggleFAQ(id) {
  const el   = document.getElementById(id);
  const icon = document.getElementById("icon-" + id);
  const open = !el.classList.contains("hidden");
  el.classList.toggle("hidden", open);
  if (icon) icon.style.transform = open ? "" : "rotate(180deg)";
}

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL KEYBOARD & CLICK-OUTSIDE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeSearch();
    closeNotifPanel();
    closeHelp();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    openSearch();
  }
});

document.addEventListener("click", e => {
  if (!_notifPanelOpen) return;
  const panel  = document.getElementById("notif-panel");
  const btn    = document.getElementById("btn-notif");
  if (!panel.contains(e.target) && !btn.contains(e.target)) closeNotifPanel();
});

