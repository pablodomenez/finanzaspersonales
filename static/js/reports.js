requireAuth();

const yearSelect = document.getElementById("year-select");
populateYearSelect(yearSelect, 4);
yearSelect.value = new Date().getFullYear();

const greeting = document.getElementById("user-greeting");
if (greeting) greeting.textContent = "Hola, " + (localStorage.getItem("user_name") || "usuario");

const MONTH_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const CHART_PALETTE = ["#3b82f6","#ef4444","#10b981","#f59e0b","#8b5cf6","#ec4899","#14b8a6","#f97316","#6366f1","#84cc16"];

let lineChart = null;
let donutChart = null;

async function loadReport() {
  const year = yearSelect.value;
  try {
    const data = await apiFetch(`/api/reports/summary?year=${year}`);

    // KPIs
    const balanceEl = document.getElementById("kpi-balance");
    balanceEl.textContent = formatCurrency(data.balance);
    balanceEl.className = `text-3xl font-bold mt-1 ${data.balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`;
    document.getElementById("kpi-income").textContent = formatCurrency(data.total_income);
    document.getElementById("kpi-expense").textContent = formatCurrency(data.total_expense);

    // Gráfico de línea: ingresos vs gastos mes a mes
    const labels = data.monthly.map(m => MONTH_NAMES[m.month - 1]);
    const incomeData = data.monthly.map(m => m.income);
    const expenseData = data.monthly.map(m => m.expense);
    if (lineChart) {
      lineChart.data.labels = labels;
      lineChart.data.datasets[0].data = incomeData;
      lineChart.data.datasets[1].data = expenseData;
      lineChart.update();
    } else {
      lineChart = new Chart(document.getElementById("line-chart"), {
        type: "line",
        data: {
          labels,
          datasets: [
            { label: "Ingresos", data: incomeData, borderColor: "#10b981", backgroundColor: "#10b98120", fill: true, tension: 0.3 },
            { label: "Gastos", data: expenseData, borderColor: "#ef4444", backgroundColor: "#ef444420", fill: true, tension: 0.3 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { font: { size: 11 }, color: "#6b7280", boxWidth: 12 } } },
          scales: { x: { grid: { display: false } }, y: { beginAtZero: true } },
        },
      });
    }

    // Tabla mensual
    const tbody = document.getElementById("monthly-table");
    tbody.innerHTML = data.monthly.map(m => {
      const hasData = m.income > 0 || m.expense > 0;
      const balCls = m.balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400";
      return `<tr class="border-b border-gray-50 dark:border-gray-700/50 ${hasData ? "" : "opacity-30"}">
        <td class="py-2 text-gray-700 dark:text-gray-300">${MONTH_FULL[m.month - 1].slice(0, 3)}</td>
        <td class="py-2 text-right text-green-600 dark:text-green-400 text-xs">${m.income > 0 ? formatCurrency(m.income) : "—"}</td>
        <td class="py-2 text-right text-red-500 dark:text-red-400 text-xs">${m.expense > 0 ? formatCurrency(m.expense) : "—"}</td>
        <td class="py-2 text-right text-xs font-medium ${hasData ? balCls : "text-gray-300"}">${hasData ? formatCurrency(m.balance) : "—"}</td>
      </tr>`;
    }).join("");

    // Dona top categorías
    if (data.by_category.length === 0) {
      document.getElementById("donut-chart").parentElement.innerHTML = '<p class="text-center text-gray-400 text-sm py-8">Sin gastos este año</p>';
      document.getElementById("category-legend").innerHTML = "";
    } else {
      const top = data.by_category.slice(0, 8);
      if (donutChart) {
        donutChart.data.labels = top.map(c => `${c.icon} ${c.name}`);
        donutChart.data.datasets[0].data = top.map(c => c.amount);
        donutChart.update();
      } else {
        donutChart = new Chart(document.getElementById("donut-chart"), {
          type: "doughnut",
          data: {
            labels: top.map(c => `${c.icon} ${c.name}`),
            datasets: [{ data: top.map(c => c.amount), backgroundColor: CHART_PALETTE }],
          },
          options: {
            cutout: "60%",
            plugins: { legend: { display: false } },
            responsive: true, maintainAspectRatio: false,
          },
        });
      }
      document.getElementById("category-legend").innerHTML = top.map((c, i) => `
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${CHART_PALETTE[i]}"></span>
            <span class="text-gray-600 dark:text-gray-400">${c.icon} ${c.name}</span>
          </div>
          <div class="flex gap-2 text-right">
            <span class="text-gray-400">${c.percentage}%</span>
            <span class="font-medium text-gray-700 dark:text-gray-300">${formatCurrency(c.amount)}</span>
          </div>
        </div>`).join("");
    }
  } catch (err) {
    console.error(err);
  }
}

function exportCSV() {
  const year = yearSelect.value;
  window.location.href = `/api/reports/export/csv?year=${year}`;
}

yearSelect.addEventListener("change", loadReport);
loadReport();
