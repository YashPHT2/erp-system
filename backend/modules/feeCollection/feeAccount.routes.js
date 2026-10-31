const express = require('express');
const controller = require('../feeCollection/feeCollection.controller');
const { asyncHandler } = require('../../middleware/asyncHandler');
const { requirePermission } = require('../../middleware/requirePermission');

const router = express.Router();

router.get('/', requirePermission('fees.read'), asyncHandler(controller.getAccount));

module.exports = router;
