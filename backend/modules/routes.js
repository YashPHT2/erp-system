const express = require('express');
const mongoose = require('mongoose');
const config = require('../config/env');
const { send } = require('../utils/respond');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/requirePermission');
const { getMeta, getSettings } = require('./auth/meta.service');
const devAuthRoutes = require('./auth/devAuth.routes');
const authRoutes = require('./auth/auth.routes');
const userRoutes = require('./users/user.routes');
const feeStructureRoutes = require('./feeStructure/feeStructure.routes');
const feePaymentRoutes = require('./feeCollection/feeCollection.routes');
const feeAccountRoutes = require('./feeCollection/feeAccount.routes');
const receiptRoutes = require('./receipts/receipt.routes');
const reportRoutes = require('./feeReports/feeReport.routes');
const { notifications } = require('./feeReports/feeReport.controller');
const integrationRoutes = require('./integration/integration.routes');
const { profileRouter, payrollRouter } = require('./payroll/payroll.routes');

function health(req, res) {
  const up = mongoose.connection.readyState === 1;
  res.status(up ? 200 : 503).json({
    success: up,
    data: { service: 'edufinance', database: up ? 'up' : 'down' },
  });
}

function me(req, res) {
  return send(res, req.user);
}

function buildRouter() {
  const router = express.Router();
  router.get('/health', health);
  router.get('/meta', asyncHandler(async (req, res) => send(res, await getMeta())));

  router.use('/auth', authRoutes);

  if (config.authMode === 'mock') {
    router.use('/dev-auth', devAuthRoutes);
  } else {
    router.use('/dev-auth', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'The requested resource was not found.',
        code: 'NOT_FOUND',
      });
    });
  }

  router.use(requireAuth);
  router.get('/auth/me', me);
  router.get('/settings', requirePermission('settings.read'), asyncHandler(async (req, res) => {
    send(res, await getSettings());
  }));
  router.get('/notifications', requirePermission('reports.read'), asyncHandler(notifications));
  router.use('/fee-structures', feeStructureRoutes);
  router.use('/fee-payments', feePaymentRoutes);
  router.use('/fee-accounts', feeAccountRoutes);
  router.use('/receipts', receiptRoutes);
  router.use('/reports', reportRoutes);
  router.use('/integration', integrationRoutes);
  router.use('/salary-profiles', profileRouter);
  router.use('/payroll', payrollRouter);
  router.use('/users', userRoutes);
  return router;
}

module.exports = { buildRouter };
