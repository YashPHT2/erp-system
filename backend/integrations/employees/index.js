const config = require('../../config/env');
const mockProvider = require('./mockEmployeeProvider');
const httpProvider = require('./httpEmployeeProvider');

function provider() {
  return config.employeeProvider === 'http' ? httpProvider : mockProvider;
}

module.exports = {
  searchEmployees: (...args) => provider().searchEmployees(...args),
  listEmployees: (...args) => provider().listEmployees(...args),
  getEmployeeById: (...args) => provider().getEmployeeById(...args),
};
