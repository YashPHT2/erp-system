'use strict';

const bcrypt = require('bcryptjs');
const authService = require('./auth.service');
const { DevUser } = require('../../models/System');
const RefreshToken = require('../../models/RefreshToken');
const ApiError = require('../../utils/ApiError');
const { send } = require('../../utils/respond');
const config = require('../../config/env');

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_PATH = '/api/v1/auth/refresh';

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.nodeEnv === 'production',
    maxAge: (config.refreshTokenExpiryDays || 7) * 24 * 60 * 60 * 1000,
    path: REFRESH_PATH,
  };
}

// In-memory rate limiter for sensitive routes (15 min window, max 10 attempts)
const sensitiveAttempts = new Map();

function sensitiveRateLimit(req, res, next) {
  const key = req.ip || 'local';
  const now = Date.now();
  const current = sensitiveAttempts.get(key) || { count: 0, start: now };
  if (now - current.start > 15 * 60 * 1000) {
    current.count = 0;
    current.start = now;
  }
  current.count += 1;
  sensitiveAttempts.set(key, current);
  if (current.count > 10) {
    return next(new ApiError(429, 'Too many attempts. Try again later.', 'RATE_LIMITED'));
  }
  return next();
}

async function login(req, res) {
  const data = await authService.login(req.body, req.ip);
  res.cookie(REFRESH_COOKIE, data.refreshToken, cookieOptions());
  return send(res, { accessToken: data.accessToken, user: data.user }, 'Signed in.');
}

async function refresh(req, res) {
  const rawToken = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
  const data = await authService.refresh(rawToken, req.ip);
  res.cookie(REFRESH_COOKIE, data.refreshToken, cookieOptions());
  return send(res, { accessToken: data.accessToken }, 'Token refreshed.');
}

async function logout(req, res) {
  const rawToken = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
  await authService.logout(rawToken);
  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH });
  return send(res, null, 'Signed out.');
}

async function forgotPassword(req, res) {
  const result = await authService.forgotPassword(req.body?.email);
  return send(res, null, result.message);
}

async function resetPassword(req, res) {
  const result = await authService.resetPassword(req.body?.token, req.body?.newPassword);
  return send(res, null, result.message);
}

async function changePassword(req, res) {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required.', 'UNAUTHENTICATED');
  }
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || !currentPassword) {
    throw new ApiError(400, 'currentPassword is required.', 'VALIDATION_ERROR');
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    throw new ApiError(400, 'newPassword must be at least 8 characters.', 'VALIDATION_ERROR');
  }

  const user = await DevUser.findById(req.user.userId);
  if (!user) {
    throw new ApiError(404, 'User not found.', 'NOT_FOUND');
  }

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    throw new ApiError(401, 'Current password is incorrect.', 'INVALID_CREDENTIALS');
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  // Revoke all active refresh tokens for this user
  await RefreshToken.updateMany(
    { userId: String(user._id), revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );

  return send(res, null, 'Password changed successfully.');
}

module.exports = { login, refresh, logout, forgotPassword, resetPassword, changePassword, sensitiveRateLimit };
