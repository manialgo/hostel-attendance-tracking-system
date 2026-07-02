// server/routes/students.js
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");
const db = require("../db");
const { requireLogin } = require("../middleware/auth");
const { createOtp, verifyOtp } = require("../utils/otp");
const { sendOtpEmail } = require("../utils/mailer");

const router = express.Router();
const upload = multer({ dest: "uploads_tmp/" });

// Accepted CSV header variants, normalized to a canonical key
const HEADER_MAP = {
  "hostel room number": "room_number",
  "room number": "room_number",
  "room": "room_number",
  "name of the student": "student_name",
  "student name": "student_name",
  "name": "student_name",
  "year of study": "year_of_study",
  "year": "year_of_study",
  "department": "department",
  "dept": "department",
};

function normalizeHeader(h) {
  return h.trim().toLowerCase();
}

// ---- CSV import (the very first data-loading step after account creation) ----
router.post("/import", requireLogin, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No CSV file was uploaded." });
  }

  const rows = [];
  const filePath = req.file.path;

  fs.createReadStream(filePath)
    .pipe(
      csv({
        mapHeaders: ({ header }) => HEADER_MAP[normalizeHeader(header)] || null,
      })
    )
    .on("data", (row) => {
      if (row.room_number && row.student_name && row.year_of_study && row.department) {
        rows.push({
          room_number: String(row.room_number).trim(),
          student_name: String(row.student_name).trim(),
          year_of_study: String(row.year_of_study).trim(),
          department: String(row.department).trim(),
        });
      }
    })
    .on("end", () => {
      fs.unlink(filePath, () => {});

      if (rows.length === 0) {
        return res.status(400).json({
          error:
            "No valid rows found. Expected columns: Hostel Room Number, Name of the Student, Year of Study, Department.",
        });
      }

      const insert = db.prepare(
        `INSERT INTO students (room_number, student_name, year_of_study, department, present)
         VALUES (@room_number, @student_name, @year_of_study, @department, 0)`
      );
      db.exec("BEGIN");
      try {
        for (const r of rows) insert.run(r);
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        return res.status(500).json({ error: "Failed to save imported rows: " + err.message });
      }

      res.json({ ok: true, imported: rows.length });
    })
    .on("error", (err) => {
      fs.unlink(filePath, () => {});
      res.status(500).json({ error: "Failed to parse CSV: " + err.message });
    });
});

// ---- List students, sortable by room / department / year ----
router.get("/", requireLogin, (req, res) => {
  const sortBy = req.query.sort || "room_number";
  const allowed = { room: "room_number", department: "department", year: "year_of_study" };
  const column = allowed[sortBy] || "room_number";

  const students = db
    .prepare(
      `SELECT id, room_number, student_name, year_of_study, department, present
       FROM students
       ORDER BY ${column} ASC, room_number ASC, student_name ASC`
    )
    .all();

  res.json({ students });
});

// ---- Toggle present/absent for one student ----
router.patch("/:id/toggle", requireLogin, (req, res) => {
  const { id } = req.params;
  const student = db.prepare(`SELECT * FROM students WHERE id = ?`).get(id);
  if (!student) return res.status(404).json({ error: "Student not found." });

  const newValue = student.present ? 0 : 1;
  db.prepare(`UPDATE students SET present = ?, updated_at = datetime('now') WHERE id = ?`).run(
    newValue,
    id
  );

  res.json({ ok: true, id: Number(id), present: newValue });
});

// ---- Delete a student (kept simple, no OTP needed for removal) ----
router.delete("/:id", requireLogin, (req, res) => {
  db.prepare(`DELETE FROM students WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// ---- Sidebar "add entry" flow, step 1: request OTP ----
router.post("/otp/request", requireLogin, async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "E-mail is required." });

  const code = createOtp(email, "add-student");
  try {
    await sendOtpEmail(email, code);
    res.json({ ok: true, message: "OTP sent to " + email });
  } catch (err) {
    res.status(500).json({ error: "Failed to send OTP e-mail: " + err.message });
  }
});

// ---- Sidebar "add entry" flow, step 2: verify OTP + create the student ----
router.post("/otp/verify-and-add", requireLogin, (req, res) => {
  const { email, code, room_number, student_name, year_of_study, department } = req.body || {};

  if (!email || !code) {
    return res.status(400).json({ error: "E-mail and OTP code are required." });
  }
  const result = verifyOtp(email, "add-student", code);
  if (!result.ok) {
    return res.status(400).json({ error: result.reason });
  }

  if (!room_number || !student_name || !year_of_study || !department) {
    return res.status(400).json({ error: "All student fields are required." });
  }

  const info = db
    .prepare(
      `INSERT INTO students (room_number, student_name, year_of_study, department, present)
       VALUES (?, ?, ?, ?, 0)`
    )
    .run(room_number.trim(), student_name.trim(), year_of_study.trim(), department.trim());

  res.json({ ok: true, id: info.lastInsertRowid });
});

module.exports = router;
