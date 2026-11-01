'use strict';

const userService = require('./user.service');
const { send } = require('../../utils/respond');

async function listUsers(req, res) {
  const users = await userService.listUsers();
  return send(res, users);
}

async function getUser(req, res) {
  const user = await userService.getUser(req.params.id);
  return send(res, user);
}

async function createUser(req, res) {
  const user = await userService.createUser(req.body, req.user);
  return send(res, user, 'User created.', 201);
}

async function updateUser(req, res) {
  const user = await userService.updateUser(req.params.id, req.body, req.user);
  return send(res, user, 'User updated.');
}

async function deleteUser(req, res) {
  const result = await userService.deleteUser(req.params.id, req.user);
  return send(res, null, result.message);
}

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser };
