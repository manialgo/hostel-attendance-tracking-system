// server/utils/otp.js
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("../db");

const OTP_TTL_MINUTES = 10;

function generateCode() {
  // 6-digit numeric OTP
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function createOtp(email, purpose) {
  const code = generateCode();
  const codeHash = bcrypt.hashSync(code, 8);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO otp_codes (email, code_hash, purpose, expires_at) VALUES (?, ?, ?, ?)`
  ).run(email, codeHash, purpose, expiresAt);

  return code;
}

function verifyOtp(email, purpose, code) {
  const row = db
    .prepare(
      `SELECT * FROM otp_codes
       WHERE email = ? AND purpose = ? AND verified = 0
       ORDER BY id DESC LIMIT 1`
    )
    .get(email, purpose);

  if (!row) return { ok: false, reason: "No pending OTP for this e-mail." };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "OTP has expired. Please request a new one." };
  }
  if (!bcrypt.compareSync(code, row.code_hash)) {
    return { ok: false, reason: "Incorrect OTP." };
  }

  db.prepare(`UPDATE otp_codes SET verified = 1 WHERE id = ?`).run(row.id);
  return { ok: true };
}

module.exports = { createOtp, verifyOtp, OTP_TTL_MINUTES };
