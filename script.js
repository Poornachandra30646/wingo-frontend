// ==================== CONFIG ====================
const SERVER_URL = "http://localhost:3000";
const socket = io(SERVER_URL);

// ==================== STATE ====================
let allData = [];
let numberFrequency = {};
let colorDistribution = {};

// ==================== CHARTS INITIALIZATION ====================
let numberChart = null;
let colorChart = null;

function initCharts() {
  const numberCtx = document.getElementById("numberChart").getContext("2d");
  const colorCtx = document.getElementById("colorChart").getContext("2d");

  numberChart = new Chart(numberCtx, {
    type: "bar",
    data: {
      labels: [],
      datasets: [{
        label: "Frequency",
        data: [],
        backgroundColor: "#22c55e",
        borderColor: "#16a34a",
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: "white" },
          grid: { color: "#333" }
        },
        x: { ticks: { color: "white" }, grid: { color: "#333" } }
      },
      plugins: {
        legend: { labels: { color: "white" } }
      }
    }
  });

  colorChart = new Chart(colorCtx, {
    type: "pie",
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: ["#22c55e", "#ef4444", "#8b5cf6", "#f59e0b"]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "white" } }
      }
    }
  });
}

// ==================== UPDATE CHARTS ====================
function updateNumberChart() {
  if (!numberChart) return;

  const labels = Object.keys(numberFrequency).sort((a, b) => a - b);
  const data = labels.map(num => numberFrequency[num]);

  numberChart.data.labels = labels;
  numberChart.data.datasets[0].data = data;
  numberChart.update();
}

function updateColorChart() {
  if (!colorChart) return;

  const labels = Object.keys(colorDistribution);
  const data = labels.map(color => colorDistribution[color]);

  colorChart.data.labels = labels;
  colorChart.data.datasets[0].data = data;
  colorChart.update();
}

// ==================== UPDATE STATS ====================
function updateStats() {
  const stats = { total: 0, big: 0, small: 0, green: 0, red: 0 };

  allData.forEach(item => {
    stats.total++;
    if (item.size === "big") stats.big++;
    if (item.size === "small") stats.small++;
    if (item.color === "Green") stats.green++;
    if (item.color === "Red") stats.red++;
  });

  document.getElementById("total").textContent = stats.total;
  document.getElementById("big").textContent = stats.big;
  document.getElementById("small").textContent = stats.small;
  document.getElementById("green").textContent = stats.green;
  document.getElementById("red").textContent = stats.red;
}

// ==================== UPDATE TABLE ====================
function updateTable() {
  const tbody = document.getElementById("tbody");
  tbody.innerHTML = "";

  allData.slice(0, 50).forEach(item => {
    const tr = document.createElement("tr");

    const colorClass = item.color === "Green" ? "green" : item.color === "Red" ? "red" : "violet";

    tr.innerHTML = `
      <td>${item.time}</td>
      <td>${item.issue}</td>
      <td>${item.number}</td>
      <td class="${colorClass}">${item.color}</td>
      <td>${item.size}</td>
    `;

    tbody.appendChild(tr);
  });
}

// ==================== PROCESS NEW DATA ====================
function processData(item) {
  // Add to allData
  allData.unshift(item);

  // Update frequency
  numberFrequency[item.number] = (numberFrequency[item.number] || 0) + 1;

  // Update color distribution
  colorDistribution[item.color] = (colorDistribution[item.color] || 0) + 1;

  // Update UI
  updateStats();
  updateTable();
  updateNumberChart();
  updateColorChart();
}

// ==================== SOCKET EVENTS ====================
socket.on("connect", () => {
  console.log("✅ Connected to server");
});

socket.on("new_data", (data) => {
  console.log("📥 New data received:", data);
  processData(data);
});

socket.on("disconnect", () => {
  console.log("❌ Disconnected from server");
});

// ==================== LOAD HISTORY ====================
async function loadHistory() {
  try {
    const res = await fetch(`${SERVER_URL}/history`);
    const data = await res.json();

    console.log("📊 History loaded:", data.length, "records");

    // Reset state
    allData = [];
    numberFrequency = {};
    colorDistribution = {};

    // Load data in reverse (oldest first)
    data.reverse().forEach(item => processData(item));

  } catch (err) {
    console.log("❌ History load error:", err.message);
  }
}

// ==================== DOWNLOAD BUTTON ====================
document.getElementById("downloadBtn").addEventListener("click", async () => {
  try {
    console.log("📥 Downloading CSV...");

    const response = await fetch(`${SERVER_URL}/download`);
    const blob = await response.blob();

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wingo_data.csv";
    document.body.appendChild(a);
    a.click();

    // Cleanup
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    console.log("✅ CSV downloaded successfully");

  } catch (err) {
    console.log("❌ Download error:", err.message);
    alert("Failed to download CSV");
  }
});

// ==================== INITIALIZATION ====================
window.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Initializing dashboard...");
  initCharts();
  loadHistory();
});