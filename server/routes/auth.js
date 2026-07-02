// server/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");

const router = express.Router();

// ---- Create login credential (signup) ----
router.post("/signup", (req, res) => {
  const { username, email, password } = req.body || {};

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Username, e-mail and password are all required." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long." });
  }

  const existing = db
    .prepare(`SELECT id FROM users WHERE username = ? OR email = ?`)
    .get(username, email);
  if (existing) {
    return res.status(409).json({ error: "A user with that username or e-mail already exists." });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(`INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`)
    .run(username, email, passwordHash);

  req.session.userId = info.lastInsertRowid;
  req.session.username = username;

  res.json({ ok: true, username });
});

// ---- Login ----
router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const user = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  req.session.userId = user.id;
  req.session.username = user.username;

  res.json({ ok: true, username: user.username });
});

// ---- Logout ----
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// ---- Session check (used by front-end to decide which page to show) ----
router.get("/session", (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({ loggedIn: true, username: req.session.username });
  }
  res.json({ loggedIn: false });
});

module.exports = router;
