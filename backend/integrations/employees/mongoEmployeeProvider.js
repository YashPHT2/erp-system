const mongoose = require('mongoose');
const Employee = require('../../models/Employee');
const { escapeRegex } = require('../../utils/validate');
const present = doc => ({ id: String(doc._id), employeeCode: doc.employeeCode, name: doc.name,
  designation: doc.designation, department: doc.department, status: doc.status });
async function listEmployees(filters = {}) {
  const query = {};
  if (filters.search) { const re = new RegExp(escapeRegex(filters.search), 'i'); query.$or = [{ name: re }, { employeeCode: re }, { department: re }]; }
  return (await Employee.find(query).sort({ name: 1 }).lean()).map(present);
}
async function searchEmployees(search) {
  const q = typeof search === 'string' ? search.trim() : '';
  return q.length < 2 ? [] : (await listEmployees({ search: q })).slice(0, 20);
}
async function getEmployeeById(value) {
  const choices = [{ employeeCode: String(value || '').trim().toUpperCase() }];
  if (mongoose.isObjectIdOrHexString(value)) choices.push({ _id: value });
  const doc = await Employee.findOne({ $or: choices }).lean();
  return doc ? present(doc) : null;
}
module.exports = { listEmployees, searchEmployees, getEmployeeById };
