const express = require('express');
const controller = require('./feeCollection.controller');
const { asyncHandler } = require('../../middleware/asyncHandler');
const { requirePermission } = require('../../middleware/requirePermission');

const router = express.Router();

router.get('/', requirePermission('fees.read'), asyncHandler(controller.list));
router.post('/', requirePermission('fees.collect'), asyncHandler(controller.create));
router.get('/:id', requirePermission('fees.read'), asyncHandler(controller.getOne));

module.exports = router;
