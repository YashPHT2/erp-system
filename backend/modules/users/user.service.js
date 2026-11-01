'use strict';

const bcrypt = require('bcryptjs');
const { DevUser } = require('../../models/System');
const RefreshToken = require('../../models/RefreshToken');
const ApiError = require('../../utils/ApiError');
const { ROLES } = require('../../constants');

function omitPasswordHash(user) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.passwordHash;
  return obj;
}

async function listUsers() {
  const users = await DevUser.find({}).select('-passwordHash').lean();
  return users;
}

async function getUser(id) {
  const user = await DevUser.findById(id).select('-passwordHash').lean();
  if (!user) {
    throw new ApiError(404, 'User not found.', 'NOT_FOUND');
  }
  return user;
}

async function createUser(body) {
  const { email, name, role, password } = body || {};

  if (typeof email !== 'string' || !email.trim()) {
    throw new ApiError(400, 'email is required.', 'VALIDATION_ERROR');
  }
  if (typeof name !== 'string' || !name.trim()) {
    throw new ApiError(400, 'name is required.', 'VALIDATION_ERROR');
  }
  if (!ROLES.includes(role)) {
    throw new ApiError(400, `role must be one of: ${ROLES.join(', ')}.`, 'VALIDATION_ERROR');
  }
  if (typeof password !== 'string' || password.length < 8) {
    throw new ApiError(400, 'password must be at least 8 characters.', 'VALIDATION_ERROR');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await DevUser.findOne({ email: normalizedEmail });
  if (existing) {
    throw new ApiError(409, 'A user with that email already exists.', 'CONFLICT');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await DevUser.create({
    email: normalizedEmail,
    name: name.trim(),
    role,
    passwordHash,
  });

  return omitPasswordHash(user);
}

async function updateUser(id, body) {
  const user = await DevUser.findById(id);
  if (!user) {
    throw new ApiError(404, 'User not found.', 'NOT_FOUND');
  }

  const { name, role, email } = body || {};

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new ApiError(400, 'name must be a non-empty string.', 'VALIDATION_ERROR');
    }
    user.name = name.trim();
  }

  if (role !== undefined) {
    if (!ROLES.includes(role)) {
      throw new ApiError(400, `role must be one of: ${ROLES.join(', ')}.`, 'VALIDATION_ERROR');
    }
    user.role = role;
  }

  if (email !== undefined) {
    if (typeof email !== 'string' || !email.trim()) {
      throw new ApiError(400, 'email must be a non-empty string.', 'VALIDATION_ERROR');
    }
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await DevUser.findOne({ email: normalizedEmail, _id: { $ne: id } });
    if (existing) {
      throw new ApiError(409, 'A user with that email already exists.', 'CONFLICT');
    }
    user.email = normalizedEmail;
  }

  await user.save();
  return omitPasswordHash(user);
}

async function deleteUser(id, actor) {
  if (actor && actor.userId === String(id)) {
    throw new ApiError(400, 'You cannot delete your own account.', 'SELF_DELETE');
  }

  const user = await DevUser.findById(id);
  if (!user) {
    throw new ApiError(404, 'User not found.', 'NOT_FOUND');
  }

  // Revoke all active refresh tokens for the deleted user
  await RefreshToken.updateMany(
    { userId: String(user._id), revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );

  await user.deleteOne();
  return { message: 'User deleted successfully.' };
}

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser };
