const express = require('express');
const controller = require('./receipt.controller');
const { asyncHandler } = require('../../middleware/asyncHandler');
const { requirePermission } = require('../../middleware/requirePermission');

const router = express.Router();

router.get('/', requirePermission('fees.read'), asyncHandler(controller.list));
router.get('/:id', requirePermission('fees.read'), asyncHandler(controller.getOne));
router.post('/:id/cancel', requirePermission('receipts.cancel'), asyncHandler(controller.cancel));

module.exports = router;
