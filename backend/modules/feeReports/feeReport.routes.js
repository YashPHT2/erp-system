const express = require('express');
const controller = require('./feeReport.controller');
const { asyncHandler } = require('../../middleware/asyncHandler');
const { requirePermission } = require('../../middleware/requirePermission');

const router = express.Router();

router.use(requirePermission('reports.read'));
router.get('/dashboard', asyncHandler(controller.dashboard));
router.get('/daily', asyncHandler(controller.daily));
router.get('/monthly', asyncHandler(controller.monthly));
router.get('/class-wise', asyncHandler(controller.classWise));
router.get('/payment-modes', asyncHandler(controller.paymentModes));
router.get('/pending', asyncHandler(controller.pending));
router.get('/defaulters', asyncHandler(controller.defaulters));
router.get('/cancelled', asyncHandler(controller.cancelled));

module.exports = router;
