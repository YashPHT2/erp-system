const feeCollectionService = require('./feeCollection.service');
const { send } = require('../../utils/respond');
const { assertAcademicYear, queryString } = require('../../utils/validate');

async function create(req, res) {
  const result = await feeCollectionService.collectFee(req.body, req.user);
  const message = result.replayed ? 'This payment was already recorded.' : 'Payment recorded.';
  return send(res, result, message, result.replayed ? 200 : 201);
}

async function list(req, res) {
  const data = await feeCollectionService.listPayments(req.query);
  return send(res, data);
}

async function getOne(req, res) {
  const data = await feeCollectionService.getPayment(req.params.id);
  return send(res, data);
}

async function getAccount(req, res) {
  const academicYear = queryString(req.query, 'academicYear');
  const data = await feeCollectionService.getFeeAccountView(
    queryString(req.query, 'admissionNumber', 30),
    academicYear ? assertAcademicYear(academicYear) : '',
  );
  return send(res, data);
}

module.exports = { create, list, getOne, getAccount };
