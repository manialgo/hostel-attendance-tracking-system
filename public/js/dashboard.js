// public/js/dashboard.js
let currentSort = "room";

async function guardSession() {
  const res = await fetch("/api/auth/session");
  const data = await res.json();
  if (!data.loggedIn) {
    window.location.href = "/index.html";
    return;
  }
  document.getElementById("whoami").textContent = data.username;
}

function statusCell(student) {
  const checked = student.present ? "checked" : "";
  const label = student.present ? "Present" : "Absent";
  const labelClass = student.present ? "present" : "absent";
  return `
    <label class="toggle">
      <input type="checkbox" data-id="${student.id}" ${checked} />
      <span class="slider"></span>
    </label>
    <span class="status-label ${labelClass}" id="label-${student.id}">${label}</span>
  `;
}

function renderStats(students) {
  const total = students.length;
  const present = students.filter(s => s.present).length;
  const absent = total - present;
  const pct = n => (total ? ((n / total) * 100).toFixed(1) : "0.0");

  document.getElementById("statRow").innerHTML = `
    <div class="stat-pill">Total: <b>${total}</b></div>
    <div class="stat-pill">Present: <b>${present}</b> (${pct(present)}%)</div>
    <div class="stat-pill">Absent: <b>${absent}</b> (${pct(absent)}%)</div>
  `;
}

async function loadStudents() {
  const tbody = document.getElementById("registerBody");
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--muted);">Loading…</td></tr>`;

  const res = await fetch(`/api/students?sort=${currentSort}`);
  const data = await res.json();
  const students = data.students || [];

  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--muted);">
      No records yet. <a href="/upload.html">Import a CSV sheet</a> to begin.</td></tr>`;
    renderStats([]);
    return;
  }

  tbody.innerHTML = students.map(s => `
    <tr>
      <td>${escapeHtml(s.room_number)}</td>
      <td>${escapeHtml(s.student_name)}</td>
      <td>${escapeHtml(s.year_of_study)}</td>
      <td>${escapeHtml(s.department)}</td>
      <td>${statusCell(s)}</td>
    </tr>
  `).join("");

  renderStats(students);

  tbody.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener("change", onToggle);
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

async function onToggle(e) {
  const id = e.target.getAttribute("data-id");
  const res = await fetch(`/api/students/${id}/toggle`, { method: "PATCH" });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || "Could not update attendance.");
    e.target.checked = !e.target.checked;
    return;
  }
  const label = document.getElementById(`label-${id}`);
  label.textContent = data.present ? "Present" : "Absent";
  label.className = `status-label ${data.present ? "present" : "absent"}`;
  loadStudents(); // refresh stats
}

document.querySelectorAll(".sort-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sort-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentSort = btn.getAttribute("data-sort");
    loadStudents();
  });
});

document.getElementById("logoutLink").addEventListener("click", async (e) => {
  e.preventDefault();
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/index.html";
});

// ---- Sidebar OTP add-entry flow ----
document.getElementById("sendOtpBtn").addEventListener("click", async () => {
  const msg = document.getElementById("sidebarMsg");
  msg.className = "msg";
  const email = document.getElementById("otpEmail").value.trim();
  if (!email) { msg.textContent = "Enter an e-mail first."; msg.className = "msg error"; return; }

  const res = await fetch("/api/students/otp/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) { msg.textContent = data.error; msg.className = "msg error"; return; }

  msg.textContent = data.message + " (check your inbox — or the server console in dev mode)";
  msg.className = "msg success";
  document.getElementById("otpStep2").style.display = "block";
});

document.getElementById("verifyAddBtn").addEventListener("click", async () => {
  const msg = document.getElementById("sidebarMsg");
  msg.className = "msg";
  const payload = {
    email: document.getElementById("otpEmail").value.trim(),
    code: document.getElementById("otpCode").value.trim(),
    room_number: document.getElementById("newRoom").value.trim(),
    student_name: document.getElementById("newName").value.trim(),
    year_of_study: document.getElementById("newYear").value.trim(),
    department: document.getElementById("newDept").value.trim(),
  };

  const res = await fetch("/api/students/otp/verify-and-add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) { msg.textContent = data.error; msg.className = "msg error"; return; }

  msg.textContent = "Entry added successfully.";
  msg.className = "msg success";
  ["otpCode", "newRoom", "newName", "newYear", "newDept"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("otpStep2").style.display = "none";
  loadStudents();
});

guardSession();
loadStudents();
