const config = require('../../config/env');
const mockProvider = require('./mockStudentProvider');
const httpProvider = require('./httpStudentProvider');

function provider() {
  return config.studentProvider === 'http' ? httpProvider : mockProvider;
}

module.exports = {
  searchStudents: (...args) => provider().searchStudents(...args),
  getStudentByAdmissionNumber: (...args) => provider().getStudentByAdmissionNumber(...args),
  listStudents: (...args) => provider().listStudents(...args),
  listClasses: (...args) => provider().listClasses(...args),
};
