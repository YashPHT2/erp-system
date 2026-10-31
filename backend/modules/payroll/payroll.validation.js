const { ALLOWANCES, DEDUCTIONS } = require('../../constants');
const { parseRupees } = require('../../utils/money');
const { requiredText, validateComponents } = require('../../utils/validate');
const ApiError = require('../../utils/ApiError');

function optionalComponents(items, catalogue, fieldName) {
  if (items == null || (Array.isArray(items) && items.length === 0)) return [];
  return validateComponents(items, catalogue, fieldName);
}

function validateSalaryProfile(body) {
  return {
    basicSalaryPaise: parseRupees(body?.basicSalary, { fieldName: 'Basic salary' }),
    allowances: optionalComponents(body?.allowances, ALLOWANCES, 'allowance'),
    deductions: optionalComponents(body?.deductions, DEDUCTIONS, 'deduction'),
  };
}

function validatePayrollRequest(body) {
  const month = Number(body?.month);
  const year = Number(body?.year);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new ApiError(400, 'Choose a valid payroll month.', 'VALIDATION_ERROR');
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new ApiError(400, 'Choose a valid payroll year.', 'VALIDATION_ERROR');
  }
  return {
    employeeId: requiredText(body?.employeeId, 'Employee', { min: 1, max: 64 }),
    month,
    year,
  };
}

module.exports = { validateSalaryProfile, validatePayrollRequest };
