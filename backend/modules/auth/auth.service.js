const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');
const LoginAttempt = require('../../models/LoginAttempt');
const PasswordResetToken = require('../../models/PasswordResetToken');
const { SystemMeta } = require('../../models/System');
const ApiError = require('../../utils/ApiError');
const config = require('../../config/env');
const { ROLE_LABELS } = require('../../constants');
const { permissionsForRole } = require('../../utils/permissions');
const { emailAddress, password } = require('../../utils/accountValidation');
const { requiredText } = require('../../utils/validate');
const { runInTransaction } = require('../../utils/transaction');
const emailService = require('./email.service');
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 12);
const hashToken = raw => crypto.createHash('sha256').update(raw).digest('hex');
function buildUserPayload(user) {
  return { userId: String(user._id), name: user.name, email: user.email, role: user.role,
    roleLabel: ROLE_LABELS[user.role], permissions: permissionsForRole(user.role) };
}
function signAccessToken(user, session) {
  return jwt.sign({ sub: String(user._id), sid: String(session._id), ver: user.tokenVersion }, config.jwtSecret,
    { algorithm: 'HS256', expiresIn: config.accessTokenExpiry, issuer: 'edufinance', audience: 'edufinance-web' });
}
async function login(body, ip) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const key = hashToken(`account:${email || `unknown:${ip || ''}`}`);
  const cooldown = 15 * 60 * 1000;
  const lockedError = until => new ApiError(429, 'Login is locked after 5 incorrect passwords. Try again after the 15-minute cooldown.', 'LOGIN_LOCKED', { retryAfterSeconds: Math.max(1, Math.ceil((new Date(until).getTime() - Date.now()) / 1000)), remainingAttempts: 0 });
  const previous = await LoginAttempt.findOne({ key });
  if (previous?.lockedUntil > new Date()) throw lockedError(previous.lockedUntil);
  const supplied = typeof body?.password === 'string' && Buffer.byteLength(body.password, 'utf8') <= 72 ? body.password : '';
  const user = email ? await User.findOne({ email }).select('+passwordHash') : null;
  const matches = await bcrypt.compare(supplied, user?.passwordHash || DUMMY_HASH);
  const initial = new Date();
  try { await LoginAttempt.updateOne({ key }, { $setOnInsert: { failures: 0, windowStart: initial, lockedUntil: null, expiresAt: new Date(initial.getTime()+cooldown) } }, { upsert: true }); }
  catch (error) { if (error.code !== 11000) throw error; }
  let result;
  // Serialize attempts for this account in MongoDB. Failed attempts must commit
  // before an error is returned, including when passwords are submitted concurrently.
  await runInTransaction(async dbSession => {
    const now = new Date();
    const attempt = await LoginAttempt.findOneAndUpdate({ key }, { $inc: { version: 1 }, $setOnInsert: { failures: 0, windowStart: now, lockedUntil: null, expiresAt: new Date(now.getTime()+cooldown) } }, { session: dbSession, new: true, upsert: true });
    if (attempt.lockedUntil > now) { result = { error: lockedError(attempt.lockedUntil) }; return; }
    if (now - attempt.windowStart >= cooldown) { attempt.failures = 0; attempt.windowStart = now; attempt.lockedUntil = null; }
    const current = user && matches ? await User.findOne({ _id: user._id, active: true, tokenVersion: user.tokenVersion }).select('+passwordHash').session(dbSession) : null;
    if (!current || current.passwordHash !== user.passwordHash) {
      attempt.failures = Math.min(5, attempt.failures + 1);
      if (attempt.failures >= 5) attempt.lockedUntil = new Date(now.getTime()+cooldown);
      attempt.expiresAt = new Date((attempt.lockedUntil?.getTime() || now.getTime()) + cooldown);
      await attempt.save({ session: dbSession });
      const remaining = 5 - attempt.failures;
      result = { error: remaining ? new ApiError(401, `Invalid email or password. ${remaining} attempt${remaining===1?'':'s'} remaining.`, 'INVALID_CREDENTIALS', { remainingAttempts: remaining }) : lockedError(attempt.lockedUntil) };
      return;
    }
    attempt.failures = 0; attempt.lockedUntil = null; attempt.windowStart = now; attempt.expiresAt = new Date(now.getTime()+cooldown);
    await attempt.save({ session: dbSession });
    const raw = crypto.randomBytes(40).toString('hex');
    const [session] = await RefreshToken.create([{ token: hashToken(raw), userId: current._id, userVersion: current.tokenVersion,
      expiresAt: new Date(now.getTime() + config.refreshTokenExpiryDays * 86400000), createdByIp: ip || '' }], { session: dbSession });
    result = { accessToken: signAccessToken(current, session), refreshToken: raw, user: buildUserPayload(current) };
  });
  if (result.error) throw result.error;
  return result;
}
async function refresh(raw) {
  if (typeof raw !== 'string' || !/^[a-f0-9]{80}$/.test(raw)) throw new ApiError(401, 'Invalid session.', 'INVALID_TOKEN');
  const old = await RefreshToken.findOne({ token: hashToken(raw), revokedAt: null, expiresAt: { $gt: new Date() } });
  const user = old ? await User.findById(old.userId) : null;
  if (!old || !user?.active || old.userVersion !== user.tokenVersion) throw new ApiError(401, 'Your session has ended.', 'INVALID_TOKEN');
  const nextRaw = crypto.randomBytes(40).toString('hex');
  // Compare-and-swap consumes the old token exactly once, including concurrent requests.
  const session = await RefreshToken.findOneAndUpdate({ _id: old._id, token: old.token, revokedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { token: hashToken(nextRaw) } }, { new: true });
  if (!session) throw new ApiError(401, 'This session token has already been used.', 'INVALID_TOKEN');
  return { accessToken: signAccessToken(user, session), refreshToken: nextRaw, user: buildUserPayload(user), expiresAt: session.expiresAt };
}
async function logout(raw) {
  if (typeof raw === 'string' && /^[a-f0-9]{80}$/.test(raw)) await RefreshToken.updateOne({ token: hashToken(raw), revokedAt: null }, { $set: { revokedAt: new Date() } });
}
async function setup(body) {
  const supplied = typeof body?.setupToken === 'string' ? body.setupToken : '';
  if (config.setupToken.length < 32 || !crypto.timingSafeEqual(Buffer.from(hashToken(supplied)), Buffer.from(hashToken(config.setupToken)))) throw new ApiError(403, 'Invalid setup key.', 'SETUP_FORBIDDEN');
  const email = emailAddress(body?.email);
  const name = requiredText(body?.name, 'Name', { max: 100 });
  const passwordHash = await bcrypt.hash(password(body?.password), 12);
  await runInTransaction(async session => {
    if (await User.countDocuments().session(session)) throw new ApiError(409, 'Initial setup is already complete.', 'SETUP_COMPLETE');
    await SystemMeta.create([{ key: 'initial-admin' }], { session });
    await User.create([{ email, name, passwordHash, role: 'SUPER_ADMIN' }], { session });
  });
  return { message: 'Administrator created. You can now sign in.' };
}
async function revokeSessions(userId, session) {
  await RefreshToken.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } }, { session });
}
async function changePassword(userId, body) {
  const user = await User.findById(userId).select('+passwordHash');
  if (typeof body?.currentPassword !== 'string' || !user || !await bcrypt.compare(body.currentPassword, user.passwordHash)) throw new ApiError(401, 'Current password is incorrect.', 'INVALID_CREDENTIALS');
  const newHash = await bcrypt.hash(password(body.newPassword), 12);
  await runInTransaction(async session => {
    const result = await User.updateOne({ _id: user._id, passwordHash: user.passwordHash }, { $set: { passwordHash: newHash }, $inc: { tokenVersion: 1 } }, { session });
    if (!result.modifiedCount) throw new ApiError(409, 'Your account changed. Please sign in again.', 'ACCOUNT_CHANGED');
    await revokeSessions(user._id, session);
  });
  return { message: 'Password changed. Please sign in again.' };
}
async function forgotPassword(value) {
  if (!emailService.isConfigured()) throw new ApiError(503, 'Password-reset email is not configured. Contact your administrator.', 'EMAIL_NOT_CONFIGURED');
  const email = emailAddress(value);
  const user = await User.findOne({ email, active: true });
  const message = 'If that email is registered, a reset link has been sent.';
  if (!user) return { message };
  const raw = crypto.randomBytes(32).toString('hex');
  const record = await PasswordResetToken.create({ userId: String(user._id), tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + 3600000), userVersion: user.tokenVersion });
  try { await emailService.sendPasswordReset(user.email, user.name, raw); }
  catch (error) { await record.deleteOne(); throw error; }
  return { message };
}
async function resetPassword(raw, value) {
  if (typeof raw !== 'string' || !/^[a-f0-9]{64}$/.test(raw)) throw new ApiError(400, 'Invalid or expired reset link.', 'INVALID_TOKEN');
  const passwordHash = await bcrypt.hash(password(value), 12);
  await runInTransaction(async session => {
    const token = await PasswordResetToken.findOneAndUpdate({ tokenHash: hashToken(raw), usedAt: null, expiresAt: { $gt: new Date() } }, { $set: { usedAt: new Date() } }, { new: true, session });
    if (!token) throw new ApiError(400, 'Invalid or expired reset link.', 'INVALID_TOKEN');
    const user = await User.findOneAndUpdate({ _id: token.userId, active: true, tokenVersion: token.userVersion }, { $set: { passwordHash }, $inc: { tokenVersion: 1 } }, { session, new: true });
    if (!user) throw new ApiError(400, 'Invalid or expired reset link.', 'INVALID_TOKEN');
    await revokeSessions(user._id, session);
    await PasswordResetToken.updateMany({ userId: String(user._id), usedAt: null }, { $set: { usedAt: new Date() } }, { session });
  });
  return { message: 'Password updated. Please sign in again.' };
}
module.exports = { login, refresh, logout, setup, forgotPassword, resetPassword, changePassword, buildUserPayload, revokeSessions };
