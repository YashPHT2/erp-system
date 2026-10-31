const express = require('express');
const controller = require('./devAuth.controller');
const { asyncHandler } = require('../../middleware/asyncHandler');

const router = express.Router();

router.post('/login', controller.rateLimit, asyncHandler(controller.login));

module.exports = router;
