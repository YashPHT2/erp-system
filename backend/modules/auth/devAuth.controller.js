const devAuthService = require('./devAuth.service');
const { send } = require('../../utils/respond');

const attempts = new Map();

function rateLimit(req, res, next) {
  const key = req.ip || 'local';
  const now = Date.now();
  const current = attempts.get(key) || { count: 0, start: now };
  if (now - current.start > 15 * 60 * 1000) {
    current.count = 0;
    current.start = now;
  }
  current.count += 1;
  attempts.set(key, current);
  if (current.count > 30) {
    const ApiError = require('../../utils/ApiError');
    return next(new ApiError(429, 'Too many login attempts. Try again later.', 'RATE_LIMITED'));
  }
  return next();
}

async function login(req, res) {
  const data = await devAuthService.login(req.body);
  return send(res, data, 'Signed in.');
}

module.exports = { login, rateLimit };
