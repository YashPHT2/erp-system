'use strict';

const config = require('../../config/env');

let transporter = null;
try {
  const nodemailer = require('nodemailer');
  if (config.smtpHost) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort || 587,
      secure: (config.smtpPort || 587) === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });
  }
} catch (_e) {
  transporter = null;
}

async function sendPasswordReset(email, name, rawToken) {
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const resetUrl = `${clientOrigin}/reset-password?token=${rawToken}`;

  if (!transporter || !config.smtpHost) {
    console.log(`[email.service] Password reset link for ${email}: ${resetUrl}`);
    return;
  }

  const from = config.smtpFrom || 'EduFinance <noreply@edufinance.local>';

  try {
    await transporter.sendMail({
      from,
      to: email,
      subject: 'Reset your EduFinance password',
      html: `
        <p>Hi ${name},</p>
        <p>You requested a password reset. Click the link below to set a new password:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>
        <p>— EduFinance Team</p>
      `,
      text: `Hi ${name},\n\nReset your password here: ${resetUrl}\n\nThis link expires in 1 hour.`,
    });
  } catch (err) {
    // Never throw — email failures must not break the API
    console.error('[email.service] Failed to send password reset email:', err.message);
  }
}

module.exports = { sendPasswordReset };
