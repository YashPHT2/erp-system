'use strict';

const express = require('express');
const controller = require('./auth.controller');
const { asyncHandler } = require('../../middleware/asyncHandler');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();

router.post('/login', asyncHandler(controller.login));
router.post('/refresh', asyncHandler(controller.refresh));
router.post('/logout', asyncHandler(controller.logout));
router.post('/forgot-password', controller.sensitiveRateLimit, asyncHandler(controller.forgotPassword));
router.post('/reset-password', controller.sensitiveRateLimit, asyncHandler(controller.resetPassword));
router.post('/change-password', requireAuth, asyncHandler(controller.changePassword));

module.exports = router;
