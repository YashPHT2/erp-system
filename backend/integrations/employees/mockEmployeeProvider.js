const { EMPLOYEES } = require('../mockData/directory');

function matches(employee, search) {
  if (!search) return true;
  const haystack = `${employee.name} ${employee.employeeCode} ${employee.department}`.toLowerCase();
  return haystack.includes(search.trim().toLowerCase());
}

async function searchEmployees(search) {
  const query = typeof search === 'string' ? search.trim() : '';
  if (query.length < 2) return [];
  return EMPLOYEES.filter((employee) => matches(employee, query)).slice(0, 20);
}

async function listEmployees(filters = {}) {
  return EMPLOYEES.filter((employee) => matches(employee, filters.search));
}

async function getEmployeeById(employeeId) {
  const key = String(employeeId || '').trim().toLowerCase();
  return EMPLOYEES.find((employee) => employee.id.toLowerCase() === key || employee.employeeCode.toLowerCase() === key) || null;
}

module.exports = { searchEmployees, listEmployees, getEmployeeById };
