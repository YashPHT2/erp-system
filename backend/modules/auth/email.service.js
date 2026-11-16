const nodemailer = require('nodemailer');
const config = require('../../config/env');
const ApiError = require('../../utils/ApiError');
function isConfigured() { return Boolean(config.smtpHost && config.smtpFrom); }
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function sendPasswordReset(email, name, token) {
  if (!isConfigured()) throw new ApiError(503, 'Password-reset email is not configured.', 'EMAIL_NOT_CONFIGURED');
  const transport = nodemailer.createTransport({ host: config.smtpHost, port: config.smtpPort, secure: config.smtpPort === 465,
    ...(config.smtpUser ? { auth: { user: config.smtpUser, pass: config.smtpPass } } : {}),
    connectionTimeout: 10000, socketTimeout: 15000 });
  const url = `${config.clientOrigin}/reset-password#token=${encodeURIComponent(token)}`;
  try {
    await transport.sendMail({ from: config.smtpFrom, to: email, subject: 'Reset your EduFinance password',
      text: `Hi ${name},\n\nReset your password: ${url}\n\nThis link expires in one hour.`,
      html: `<p>Hi ${escapeHtml(name)},</p><p><a href="${escapeHtml(url)}">Reset your password</a></p><p>This link expires in one hour.</p>` });
  } catch (_) { throw new ApiError(503, 'Email delivery is unavailable. Please try again later.', 'EMAIL_DELIVERY_FAILED'); }
  finally { transport.close(); }
}
module.exports = { sendPasswordReset, isConfigured };
