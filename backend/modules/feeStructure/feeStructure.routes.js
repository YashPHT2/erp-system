const express = require('express');
const controller = require('./feeStructure.controller');
const { asyncHandler } = require('../../middleware/asyncHandler');
const { requirePermission } = require('../../middleware/requirePermission');

const router = express.Router();

router.get('/', requirePermission('feeStructure.read'), asyncHandler(controller.list));
router.post('/', requirePermission('feeStructure.write'), asyncHandler(controller.create));
router.get('/:id', requirePermission('feeStructure.read'), asyncHandler(controller.getOne));
router.put('/:id', requirePermission('feeStructure.write'), asyncHandler(controller.update));

module.exports = router;
