const receiptService = require('./receipt.service');
const { send } = require('../../utils/respond');

async function list(req, res) {
  const data = await receiptService.listReceipts(req.query);
  return send(res, data);
}

async function getOne(req, res) {
  const data = await receiptService.getReceipt(req.params.id);
  return send(res, data);
}

async function cancel(req, res) {
  const data = await receiptService.cancelReceipt(req.params.id, req.body, req.user);
  return send(res, data, 'Receipt cancelled.');
}

module.exports = { list, getOne, cancel };
