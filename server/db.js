// server/db.js
// -----------------------------------------------------------------------------
// The entire "database" is a single SQLite file that lives inside this repo
// (see DB_PATH in .env). There is no external database server: cloning the
// repo and running `npm start` is enough to have the full application state.
// -----------------------------------------------------------------------------
const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite"); // built-in since Node 22.5 — no native compile step needed
require("dotenv").config();

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "database", "hostel.db");

// Make sure the /database folder exists before SQLite tries to create the file
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT UNIQUE NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS students (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      room_number    TEXT NOT NULL,
      student_name   TEXT NOT NULL,
      year_of_study  TEXT NOT NULL,
      department     TEXT NOT NULL,
      present        INTEGER NOT NULL DEFAULT 0,   -- 1 = present (green), 0 = absent (red)
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      email       TEXT NOT NULL,
      code_hash   TEXT NOT NULL,
      purpose     TEXT NOT NULL,           -- e.g. 'add-student'
      expires_at  TEXT NOT NULL,
      verified    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_students_room ON students(room_number);
    CREATE INDEX IF NOT EXISTS idx_students_dept ON students(department);
    CREATE INDEX IF NOT EXISTS idx_students_year ON students(year_of_study);
  `);
}

migrate();

if (require.main === module && process.argv.includes("--init")) {
  console.log(`Database initialized at ${DB_PATH}`);
  process.exit(0);
}

module.exports = db;
