// server/routes/report.js
const express = require("express");
const db = require("../db");
const { requireLogin } = require("../middleware/auth");

const router = express.Router();

function aggregate(groupColumn) {
  return db
    .prepare(
      `SELECT ${groupColumn} AS label,
              SUM(CASE WHEN present = 1 THEN 1 ELSE 0 END) AS present_count,
              SUM(CASE WHEN present = 0 THEN 1 ELSE 0 END) AS absent_count,
              COUNT(*) AS total
       FROM students
       GROUP BY ${groupColumn}
       ORDER BY ${groupColumn} ASC`
    )
    .all();
}

router.get("/summary", requireLogin, (req, res) => {
  const overall = db
    .prepare(
      `SELECT
         SUM(CASE WHEN present = 1 THEN 1 ELSE 0 END) AS present_count,
         SUM(CASE WHEN present = 0 THEN 1 ELSE 0 END) AS absent_count,
         COUNT(*) AS total
       FROM students`
    )
    .get();

  res.json({
    overall,
    byRoom: aggregate("room_number"),
    byDepartment: aggregate("department"),
    byYear: aggregate("year_of_study"),
    generatedAt: new Date().toISOString(),
  });
});

module.exports = router;
