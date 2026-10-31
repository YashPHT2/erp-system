const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const config = require('../config/env');
const { normalizeRole, isKnownRole, permissionsForRole } = require('../utils/permissions');
const { runWithRequest } = require('../utils/requestContext');
const { ROLE_LABELS } = require('../constants');

function readToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice(7).trim();
}

function verifyToken(token) {
  if (config.authMode === 'jwt' && config.jwtPublicKey) {
    return jwt.verify(token, config.jwtPublicKey, { algorithms: ['RS256'] });
  }
  return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
}

function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return next(new ApiError(401, 'Authentication required.', 'UNAUTHENTICATED'));

  let payload;
  try {
    payload = verifyToken(token);
  } catch (error) {
    return next(new ApiError(401, 'Invalid or expired token.', 'INVALID_TOKEN'));
  }

  const role = normalizeRole(payload.role);
  if (!isKnownRole(role)) {
    return next(new ApiError(403, 'The account role is not recognized by finance.', 'INVALID_ROLE'));
  }

  const userId = payload.sub || payload.userId;
  if (!userId) return next(new ApiError(401, 'Invalid token.', 'INVALID_TOKEN'));

  req.user = {
    userId: String(userId),
    name: typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : 'User',
    email: typeof payload.email === 'string' ? payload.email.trim() : '',
    role,
    roleLabel: ROLE_LABELS[role],
    permissions: permissionsForRole(role),
  };

  return runWithRequest({ user: req.user, authorization: req.headers.authorization }, () => next());
}

module.exports = { requireAuth, verifyToken };
