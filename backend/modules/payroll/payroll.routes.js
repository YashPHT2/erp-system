const express = require('express');
const controller = require('./payroll.controller');
const { asyncHandler } = require('../../middleware/asyncHandler');
const { requirePermission } = require('../../middleware/requirePermission');

const profileRouter = express.Router();
profileRouter.get('/', requirePermission('payroll.read'), asyncHandler(controller.listProfiles));
profileRouter.put('/:employeeId', requirePermission('payroll.write'), asyncHandler(controller.saveProfile));

const payrollRouter = express.Router();
payrollRouter.post('/preview', requirePermission('payroll.write'), asyncHandler(controller.preview));
payrollRouter.post('/', requirePermission('payroll.write'), asyncHandler(controller.processPayroll));
payrollRouter.get('/', requirePermission('payroll.read'), asyncHandler(controller.list));
payrollRouter.get('/:id/slip', requirePermission('payroll.read'), asyncHandler(controller.slip));
payrollRouter.get('/:id', requirePermission('payroll.read'), asyncHandler(controller.getOne));
payrollRouter.patch('/:id/payment', requirePermission('payroll.write'), asyncHandler(controller.markPaid));

module.exports = { profileRouter, payrollRouter };
