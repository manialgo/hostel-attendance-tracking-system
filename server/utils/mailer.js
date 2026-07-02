// server/utils/mailer.js
const nodemailer = require("nodemailer");
require("dotenv").config();

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(
      "[mailer] SMTP_USER / SMTP_PASS not set in .env — OTP codes will be logged " +
      "to the server console instead of being e-mailed. Fill in .env for real delivery."
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

async function sendOtpEmail(toEmail, code) {
  const t = getTransporter();
  const subject = "Your OTP for Hostel Attendance Register";
  const text = `Your one-time verification code is: ${code}\n\nThis code expires in 10 minutes. If you did not request this, you can ignore this e-mail.`;

  if (!t) {
    // Fallback for local/dev use when SMTP isn't configured yet
    console.log(`\n[DEV FALLBACK] OTP for ${toEmail}: ${code}\n`);
    return { devFallback: true };
  }

  const fromName = process.env.SMTP_FROM_NAME || "Hostel Attendance Register";
  return t.sendMail({
    from: `"${fromName}" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject,
    text,
  });
}

module.exports = { sendOtpEmail };
