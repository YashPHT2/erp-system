const express = require('express');
const Student = require('../../models/Student');
const Employee = require('../../models/Employee');
const FeeAccount = require('../../models/FeeAccount');
const config = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { asyncHandler } = require('../../middleware/asyncHandler');
const { requirePermission } = require('../../middleware/requirePermission');
const { requiredText, optionalText, assertAcademicYear, assertObjectId } = require('../../utils/validate');
const { send } = require('../../utils/respond');
const students = require('../../integrations/students');
const employees = require('../../integrations/employees');
const router = express.Router();
function local(kind) {
  if (config[`${kind}Provider`] !== 'mongo') throw new ApiError(409, 'These records are managed by the connected directory.', 'EXTERNAL_DIRECTORY');
}
function studentBody(body) {
  return { admissionNumber: requiredText(body?.admissionNumber, 'Admission number').toUpperCase(),
    name: requiredText(body?.name, 'Name', { max: 100 }), className: requiredText(body?.className, 'Class'),
    section: optionalText(body?.section, 'Section', { max: 20 }).toUpperCase(), academicYear: assertAcademicYear(body?.academicYear) };
}
function employeeBody(body) {
  const status = body?.status || 'active';
  if (!['active', 'inactive'].includes(status)) throw new ApiError(400, 'Choose a valid employee status.', 'VALIDATION_ERROR');
  return { employeeCode: requiredText(body?.employeeCode, 'Employee code').toUpperCase(),
    name: requiredText(body?.name, 'Name', { max: 100 }), designation: requiredText(body?.designation, 'Designation'),
    department: requiredText(body?.department, 'Department'), status };
}
router.get('/students', requirePermission('directory.students'), asyncHandler(async (req,res) => send(res, await students.listStudents({ search: typeof req.query.search === 'string' ? req.query.search.slice(0,100) : '' }))));
router.post('/students', requirePermission('directory.students'), asyncHandler(async (req,res) => {
  local('student'); const doc = await Student.create(studentBody(req.body));
  return send(res, await students.getStudentByAdmissionNumber(doc.admissionNumber), 'Student created.', 201);
}));
router.put('/students/:id', requirePermission('directory.students'), asyncHandler(async (req,res) => {
  local('student'); const id = assertObjectId(req.params.id); const body = studentBody(req.body);
  const doc = await Student.findById(id);
  if (!doc) throw new ApiError(404, 'Student not found.', 'NOT_FOUND');
  // Student identity and enrollment are immutable once a ledger exists; receipts keep their snapshots.
  if (await FeeAccount.exists({ studentId: id }) && ['admissionNumber','className','section','academicYear'].some(key => doc[key] !== body[key])) throw new ApiError(409, 'Enrollment cannot change after a fee account exists. Contact the finance administrator.', 'STUDENT_HAS_LEDGER');
  Object.assign(doc, body); await doc.save();
  return send(res, await students.getStudentByAdmissionNumber(doc.admissionNumber), 'Student updated.');
}));
router.get('/employees', requirePermission('directory.employees'), asyncHandler(async (req,res) => send(res, await employees.listEmployees({ search: typeof req.query.search === 'string' ? req.query.search.slice(0,100) : '' }))));
router.post('/employees', requirePermission('directory.employees'), asyncHandler(async (req,res) => {
  local('employee'); const doc = await Employee.create(employeeBody(req.body));
  return send(res, await employees.getEmployeeById(String(doc._id)), 'Employee created.', 201);
}));
router.put('/employees/:id', requirePermission('directory.employees'), asyncHandler(async (req,res) => {
  local('employee'); const id = assertObjectId(req.params.id); const body = employeeBody(req.body);
  const doc = await Employee.findById(id);
  if (!doc) throw new ApiError(404, 'Employee not found.', 'NOT_FOUND');
  if (doc.employeeCode !== body.employeeCode) throw new ApiError(409, 'Employee code cannot be changed.', 'IMMUTABLE_CODE');
  Object.assign(doc, body); await doc.save();
  return send(res, await employees.getEmployeeById(id), 'Employee updated.');
}));
module.exports = router;
