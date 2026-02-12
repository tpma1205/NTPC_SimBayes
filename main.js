// main.js
document.addEventListener("DOMContentLoaded", () => {
  const cValueDisplay = document.getElementById("c-value");
  const mInput = document.getElementById("m-input");
  const mValueDisplay = document.getElementById("m-value-display");
  const regenerateButton = document.getElementById("regenerate-btn");
  const sampleSizeInput = document.getElementById("sample-size-input");
  const avgReportsDisplay = document.getElementById("avg-reports-value");
  const resultsTableBody = document.querySelector("#results-table tbody");
  const sortHeaders = document.querySelectorAll("th.sortable");
  const chartModeRadios = document.getElementsByName("chart-mode");

  let data = [];
  let c = 0; // 全體平均逾期率
  let m = 0;
  let scatterChart = null;
  let currentSort = { column: null, direction: "desc" };

  // 計算全體平均逾期率 (c)
  function calculateGlobalAverageOverdue(dataset) {
    let totalReports = 0;
    let totalOverdue = 0;

    dataset.forEach((item) => {
      totalReports += item.reportCount;
      totalOverdue += item.overdueCount;
    });

    return totalReports === 0 ? 0 : totalOverdue / totalReports;
  }

  // 計算全體平均申報次數 (用於 m 的預設值)
  function calculateAverageReports(dataset) {
    let totalReports = 0;
    dataset.forEach((item) => {
      totalReports += item.reportCount;
    });
    return dataset.length === 0 ? 0 : totalReports / dataset.length;
  }

  // 計算貝氏平均
  function calculateBayesianAverage(v, r, m, c) {
    // 公式: w = ((v * r) + (m * c)) / (v + m)
    return (v * r + m * c) / (v + m);
  }

  // 初始化圖表
  function initChart() {
    const ctx = document.getElementById("scatterChart").getContext("2d");
    scatterChart = new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "貝氏平均逾期率 (w)",
            data: [],
            backgroundColor: "rgba(52, 152, 219, 0.6)",
            borderColor: "rgba(52, 152, 219, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        animation: false, // 取消動畫
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: "申報次數 (v)" },
            beginAtZero: true,
          },
          y: {
            title: { display: true, text: "逾期率 (%)" },
            min: 0,
            max: 100,
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function (context) {
                const mode = document.querySelector(
                  'input[name="chart-mode"]:checked',
                ).value;
                const label = mode === "bayesian" ? "w" : "r";
                return `v: ${context.parsed.x}, ${label}: ${context.parsed.y.toFixed(2)}%`;
              },
            },
          },
        },
      },
    });
  }

  // 更新圖表數據
  function updateChart() {
    if (!scatterChart) return;

    // 取得目前選擇的模式
    const mode = document.querySelector(
      'input[name="chart-mode"]:checked',
    ).value;
    const isBayesian = mode === "bayesian";

    const chartData = data.map((item) => {
      const r =
        item.reportCount === 0 ? 0 : item.overdueCount / item.reportCount;

      // 根據模式決定 Y 軸數值
      const yVal = isBayesian
        ? calculateBayesianAverage(item.reportCount, r, m, c)
        : r;

      return { x: item.reportCount, y: yVal * 100 };
    });

    // 更新圖表標籤與標題
    const labelText = isBayesian
      ? "貝氏平均 (加權平均數) 逾期率 (w) (%)"
      : "算術平均逾期率 (r) (%)";
    scatterChart.data.datasets[0].label = labelText;
    scatterChart.options.scales.y.title.text = labelText;
    document.querySelector("#chart-view h2").textContent =
      `數據分佈視覺化 (X軸:申報次數, Y軸:${isBayesian ? "貝氏平均 (加權平均數)" : "算術平均"})`;

    scatterChart.data.datasets[0].data = chartData;
    scatterChart.update("none");
  }

  // 渲染表格
  function renderTable() {
    // 若有啟用排序，先對 data 進行排序
    if (currentSort.column) {
      data.sort((a, b) => {
        const getR = (item) =>
          item.reportCount === 0 ? 0 : item.overdueCount / item.reportCount;
        let valA, valB;

        if (currentSort.column === "r") {
          valA = getR(a);
          valB = getR(b);
        } else if (currentSort.column === "w") {
          valA = calculateBayesianAverage(a.reportCount, getR(a), m, c);
          valB = calculateBayesianAverage(b.reportCount, getR(b), m, c);
        }
        return currentSort.direction === "asc" ? valA - valB : valB - valA;
      });
    }

    resultsTableBody.innerHTML = "";
    updateChart(); // 同步更新圖表

    data.forEach((item) => {
      const arithmeticMean =
        item.reportCount === 0 ? 0 : item.overdueCount / item.reportCount;

      const bayesianAverage = calculateBayesianAverage(
        item.reportCount,
        arithmeticMean,
        m,
        c,
      );

      const newRow = resultsTableBody.insertRow(-1);

      // 格式化顯示 (百分比或小數)
      const rDisplay = (arithmeticMean * 100).toFixed(2) + "%";
      const wDisplay = (bayesianAverage * 100).toFixed(2) + "%";

      // 視覺化 Bar 長度 (將 0-1 映射到 0-100%)
      const rPercent = Math.min(arithmeticMean * 100, 100);
      const wPercent = Math.min(bayesianAverage * 100, 100);

      newRow.innerHTML = `
        <td>${item.companyName}</td>
        <td>${item.reportCount}</td>
        <td>${item.overdueCount}</td>
        <td>
            <div class="bar-container">
                <span>${rDisplay}</span>
                <div class="bar-bg"><div class="bar-fill" style="width: ${rPercent}%"></div></div>
            </div>
        </td> 
        <td>
            <div class="bar-container">
                <span>${wDisplay}</span>
                <div class="bar-bg"><div class="bar-fill" style="width: ${wPercent}%"></div></div>
            </div>
        </td> 
      `;
    });
  }

  // 產生隨機資料
  function generateRandomData(numCompanies) {
    const companies = [];
    for (let i = 1; i <= numCompanies; i++) {
      // 申報次數控制在 1 ~ 50 次 (符合您的需求)
      const reportCount = Math.floor(Math.random() * 50) + 1;

      // 逾期率邏輯調整：目標全體平均約 10% ~ 20%
      // 採用分層隨機以模擬更自然的分佈，避免過於人工的雙峰分佈
      let overdueRate;
      const rand = Math.random();

      if (rand < 0.7) {
        // 70% 優良業者: 逾期率 0% ~ 15%
        overdueRate = Math.random() * 0.15;
      } else if (rand < 0.95) {
        // 25% 一般業者: 逾期率 15% ~ 40%
        overdueRate = 0.15 + Math.random() * 0.25;
      } else {
        // 5% 高風險業者: 逾期率 40% ~ 100%
        overdueRate = 0.4 + Math.random() * 0.6;
      }

      const overdueCount = Math.round(reportCount * overdueRate);

      companies.push({
        companyName: `營建業者 ${String(i).padStart(4, "0")}`,
        reportCount: reportCount,
        overdueCount: overdueCount,
      });
    }
    return companies;
  }

  // 初始化與數據處理
  function initialize() {
    // 1. 生成數據
    const sampleSize = parseInt(sampleSizeInput.value) || 100;
    data = generateRandomData(sampleSize);

    // 2. 計算全體參數 c
    c = calculateGlobalAverageOverdue(data);
    cValueDisplay.textContent = (c * 100).toFixed(2) + "%";

    // 3. 計算全體平均申報次數並顯示
    const avgReports = calculateAverageReports(data);
    avgReportsDisplay.textContent = avgReports.toFixed(2);

    // 4. 設定預設 m
    m = 25;
    mInput.value = m;
    mValueDisplay.textContent = m;

    // 初始化圖表 (如果尚未存在)
    if (!scatterChart) initChart();

    // 5. 渲染
    renderTable();
  }

  // 事件監聽
  regenerateButton.addEventListener("click", initialize);

  mInput.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0) {
      m = val;
      mValueDisplay.textContent = val;
      renderTable();
    }
  });

  // 圖表模式切換監聽
  chartModeRadios.forEach((radio) => {
    radio.addEventListener("change", updateChart);
  });

  // 更新排序圖示 UI
  function updateSortIcons() {
    sortHeaders.forEach((header) => {
      const column = header.dataset.sort;
      const icon = header.querySelector(".sort-icon");

      if (currentSort.column === column) {
        header.classList.add("active-sort");
        icon.textContent = currentSort.direction === "asc" ? "▲" : "▼";
      } else {
        header.classList.remove("active-sort");
        icon.textContent = "⇅";
      }
    });
  }

  // 排序點擊事件
  sortHeaders.forEach((header) => {
    header.addEventListener("click", () => {
      const column = header.dataset.sort;
      if (currentSort.column === column) {
        currentSort.direction =
          currentSort.direction === "desc" ? "asc" : "desc";
      } else {
        currentSort.column = column;
        currentSort.direction = "desc";
      }
      updateSortIcons();
      renderTable();
    });
  });

  // 初始化排序圖示
  updateSortIcons();

  // 啟動
  initialize();
});
