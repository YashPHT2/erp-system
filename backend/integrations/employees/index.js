const config = require('../../config/env');
const mongoProvider = require('./mongoEmployeeProvider');
const httpProvider = require('./httpEmployeeProvider');

function provider() {
  return config.employeeProvider === 'http' ? httpProvider : mongoProvider;
}

module.exports = {
  searchEmployees: (...args) => provider().searchEmployees(...args),
  listEmployees: (...args) => provider().listEmployees(...args),
  getEmployeeById: (...args) => provider().getEmployeeById(...args),
};
