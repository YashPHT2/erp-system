'use strict';

const express = require('express');
const controller = require('./user.controller');
const { asyncHandler } = require('../../middleware/asyncHandler');
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/requirePermission');

const router = express.Router();

router.use(requireAuth);
router.use(requirePermission('users.manage'));

router.get('/', asyncHandler(controller.listUsers));
router.get('/:id', asyncHandler(controller.getUser));
router.post('/', asyncHandler(controller.createUser));
router.patch('/:id', asyncHandler(controller.updateUser));
router.delete('/:id', asyncHandler(controller.deleteUser));

module.exports = router;
