'use strict';

const config = require('../config/env');

// Lazy-loaded transporter — created once on first use when email is enabled.
// This avoids any startup overhead when EMAIL_ENABLED=false (including all automated tests).
let _transporter = null;

function getTransporter() {
  if (!_transporter) {
    const nodemailer = require('nodemailer'); // eslint-disable-line global-require
    _transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      // Omit auth entirely when credentials are not set (e.g. Mailpit dev server).
      ...(config.smtp.user ? { auth: { user: config.smtp.user, pass: config.smtp.pass } } : {}),
    });
  }
  return _transporter;
}

/**
 * Sends a password reset email containing the one-time reset link.
 * The raw reset token is embedded in `resetUrl` only — it is never logged or stored separately.
 * When EMAIL_ENABLED=false this is a no-op (no-Mailpit dev and all automated tests).
 *
 * @param {{ email: string, resetUrl: string }} params
 */
async function sendPasswordResetEmail({ email, resetUrl }) {
  if (!config.emailEnabled) return;

  await getTransporter().sendMail({
    from: config.smtp.from,
    to: email,
    subject: 'รีเซ็ตรหัสผ่าน GameMarket',
    text: [
      'คุณได้ขอรีเซ็ตรหัสผ่านสำหรับบัญชี GameMarket',
      '',
      'คลิกลิงก์นี้เพื่อตั้งรหัสผ่านใหม่ (ลิงก์จะหมดอายุใน 15 นาที):',
      resetUrl,
      '',
      'หากคุณไม่ได้ร้องขอ กรุณาเพิกเฉยต่ออีเมลนี้',
    ].join('\n'),
    html: `
      <p>คุณได้ขอรีเซ็ตรหัสผ่านสำหรับบัญชี GameMarket</p>
      <p>คลิกลิงก์นี้เพื่อตั้งรหัสผ่านใหม่ <strong>(ลิงก์จะหมดอายุใน 15 นาที)</strong>:</p>
      <p><a href="${resetUrl}" style="word-break:break-all">${resetUrl}</a></p>
      <p style="color:#888;font-size:12px">หากคุณไม่ได้ร้องขอ กรุณาเพิกเฉยต่ออีเมลนี้</p>
    `.trim(),
  });
}

/**
 * Sends an account-verification code. The code is passed directly to the mail
 * transport and is never logged, persisted in plaintext, or returned by an API.
 */
async function sendEmailVerificationOtp({ email, otp }) {
  if (!config.emailEnabled) return;

  await getTransporter().sendMail({
    from: config.smtp.from,
    to: email,
    subject: 'รหัสยืนยันอีเมล GameMarket',
    text: [
      `รหัสยืนยันอีเมลของคุณคือ: ${otp}`,
      '',
      'รหัสนี้จะหมดอายุใน 10 นาที และใช้ได้เพียงครั้งเดียว',
      'หากคุณไม่ได้ร้องขอรหัสนี้ กรุณาเพิกเฉยต่ออีเมลนี้',
    ].join('\n'),
    html: `
      <p>รหัสยืนยันอีเมลของคุณคือ: <strong>${otp}</strong></p>
      <p>รหัสนี้จะหมดอายุใน 10 นาที และใช้ได้เพียงครั้งเดียว</p>
      <p style="color:#888;font-size:12px">หากคุณไม่ได้ร้องขอรหัสนี้ กรุณาเพิกเฉยต่ออีเมลนี้</p>
    `.trim(),
  });
}

module.exports = { sendPasswordResetEmail, sendEmailVerificationOtp };
