const authService = require('./auth.service');
const { send } = require('../../utils/respond');
const config = require('../../config/env');
const COOKIE = 'edufinance_refresh';
const PATH = '/api/v1/auth';
function cookieOptions() { return { httpOnly: true, sameSite: 'strict', secure: config.nodeEnv === 'production', path: PATH }; }
function setSession(res, data) {
  res.cookie(COOKIE, data.refreshToken, { ...cookieOptions(), maxAge: data.expiresAt ? Math.max(0, new Date(data.expiresAt).getTime() - Date.now()) : config.refreshTokenExpiryDays * 86400000 });
}
function clearSession(res) { res.clearCookie(COOKIE, cookieOptions()); }
async function login(req, res) {
  try {
    const data = await authService.login(req.body, req.ip);
    setSession(res, data);
    return send(res, { accessToken: data.accessToken, user: data.user }, 'Signed in.');
  } catch (error) {
    if (error.code === 'LOGIN_LOCKED') res.set('Retry-After', String(error.details.retryAfterSeconds));
    throw error;
  }
}
async function refresh(req, res) {
  try {
    const data = await authService.refresh(req.cookies?.[COOKIE]);
    setSession(res, data);
    return send(res, { accessToken: data.accessToken, user: data.user }, 'Session refreshed.');
  } catch (error) { clearSession(res); throw error; }
}
async function logout(req, res) {
  await authService.logout(req.cookies?.[COOKIE]);
  clearSession(res);
  return send(res, null, 'Signed out.');
}
async function setup(req, res) { const data = await authService.setup(req.body); return send(res, null, data.message, 201); }
async function forgotPassword(req, res) { const data = await authService.forgotPassword(req.body?.email); return send(res, null, data.message); }
async function resetPassword(req, res) { const data = await authService.resetPassword(req.body?.token, req.body?.newPassword); clearSession(res); return send(res, null, data.message); }
async function changePassword(req, res) { const data = await authService.changePassword(req.user.userId, req.body); clearSession(res); return send(res, null, data.message); }
module.exports = { login, refresh, logout, setup, forgotPassword, resetPassword, changePassword };
