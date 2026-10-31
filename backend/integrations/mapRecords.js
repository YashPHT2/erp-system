const ApiError = require('../utils/ApiError');

const REQUIRED_STUDENT_FIELDS = ['admissionNumber', 'name', 'className', 'academicYear'];

function mapStudent(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new ApiError(502, 'Student record is missing.', 'STUDENT_CONTRACT');
  }
  if ((typeof raw.id !== 'string' && typeof raw.id !== 'number') || String(raw.id).trim() === '') {
    throw new ApiError(502, 'Student record is missing id.', 'STUDENT_CONTRACT');
  }
  for (const field of REQUIRED_STUDENT_FIELDS) {
    if (typeof raw[field] !== 'string' || !raw[field].trim()) {
      throw new ApiError(502, `Student record is missing ${field}.`, 'STUDENT_CONTRACT');
    }
  }
  return {
    id: String(raw.id).trim(),
    admissionNumber: raw.admissionNumber.trim(),
    name: raw.name.trim(),
    className: raw.className.trim(),
    section: typeof raw.section === 'string' ? raw.section.trim() : '',
    academicYear: raw.academicYear.trim(),
  };
}

function mapEmployee(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new ApiError(502, 'Employee record is missing.', 'EMPLOYEE_CONTRACT');
  }
  if ((typeof raw.id !== 'string' && typeof raw.id !== 'number') || String(raw.id).trim() === '') {
    throw new ApiError(502, 'Employee record is missing id.', 'EMPLOYEE_CONTRACT');
  }
  for (const field of ['employeeCode', 'name', 'designation', 'department']) {
    if (typeof raw[field] !== 'string' || !raw[field].trim()) {
      throw new ApiError(502, `Employee record is missing ${field}.`, 'EMPLOYEE_CONTRACT');
    }
  }
  return {
    id: String(raw.id).trim(),
    employeeCode: raw.employeeCode.trim(),
    name: raw.name.trim(),
    designation: raw.designation.trim(),
    department: raw.department.trim(),
    status: typeof raw.status === 'string' && raw.status.trim() ? raw.status.trim().toLowerCase() : 'active',
  };
}

module.exports = { mapStudent, mapEmployee };
