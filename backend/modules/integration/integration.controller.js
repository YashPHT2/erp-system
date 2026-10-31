const studentDirectory = require('../../integrations/students');
const employeeDirectory = require('../../integrations/employees');
const { presentStudent, presentEmployee } = require('../../utils/present');
const { queryString } = require('../../utils/validate');
const { send } = require('../../utils/respond');

async function students(req, res) {
  const items = await studentDirectory.searchStudents(queryString(req.query, 'q'));
  return send(res, items.map(presentStudent));
}

async function classes(req, res) {
  return send(res, await studentDirectory.listClasses());
}

async function employees(req, res) {
  const search = queryString(req.query, 'q') || queryString(req.query, 'search');
  const items = search
    ? await employeeDirectory.searchEmployees(search)
    : await employeeDirectory.listEmployees({});
  return send(res, items.map(presentEmployee));
}

module.exports = { students, classes, employees };
