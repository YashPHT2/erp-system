const feeStructureService = require('./feeStructure.service');
const { send } = require('../../utils/respond');

async function list(req, res) {
  const data = await feeStructureService.listFeeStructures(req.query);
  return send(res, data);
}

async function getOne(req, res) {
  const data = await feeStructureService.getFeeStructure(req.params.id);
  return send(res, data);
}

async function create(req, res) {
  const data = await feeStructureService.createFeeStructure(req.body, req.user);
  return send(res, data, 'Fee structure saved.', 201);
}

async function update(req, res) {
  const data = await feeStructureService.updateFeeStructure(req.params.id, req.body, req.user);
  return send(res, data, 'Fee structure updated.');
}

module.exports = { list, getOne, create, update };
