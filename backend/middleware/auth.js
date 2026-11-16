const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const config = require('../config/env');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { permissionsForRole } = require('../utils/permissions');
const { runWithRequest } = require('../utils/requestContext');
const { ROLE_LABELS } = require('../constants');
function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], issuer: 'edufinance', audience: 'edufinance-web' });
}
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) throw new ApiError(401, 'Authentication required.', 'UNAUTHENTICATED');
    let payload;
    try { payload = verifyToken(header.slice(7).trim()); }
    catch (_) { throw new ApiError(401, 'Invalid or expired token.', 'INVALID_TOKEN'); }
    if (!mongoose.isObjectIdOrHexString(payload.sub) || !mongoose.isObjectIdOrHexString(payload.sid)) throw new ApiError(401, 'Invalid token.', 'INVALID_TOKEN');
    const [user, session] = await Promise.all([
      User.findById(payload.sub),
      RefreshToken.findOne({ _id: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { $gt: new Date() } }),
    ]);
    if (!user || !user.active || !session || payload.ver !== user.tokenVersion || session.userVersion !== user.tokenVersion) throw new ApiError(401, 'Your session has ended. Please sign in again.', 'INVALID_TOKEN');
    req.user = { userId: String(user._id), name: user.name, email: user.email, role: user.role,
      roleLabel: ROLE_LABELS[user.role], permissions: permissionsForRole(user.role) };
    req.sessionId = String(session._id);
    return runWithRequest({ user: req.user, authorization: header }, () => next());
  } catch (error) { return next(error); }
}
module.exports = { requireAuth, verifyToken };
