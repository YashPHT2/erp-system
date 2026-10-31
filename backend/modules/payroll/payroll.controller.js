const payrollService = require('./payroll.service');
const { send } = require('../../utils/respond');

async function listProfiles(req, res) {
  return send(res, await payrollService.listSalaryProfiles(req.query));
}

async function saveProfile(req, res) {
  const data = await payrollService.saveSalaryProfile(req.params.employeeId, req.body, req.user);
  return send(res, data, 'Salary profile saved.');
}

async function preview(req, res) {
  return send(res, await payrollService.previewPayroll(req.body));
}

async function processPayroll(req, res) {
  const data = await payrollService.processPayroll(req.body, req.user);
  return send(res, data, 'Payroll processed.', 201);
}

async function list(req, res) {
  return send(res, await payrollService.listPayroll(req.query));
}

async function getOne(req, res) {
  return send(res, await payrollService.getPayroll(req.params.id));
}

async function slip(req, res) {
  return send(res, await payrollService.getSalarySlip(req.params.id));
}

async function markPaid(req, res) {
  if (req.body?.status !== 'paid') {
    const ApiError = require('../../utils/ApiError');
    throw new ApiError(400, 'Only a paid status can be recorded.', 'VALIDATION_ERROR');
  }
  const data = await payrollService.markPayrollPaid(req.params.id, req.user);
  return send(res, data, 'Payroll marked as paid.');
}

module.exports = {
  listProfiles,
  saveProfile,
  preview,
  processPayroll,
  list,
  getOne,
  slip,
  markPaid,
};
