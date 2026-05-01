requireAuth();
initPageCommons();

const yearSelect = document.getElementById("year-select");

const FULL_MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const CHART_PALETTE = ["#3b82f6","#ef4444","#10b981","#f59e0b","#8b5cf6","#ec4899","#14b8a6","#f97316","#6366f1","#84cc16"];

let donutChart = null;
let barChart = null;

async function loadDashboard() {
  const month = document.getElementById("month-select").value;
  const year = yearSelect.value;
  document.getElementById("period-label").textContent = `${FULL_MONTHS[month - 1]} ${year}`;

  try {
    const data = await apiFetch(`/api/dashboard/summary?month=${month}&year=${year}`);

    // KPIs
    const balanceEl = document.getElementById("kpi-balance");
    balanceEl.textContent = formatCurrency(data.balance);
    balanceEl.className = `text-3xl font-bold mt-1 ${data.balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`;
    document.getElementById("kpi-income").textContent = formatCurrency(data.total_income);
    document.getElementById("kpi-expense").textContent = formatCurrency(data.total_expense);

    // Gráfico de dona: actualizar datos si ya existe, crear si no
    const noExp = document.getElementById("no-expenses");
    if (data.by_category.length === 0) {
      noExp.classList.remove("hidden");
      if (donutChart) { donutChart.destroy(); donutChart = null; }
    } else {
      noExp.classList.add("hidden");
      const labels = data.by_category.map(c => `${c.icon} ${c.name}`);
      const amounts = data.by_category.map(c => c.amount);
      if (donutChart) {
        donutChart.data.labels = labels;
        donutChart.data.datasets[0].data = amounts;
        donutChart.update();
      } else {
        donutChart = new Chart(document.getElementById("donut-chart"), {
          type: "doughnut",
          data: { labels, datasets: [{ data: amounts, backgroundColor: CHART_PALETTE }] },
          options: {
            cutout: "65%",
            plugins: { legend: { position: "bottom", labels: { font: { size: 11 }, color: "#6b7280", boxWidth: 12 } } },
            responsive: true, maintainAspectRatio: false,
          },
        });
      }
    }

    // Gráfico de barras: actualizar datos si ya existe, crear si no
    const trendLabels = data.monthly_trend.map(m => MONTH_NAMES[m.month - 1] + " " + String(m.year).slice(2));
    const incomeData = data.monthly_trend.map(m => m.income);
    const expenseData = data.monthly_trend.map(m => m.expense);
    if (barChart) {
      barChart.data.labels = trendLabels;
      barChart.data.datasets[0].data = incomeData;
      barChart.data.datasets[1].data = expenseData;
      barChart.update();
    } else {
      barChart = new Chart(document.getElementById("bar-chart"), {
        type: "bar",
        data: {
          labels: trendLabels,
          datasets: [
            { label: "Ingresos", data: incomeData, backgroundColor: "#10b981", borderRadius: 6 },
            { label: "Gastos",   data: expenseData, backgroundColor: "#ef4444", borderRadius: 6 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { font: { size: 11 }, color: "#6b7280", boxWidth: 12 } } },
          scales: { x: { grid: { display: false } }, y: { beginAtZero: true } },
        },
      });
    }

    // Últimas transacciones
    const list = document.getElementById("recent-list");
    if (data.recent_transactions.length === 0) {
      list.innerHTML = '<p class="px-6 py-4 text-slate-400 text-sm">Sin transacciones recientes</p>';
    } else {
      list.innerHTML = data.recent_transactions.map(t => `
        <div class="flex items-center justify-between px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-base flex-shrink-0">${t.category.icon}</div>
            <div>
              <p class="text-sm font-medium text-slate-800 dark:text-slate-200">${t.description || t.category.name}</p>
              <p class="text-xs text-slate-400">${t.category.name} · ${formatDate(t.date)}</p>
            </div>
          </div>
          <span class="font-semibold text-sm ${t.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}">
            ${t.type === "income" ? "+" : "−"}${formatCurrency(t.amount)}
          </span>
        </div>
      `).join("");
    }
  } catch (err) {
    console.error(err);
  }
}

document.getElementById("month-select").addEventListener("change", loadDashboard);
yearSelect.addEventListener("change", loadDashboard);

loadDashboard();
