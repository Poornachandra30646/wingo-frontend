// ==================== CONFIG ====================
const SERVER_URL = "https://wingo-backend-btaj.onrender.com";
const socket = io(SERVER_URL);

// ==================== STATE ====================
let allData = [];
let predictions = {
  number: null,
  numberConfidence: 0,
  topNumbers: [],
  color: null,
  colorConfidence: 0,
  colorProbs: { Green: 0, Red: 0 },
  size: null,
  sizeConfidence: 0,
  sizeProbs: { big: 0, small: 0 }
};

let charts = {
  prediction: null,
  pattern: null
};

// ==================== CHARTS INITIALIZATION ====================
function initCharts() {
  const predCtx = document.getElementById("predictionChart").getContext("2d");
  const patternCtx = document.getElementById("patternChart").getContext("2d");

  charts.prediction = new Chart(predCtx, {
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

  charts.pattern = new Chart(patternCtx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Color: Green",
        data: [],
        borderColor: "#22c55e",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }, {
        label: "Color: Red",
        data: [],
        borderColor: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
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
}

// ==================== PREDICTION ALGORITHMS ====================

// Predict next number based on frequency analysis and due numbers
function predictNumber() {
  if (allData.length < 5) {
    predictions.number = Math.floor(Math.random() * 10);
    predictions.numberConfidence = 30;
    return;
  }

  const recent20 = allData.slice(0, 20);
  const frequency = {};
  const allFrequency = {};

  // Count in recent 20
  recent20.forEach(item => {
    frequency[item.number] = (frequency[item.number] || 0) + 1;
  });

  // Count in all data
  allData.forEach(item => {
    allFrequency[item.number] = (allFrequency[item.number] || 0) + 1;
  });

  // Numbers due (least frequent overall)
  let minOverall = Infinity;
  let dueNumbers = [];
  for (let i = 0; i < 10; i++) {
    const count = allFrequency[i] || 0;
    if (count < minOverall) {
      minOverall = count;
      dueNumbers = [i];
    } else if (count === minOverall) {
      dueNumbers.push(i);
    }
  }

  // Hot numbers (frequent in recent)
  const sorted = Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .map(([num, count]) => ({ num: parseInt(num), count }));

  // Get top 3
  predictions.topNumbers = sorted.slice(0, 3);

  // Predict: 60% hot numbers, 40% due numbers
  const predictedTop = sorted[0];
  if (predictedTop) {
    if (Math.random() < 0.6 || dueNumbers.length === 0) {
      predictions.number = predictedTop.num;
      predictions.numberConfidence = Math.min(40 + predictedTop.count * 5, 95);
    } else {
      predictions.number = dueNumbers[Math.floor(Math.random() * dueNumbers.length)];
      predictions.numberConfidence = 40;
    }
  }
}

// Predict next color based on streak and probability
function predictColor() {
  if (allData.length < 5) {
    predictions.color = "Green";
    predictions.colorConfidence = 50;
    return;
  }

  const recent10 = allData.slice(0, 10);
  let greenCount = 0;
  let redCount = 0;
  let greenStreak = 0;
  let redStreak = 0;
  let maxGreenStreak = 0;
  let maxRedStreak = 0;

  // Count streaks
  recent10.forEach((item, idx) => {
    if (item.color === "Green") {
      greenCount++;
      greenStreak++;
      maxGreenStreak = Math.max(maxGreenStreak, greenStreak);
      redStreak = 0;
    } else {
      redCount++;
      redStreak++;
      maxRedStreak = Math.max(maxRedStreak, redStreak);
      greenStreak = 0;
    }
  });

  // Overall probability
  const totalRecent = greenCount + redCount;
  const greenProb = (greenCount / totalRecent) * 100;
  const redProb = (redCount / totalRecent) * 100;

  predictions.colorProbs = { Green: greenProb, Red: redProb };

  // Streak breaking logic: if one color has 3+ streak, opposite is due
  if (maxGreenStreak >= 3 && allData[0].color === "Green") {
    predictions.color = "Red";
    predictions.colorConfidence = 70;
  } else if (maxRedStreak >= 3 && allData[0].color === "Red") {
    predictions.color = "Green";
    predictions.colorConfidence = 70;
  } else {
    // Otherwise go with probability
    const useRandom = Math.random() * 100;
    if (useRandom < greenProb) {
      predictions.color = "Green";
    } else {
      predictions.color = "Red";
    }
    predictions.colorConfidence = Math.max(greenProb, redProb);
  }
}

// Predict next size based on number trends
function predictSize() {
  if (allData.length < 5) {
    predictions.size = Math.random() < 0.5 ? "Big" : "Small";
    predictions.sizeConfidence = 50;
    return;
  }

  const recent15 = allData.slice(0, 15);
  let bigCount = 0;
  let smallCount = 0;

  recent15.forEach(item => {
    if (item.size === "Big") bigCount++;
    else smallCount++;
  });

  const total = bigCount + smallCount;
  const bigProb = (bigCount / total) * 100;
  const smallProb = (smallCount / total) * 100;

  predictions.sizeProbs = { big: bigProb, small: smallProb };

  predictions.size = bigProb > smallProb ? "Big" : "Small";
  predictions.sizeConfidence = Math.max(bigProb, smallProb);
}

// ==================== RUN PREDICTIONS ====================
function runPredictions() {
  predictNumber();
  predictColor();
  predictSize();
  updatePredictionUI();
  updateStatsUI();
  updateCharts();
}

// ==================== UPDATE UI ====================
function updatePredictionUI() {
  // Number prediction
  document.getElementById("predNumber").textContent = predictions.number;
  document.getElementById("numConfidence").textContent = Math.round(predictions.numberConfidence);

  const topList = document.getElementById("topNumbers");
  topList.innerHTML = predictions.topNumbers
    .map(item => `<li>#${item.num} (${item.count}x)</li>`)
    .join("");

  // Color prediction
  const colorEmoji = predictions.color === "Green" ? "🟢" : "🔴";
  document.getElementById("predColor").textContent = colorEmoji;
  document.getElementById("predColor").setAttribute("data-color", predictions.color);
  document.getElementById("colorConfidence").textContent = Math.round(predictions.colorConfidence);

  const greenPercent = predictions.colorProbs.Green;
  const redPercent = predictions.colorProbs.Red;
  document.getElementById("greenProb").style.width = greenPercent + "%";
  document.getElementById("redProb").style.width = redPercent + "%";
  document.getElementById("greenPercent").textContent = Math.round(greenPercent) + "%";
  document.getElementById("redPercent").textContent = Math.round(redPercent) + "%";

  // Size prediction
  const sizeEmoji = predictions.size === "Big" ? "📈" : "📉";
  document.getElementById("predSize").textContent = sizeEmoji;
  document.getElementById("predSize").setAttribute("data-size", predictions.size);
  document.getElementById("sizeConfidence").textContent = Math.round(predictions.sizeConfidence);

  const bigPercent = predictions.sizeProbs.big;
  const smallPercent = predictions.sizeProbs.small;
  document.getElementById("bigProb").style.width = bigPercent + "%";
  document.getElementById("smallProb").style.width = smallPercent + "%";
  document.getElementById("bigPercent").textContent = Math.round(bigPercent) + "%";
  document.getElementById("smallPercent").textContent = Math.round(smallPercent) + "%";
}

function updateStatsUI() {
  if (allData.length === 0) return;

  const frequency = {};
  const colorFreq = {};
  let greenStreak = 0;
  let maxStreak = 0;
  let streakColor = "--";

  // Analyze all data
  allData.forEach(item => {
    frequency[item.number] = (frequency[item.number] || 0) + 1;
    colorFreq[item.color] = (colorFreq[item.color] || 0) + 1;
  });

  // Count current streak
  let currentColor = null;
  let currentCount = 0;
  for (let item of allData) {
    if (item.color === currentColor) {
      currentCount++;
      if (currentCount > maxStreak) {
        maxStreak = currentCount;
        streakColor = currentColor;
      }
    } else {
      currentColor = item.color;
      currentCount = 1;
    }
  }

  // Most frequent
  const sorted = Object.entries(frequency).sort((a, b) => b[1] - a[1]);
  const mostFreq = sorted[0];
  const leastFreq = sorted[sorted.length - 1];

  document.getElementById("freqNumber").textContent = mostFreq[0];
  document.getElementById("freqNumberCount").textContent = mostFreq[1] + " times";

  document.getElementById("rareNumber").textContent = leastFreq[0];
  document.getElementById("rareNumberCount").textContent = leastFreq[1] + " times";

  // Most likely color
  const topColor = Object.entries(colorFreq).sort((a, b) => b[1] - a[1])[0];
  document.getElementById("freqColor").textContent = topColor[0];
  document.getElementById("freqColorCount").textContent = topColor[1] + " times";

  // Streak
  document.getElementById("winStreak").textContent = maxStreak;
  document.getElementById("streakColor").textContent = streakColor === "--" ? "--" : streakColor + " streak";
}

function updateCharts() {
  // Number frequency chart (last 20)
  const recent20 = allData.slice(0, 20);
  const frequency = {};
  recent20.forEach(item => {
    frequency[item.number] = (frequency[item.number] || 0) + 1;
  });

  const labels = Object.keys(frequency).sort((a, b) => a - b);
  const data = labels.map(num => frequency[num]);

  charts.prediction.data.labels = labels;
  charts.prediction.data.datasets[0].data = data;
  charts.prediction.update();

  // Pattern chart - rolling green/red probability
  const patternData = [];
  const patternLabels = [];
  const windowSize = 10;

  for (let i = 0; i < recent20.length - windowSize; i++) {
    const window = recent20.slice(i, i + windowSize);
    let greenCount = 0;
    window.forEach(item => {
      if (item.color === "Green") greenCount++;
    });
    const greenPercent = (greenCount / windowSize) * 100;
    patternData.push(greenPercent);
    patternLabels.push(`T-${i}`);
  }

  charts.pattern.data.labels = patternLabels;
  charts.pattern.data.datasets[0].data = patternData;
  charts.pattern.data.datasets[1].data = patternData.map(p => 100 - p);
  charts.pattern.update();
}

// ==================== UPDATE RECENT TABLE ====================
function updateRecentTable() {
  const tbody = document.getElementById("recentTable");
  tbody.innerHTML = "";

  const recent20 = allData.slice(0, 20);
  recent20.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.time}</td>
      <td><strong>${item.number}</strong></td>
      <td>${item.color === "Green" ? "🟢" : "🔴"} ${item.color}</td>
      <td>${item.size === "Big" ? "📈" : "📉"} ${item.size}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ==================== SOCKET EVENTS ====================
socket.on("connect", () => {
  console.log("✅ Connected to server");
});

socket.on("new_data", (data) => {
  console.log("📥 New data received:", data);
  allData.unshift(data);
  runPredictions();
  updateRecentTable();
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

    // Load in reverse (oldest first)
    allData = data.reverse();

    // Run predictions
    runPredictions();
    updateRecentTable();

  } catch (err) {
    console.log("❌ History load error:", err.message);
  }
}

// ==================== INITIALIZATION ====================
window.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Initializing predictor...");
  initCharts();
  loadHistory();
});
