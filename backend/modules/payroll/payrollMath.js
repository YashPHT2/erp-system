const ApiError = require('../../utils/ApiError');
const { sumPaise, fromPaise } = require('../../utils/money');
const { periodLabel } = require('../../utils/dates');

function calculateNetSalary({ basicPaise, allowances, deductions }) {
  const totalAllowancesPaise = sumPaise(allowances.map((item) => item.amountPaise));
  const totalDeductionsPaise = sumPaise(deductions.map((item) => item.amountPaise));
  const netSalaryPaise = basicPaise + totalAllowancesPaise - totalDeductionsPaise;
  if (netSalaryPaise < 0) {
    throw new ApiError(400, 'Deductions cannot exceed basic salary plus allowances.', 'NEGATIVE_NET_SALARY');
  }
  return { totalAllowancesPaise, totalDeductionsPaise, netSalaryPaise };
}

function mapLine(item) {
  return {
    code: item.code,
    label: item.label,
    amount: fromPaise(item.amountPaise),
  };
}

function buildSalarySlip(payroll, institutionName) {
  return {
    institutionName,
    employeeId: payroll.employeeId,
    employeeCode: payroll.employeeCode,
    employeeName: payroll.employeeName,
    designation: payroll.designation,
    department: payroll.department,
    month: payroll.month,
    year: payroll.year,
    periodLabel: periodLabel(payroll.month, payroll.year),
    basicSalary: fromPaise(payroll.basicSalaryPaise),
    allowances: (payroll.allowances || []).map(mapLine),
    deductions: (payroll.deductions || []).map(mapLine),
    totalAllowances: fromPaise(payroll.totalAllowancesPaise),
    totalDeductions: fromPaise(payroll.totalDeductionsPaise),
    netSalary: fromPaise(payroll.netSalaryPaise),
    status: payroll.status,
    processedAt: payroll.processedAt,
    paidAt: payroll.paidAt || null,
  };
}

module.exports = { calculateNetSalary, buildSalarySlip };
