'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { DevUser } = require('../../models/System');
const RefreshToken = require('../../models/RefreshToken');
const PasswordResetToken = require('../../models/PasswordResetToken');
const ApiError = require('../../utils/ApiError');
const config = require('../../config/env');
const { ROLE_LABELS } = require('../../constants');
const { permissionsForRole } = require('../../utils/permissions');
const emailService = require('./email.service');

const DUMMY_HASH = bcrypt.hashSync('prod-auth-dummy-password', 10);

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), name: user.name, email: user.email, role: user.role },
    config.jwtSecret,
    { algorithm: 'HS256', expiresIn: config.accessTokenExpiry || '15m' },
  );
}

function buildUserPayload(user) {
  return {
    userId: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabel: ROLE_LABELS[user.role],
    permissions: permissionsForRole(user.role),
  };
}

async function login(body, ip) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const user = email ? await DevUser.findOne({ email }) : null;
  const matches = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !matches) {
    throw new ApiError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
  }

  const accessToken = signAccessToken(user);

  const rawRefreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + (config.refreshTokenExpiryDays || 7) * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    token: tokenHash,
    userId: String(user._id),
    userEmail: user.email,
    expiresAt,
    createdByIp: ip || '',
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: buildUserPayload(user),
  };
}

async function refresh(rawRefreshToken, ip) {
  if (!rawRefreshToken) {
    throw new ApiError(401, 'Refresh token required.', 'INVALID_TOKEN');
  }

  const tokenHash = hashToken(rawRefreshToken);
  const stored = await RefreshToken.findOne({ token: tokenHash });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new ApiError(401, 'Invalid or expired refresh token.', 'INVALID_TOKEN');
  }

  const user = await DevUser.findById(stored.userId);
  if (!user) {
    throw new ApiError(401, 'User not found.', 'INVALID_TOKEN');
  }

  // Rotate: generate new refresh token
  const newRaw = crypto.randomBytes(40).toString('hex');
  const newTokenHash = hashToken(newRaw);
  const expiresAt = new Date(Date.now() + (config.refreshTokenExpiryDays || 7) * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    token: newTokenHash,
    userId: String(user._id),
    userEmail: user.email,
    expiresAt,
    createdByIp: ip || '',
  });

  // Revoke old token
  stored.revokedAt = new Date();
  stored.replacedByToken = newTokenHash;
  await stored.save();

  const accessToken = signAccessToken(user);

  return { accessToken, refreshToken: newRaw };
}

async function logout(rawRefreshToken) {
  if (!rawRefreshToken) return;
  const tokenHash = hashToken(rawRefreshToken);
  const stored = await RefreshToken.findOne({ token: tokenHash });
  if (!stored) return; // idempotent
  if (!stored.revokedAt) {
    stored.revokedAt = new Date();
    await stored.save();
  }
}

async function forgotPassword(email) {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const user = normalizedEmail ? await DevUser.findOne({ email: normalizedEmail }) : null;

  const successMessage = { message: 'If that email is registered, a reset link has been sent.' };

  if (!user) {
    // Do not reveal whether user exists
    return successMessage;
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await PasswordResetToken.create({
    userId: String(user._id),
    tokenHash,
    expiresAt,
  });

  await emailService.sendPasswordReset(user.email, user.name, rawToken);

  return successMessage;
}

async function resetPassword(rawToken, newPassword) {
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters.', 'VALIDATION_ERROR');
  }

  const tokenHash = hashToken(rawToken);
  const resetToken = await PasswordResetToken.findOne({ tokenHash });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    throw new ApiError(400, 'Invalid or expired reset token.', 'INVALID_TOKEN');
  }

  const user = await DevUser.findById(resetToken.userId);
  if (!user) {
    throw new ApiError(400, 'Invalid or expired reset token.', 'INVALID_TOKEN');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  user.passwordHash = passwordHash;
  await user.save();

  resetToken.usedAt = new Date();
  await resetToken.save();

  // Revoke all active refresh tokens for this user
  await RefreshToken.updateMany(
    { userId: String(user._id), revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );

  return { message: 'Password updated successfully.' };
}

module.exports = { login, refresh, logout, forgotPassword, resetPassword };
