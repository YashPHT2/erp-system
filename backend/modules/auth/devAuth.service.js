const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { DevUser } = require('../../models/System');
const ApiError = require('../../utils/ApiError');
const config = require('../../config/env');
const { ROLE_LABELS } = require('../../constants');
const { permissionsForRole } = require('../../utils/permissions');

const DUMMY_HASH = bcrypt.hashSync('dev-auth-dummy-password', 10);

async function login(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const user = email ? await DevUser.findOne({ email }) : null;
  const matches = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !matches) {
    throw new ApiError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
  }

  const token = jwt.sign(
    { sub: String(user._id), name: user.name, email: user.email, role: user.role },
    config.jwtSecret,
    { algorithm: 'HS256', expiresIn: '12h' },
  );

  return {
    token,
    user: {
      userId: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role],
      permissions: permissionsForRole(user.role),
    },
  };
}

module.exports = { login };
