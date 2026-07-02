// public/js/report.js
const COLORS = { present: "#2f6b3a", absent: "#a3312b" };

async function guardSession() {
  const res = await fetch("/api/auth/session");
  const data = await res.json();
  if (!data.loggedIn) {
    window.location.href = "/index.html";
    return;
  }
  document.getElementById("whoami").textContent = data.username;
}

function makePieCanvas(container, title) {
  const box = document.createElement("div");
  box.className = "chart-box";
  box.innerHTML = `<h4>${title}</h4><canvas></canvas>`;
  container.appendChild(box);
  return box.querySelector("canvas");
}

function drawPie(canvas, present, absent) {
  new Chart(canvas, {
    type: "pie",
    data: {
      labels: ["Present", "Absent"],
      datasets: [{
        data: [present, absent],
        backgroundColor: [COLORS.present, COLORS.absent],
        borderColor: "#fffdf8",
        borderWidth: 2,
      }],
    },
    options: {
      plugins: {
        legend: { position: "bottom", labels: { font: { family: "Georgia" } } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = present + absent;
              const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : "0.0";
              return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

async function loadReport() {
  const res = await fetch("/api/report/summary");
  const data = await res.json();

  document.getElementById("generatedAt").textContent = new Date(data.generatedAt).toLocaleString();

  const o = data.overall || { present_count: 0, absent_count: 0, total: 0 };
  const pct = n => (o.total ? ((n / o.total) * 100).toFixed(1) : "0.0");
  document.getElementById("overallStats").innerHTML = `
    <div class="stat-pill">Total: <b>${o.total}</b></div>
    <div class="stat-pill">Present: <b>${o.present_count}</b> (${pct(o.present_count)}%)</div>
    <div class="stat-pill">Absent: <b>${o.absent_count}</b> (${pct(o.absent_count)}%)</div>
  `;
  drawPie(document.getElementById("overallChart"), o.present_count, o.absent_count);

  const roomContainer = document.getElementById("roomCharts");
  (data.byRoom || []).forEach(r => {
    const c = makePieCanvas(roomContainer, `Room ${r.label}`);
    drawPie(c, r.present_count, r.absent_count);
  });

  const deptContainer = document.getElementById("deptCharts");
  (data.byDepartment || []).forEach(d => {
    const c = makePieCanvas(deptContainer, d.label);
    drawPie(c, d.present_count, d.absent_count);
  });

  const yearContainer = document.getElementById("yearCharts");
  (data.byYear || []).forEach(y => {
    const c = makePieCanvas(yearContainer, y.label);
    drawPie(c, y.present_count, y.absent_count);
  });
}

document.getElementById("downloadBtn").addEventListener("click", (e) => {
  e.preventDefault();
  window.print(); // "Save as PDF" via the browser's print dialog — no extra dependency needed
});

guardSession();
loadReport();
