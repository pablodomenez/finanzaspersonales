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

function setKpiColor(el, value) {
  el.classList.remove(
    "text-gray-900","dark:text-white",
    "text-emerald-500","dark:text-emerald-400",
    "text-red-500","dark:text-red-400",
    "text-slate-400","dark:text-slate-500"
  );
  if (value > 0)       { el.classList.add("text-emerald-500","dark:text-emerald-400"); }
  else if (value < 0)  { el.classList.add("text-red-500","dark:text-red-400"); }
  else                 { el.classList.add("text-slate-400","dark:text-slate-500"); }
}

function renderChangeBadge(pct, inverse = false) {
  if (pct === null) return '';
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

    const elBalance  = document.getElementById("kpi-balance");
    const elIncome   = document.getElementById("kpi-income");
    const elExpense  = document.getElementById("kpi-expense");
    const elSavings  = document.getElementById("kpi-savings");

    elBalance.textContent  = formatCurrency(data.balance);
    elIncome.textContent   = formatCurrency(data.total_income);
    elExpense.textContent  = formatCurrency(data.total_expense);
    elSavings.textContent  = formatCurrency(savings);

    setKpiColor(elBalance, data.balance);
    setKpiColor(elIncome,  data.total_income);
    setKpiColor(elExpense, -data.total_expense);
    setKpiColor(elSavings, savings);

    document.getElementById("kpi-balance-change").innerHTML  = renderChangeBadge(pctChange(data.balance, prevData ? prevData.income - prevData.expense : null));
    document.getElementById("kpi-income-change").innerHTML   = renderChangeBadge(pctChange(data.total_income, prevData?.income));
    document.getElementById("kpi-expense-change").innerHTML  = renderChangeBadge(pctChange(data.total_expense, prevData?.expense), true);
    document.getElementById("kpi-savings-change").innerHTML  = renderChangeBadge(pctChange(savings, prevSavings));

    // ── Line chart ──────────────────────────────────────────────────────────
    const daily    = data.daily_trend || [];
    const tLabels  = daily.map(d => d.day);
    const iData    = daily.reduce((acc, d) => { acc.push((acc.at(-1) ?? 0) + d.income);  return acc; }, []);
    const eData    = daily.reduce((acc, d) => { acc.push((acc.at(-1) ?? 0) + d.expense); return acc; }, []);
    const sData    = iData.map((v, i) => v - eData[i]);

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

      const sortedCats = [...data.by_category].sort((a, b) => b.amount - a.amount);
      const labels  = sortedCats.map(c => `${c.icon} ${c.name}`);
      const amounts = sortedCats.map(c => c.amount);
      const colors  = CHART_PALETTE.slice(0, amounts.length);

      if (donutChart) {
        donutChart.data.labels = labels;
        donutChart.data.datasets[0].data = amounts;
        donutChart.data.datasets[0].backgroundColor = colors;
        donutChart.update();
      } else {
        donutChart = new Chart(document.getElementById("donut-chart"), {
          type: "doughnut",
          data: { labels, datasets: [{ data: amounts, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] },
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
      const catList = document.getElementById("category-list");
      catList.innerHTML = sortedCats.map((c, i) => {
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
      const top = sortedCats[0];
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
    const zero = formatCurrency(0);
    ["kpi-balance","kpi-income","kpi-expense","kpi-savings"].forEach(id => {
      const el = document.getElementById(id);
      el.textContent = zero;
      setKpiColor(el, 0);
    });
    document.getElementById("kpi-balance-change").innerHTML  = '';
    document.getElementById("kpi-income-change").innerHTML   = '';
    document.getElementById("kpi-expense-change").innerHTML  = '';
    document.getElementById("kpi-savings-change").innerHTML  = '';
    const noExp = document.getElementById("no-expenses");
    if (noExp) noExp.classList.remove("hidden");
    const donutCenter = document.getElementById("donut-center");
    if (donutCenter) donutCenter.classList.add("hidden");
    const catList = document.getElementById("category-list");
    if (catList) catList.innerHTML = '<p class="text-xs text-gray-400">Sin gastos este mes</p>';
    const topIns = document.getElementById("top-category-insight");
    if (topIns) topIns.textContent = '';
    renderInsights({ total_income: 0, total_expense: 0, by_category: [], recent_transactions: [] }, null);
    renderRecentTransactions([]);
    renderScore({ total_income: 0, total_expense: 0, recent_transactions: [] });
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

// ── Cotizaciones dólar ────────────────────────────────────────────────────────
async function loadCotizaciones() {
  const grid = document.getElementById("cotizaciones-grid");
  const updEl = document.getElementById("cotiz-updated");
  if (!grid) return;

  const SHOW = ["oficial", "blue", "tarjeta", "cripto"];
  const COLORS = {
    oficial: "text-blue-600 dark:text-blue-400",
    blue:    "text-emerald-600 dark:text-emerald-400",
    tarjeta: "text-pink-600 dark:text-pink-400",
    cripto:  "text-orange-600 dark:text-orange-400",
  };

  try {
    const data = await apiFetch("/api/cotizaciones");
    const items = data.filter(d => SHOW.includes(d.casa));

    if (!items.length) {
      grid.innerHTML = '<div class="col-span-full text-xs text-gray-400">No se pudo obtener cotizaciones.</div>';
      return;
    }

    grid.innerHTML = items.map(d => {
      const color  = COLORS[d.casa] || "text-gray-700 dark:text-slate-300";
      const venta  = d.venta != null ? `$${Number(d.venta).toLocaleString("es-AR", {minimumFractionDigits: 0, maximumFractionDigits: 0})}` : "—";
      const compra = d.compra != null ? `$${Number(d.compra).toLocaleString("es-AR", {minimumFractionDigits: 0, maximumFractionDigits: 0})}` : "—";
      return `
        <div class="bg-gray-50 dark:bg-slate-800 rounded-xl px-3 py-2 flex flex-col gap-0.5 min-w-0">
          <span class="text-xs text-gray-400 dark:text-slate-500 truncate">${d.nombre}</span>
          <span class="text-sm font-bold ${color} truncate">${venta}</span>
          <span class="text-xs text-gray-400 dark:text-slate-500">Compra: ${compra}</span>
        </div>`;
    }).join("");

    // Hora de la última cotización
    const last = items[0]?.fecha;
    if (last) {
      try {
        const d = new Date(last);
        updEl.textContent = `Act. ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
      } catch (_) {}
    }
  } catch (_) {
    grid.innerHTML = '<div class="col-span-full text-xs text-gray-400">No se pudo obtener cotizaciones.</div>';
  }
  lucide.createIcons();
}

loadCotizaciones();

// ── Precios crypto (CoinGecko, sin auth) ─────────────────────────────────────
async function loadCrypto() {
  const grid    = document.getElementById("crypto-grid");
  const updEl   = document.getElementById("crypto-updated");
  if (!grid) return;

  const COINS = [
    { id: "bitcoin",  symbol: "BTC", color: "text-orange-500 dark:text-orange-400" },
    { id: "ethereum", symbol: "ETH", color: "text-violet-500 dark:text-violet-400" },
    { id: "binancecoin", symbol: "BNB", color: "text-amber-500 dark:text-amber-400" },
  ];
  const ids = COINS.map(c => c.id).join(",");

  try {
    const res  = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
    const data = await res.json();

    grid.innerHTML = COINS.map(c => {
      const info   = data[c.id];
      const price  = info ? `$${Number(info.usd).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—";
      const change = info?.usd_24h_change;
      const changeHtml = change != null
        ? `<span class="${change >= 0 ? "text-emerald-500" : "text-red-500"} text-xs">${change >= 0 ? "+" : ""}${change.toFixed(1)}%</span>`
        : "";
      return `
        <div class="bg-gray-50 dark:bg-slate-800 rounded-xl px-3 py-2 flex flex-col gap-0.5 min-w-0">
          <span class="text-xs text-gray-400 dark:text-slate-500">${c.symbol}</span>
          <span class="text-sm font-bold ${c.color} truncate">${price}</span>
          ${changeHtml}
        </div>`;
    }).join("");

    if (updEl) {
      updEl.textContent = `Act. ${new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
    }
  } catch (_) {
    grid.innerHTML = '<div class="col-span-full text-xs text-gray-400">No se pudo obtener precios.</div>';
  }
  lucide.createIcons();
}

loadCrypto();

