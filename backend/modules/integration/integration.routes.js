const express = require('express');
const controller = require('./integration.controller');
const { asyncHandler } = require('../../middleware/asyncHandler');
const { requirePermission } = require('../../middleware/requirePermission');

const router = express.Router();

router.get('/students', requirePermission('fees.read'), asyncHandler(controller.students));
router.get('/classes', requirePermission('fees.read'), asyncHandler(controller.classes));
router.get('/employees', requirePermission('payroll.read'), asyncHandler(controller.employees));

module.exports = router;
