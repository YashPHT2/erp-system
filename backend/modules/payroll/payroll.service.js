const { SalaryProfile, Payroll } = require('../../models/Payroll');
const ApiError = require('../../utils/ApiError');
const config = require('../../config/env');
const employeeDirectory = require('../../integrations/employees');
const { validateSalaryProfile, validatePayrollRequest } = require('./payroll.validation');
const { calculateNetSalary, buildSalarySlip } = require('./payrollMath');
const { getZonedParts, periodLabel } = require('../../utils/dates');
const {
  actorSnapshot,
  assertObjectId,
  queryString,
  pageParams,
  escapeRegex,
} = require('../../utils/validate');
const { presentSalaryProfile, presentPayroll, presentEmployee, paged } = require('../../utils/present');

const PAYROLL_SORTS = {
  newest: { year: -1, month: -1, employeeName: 1 },
  oldest: { year: 1, month: 1, employeeName: 1 },
  name: { employeeName: 1 },
  net: { netSalaryPaise: -1 },
};

function assertNotFuturePeriod(month, year, now) {
  const parts = getZonedParts(now, config.timezone);
  if (year * 12 + month > parts.year * 12 + parts.month) {
    throw new ApiError(400, 'Payroll cannot be processed for a future month.', 'FUTURE_PAYROLL');
  }
}

async function requireActiveEmployee(employeeId) {
  const employee = await employeeDirectory.getEmployeeById(employeeId);
  if (!employee) throw new ApiError(404, 'No employee was found for that id.', 'EMPLOYEE_NOT_FOUND');
  if (employee.status !== 'active') {
    throw new ApiError(409, 'This action is only available for active employees.', 'EMPLOYEE_INACTIVE');
  }
  return employee;
}

async function listSalaryProfiles(query) {
  const search = queryString(query, 'search');
  const employees = await employeeDirectory.listEmployees({ search });
  const profiles = await SalaryProfile.find({ employeeId: { $in: employees.map((employee) => employee.id) } });
  const byEmployee = new Map(profiles.map((profile) => [profile.employeeId, profile]));
  const items = employees.map((employee) => ({
    employee: presentEmployee(employee),
    profile: byEmployee.has(employee.id) ? presentSalaryProfile(byEmployee.get(employee.id)) : null,
  }));
  return { items };
}

async function saveSalaryProfile(employeeId, body, actor) {
  // Step 1: Confirm the employee exists in the shared directory.
  const employee = await requireActiveEmployee(employeeId);

  // Step 2: Validate salary components and reject a negative net salary.
  const value = validateSalaryProfile(body);
  const net = calculateNetSalary({
    basicPaise: value.basicSalaryPaise,
    allowances: value.allowances,
    deductions: value.deductions,
  });

  // Step 3: Store the current salary profile. Processed payroll keeps its own snapshot.
  const profile = await SalaryProfile.findOneAndUpdate(
    { employeeId: employee.id },
    {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      employeeName: employee.name,
      designation: employee.designation,
      department: employee.department,
      basicSalaryPaise: value.basicSalaryPaise,
      allowances: value.allowances,
      deductions: value.deductions,
      ...net,
      updatedBy: actorSnapshot(actor),
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return presentSalaryProfile(profile);
}

async function buildPayrollDraft(body, options = {}) {
  const request = validatePayrollRequest(body);
  const now = options.now instanceof Date ? options.now : new Date();
  assertNotFuturePeriod(request.month, request.year, now);

  const employee = await requireActiveEmployee(request.employeeId);
  const profile = await SalaryProfile.findOne({ employeeId: employee.id });
  if (!profile) {
    throw new ApiError(404, 'Set the employee salary before processing payroll.', 'SALARY_PROFILE_MISSING');
  }

  const existing = await Payroll.findOne({
    employeeId: employee.id,
    month: request.month,
    year: request.year,
  });
  if (existing) {
    throw new ApiError(409, 'Payroll for this employee and month already exists.', 'DUPLICATE_PAYROLL');
  }

  const net = calculateNetSalary({
    basicPaise: profile.basicSalaryPaise,
    allowances: profile.allowances,
    deductions: profile.deductions,
  });

  return {
    employee,
    profile,
    request,
    net,
    now,
  };
}

async function previewPayroll(body, options) {
  const draft = await buildPayrollDraft(body, options);
  return {
    employee: presentEmployee(draft.employee),
    month: draft.request.month,
    year: draft.request.year,
    periodLabel: periodLabel(draft.request.month, draft.request.year),
    basicSalary: presentSalaryProfile(draft.profile).basicSalary,
    allowances: presentSalaryProfile(draft.profile).allowances,
    deductions: presentSalaryProfile(draft.profile).deductions,
    totalAllowances: presentSalaryProfile(draft.profile).totalAllowances,
    totalDeductions: presentSalaryProfile(draft.profile).totalDeductions,
    netSalary: presentSalaryProfile(draft.profile).netSalary,
  };
}

async function processPayroll(body, actor, options = {}) {
  // Step 1: Validate the period, employee, and salary profile.
  const draft = await buildPayrollDraft(body, options);

  // Step 2: Save a snapshot so later salary edits do not rewrite history.
  try {
    const doc = await Payroll.create({
      employeeId: draft.employee.id,
      employeeCode: draft.employee.employeeCode,
      employeeName: draft.employee.name,
      designation: draft.employee.designation,
      department: draft.employee.department,
      month: draft.request.month,
      year: draft.request.year,
      basicSalaryPaise: draft.profile.basicSalaryPaise,
      allowances: draft.profile.allowances,
      deductions: draft.profile.deductions,
      ...draft.net,
      status: 'processed',
      processedAt: draft.now,
      processedBy: actorSnapshot(actor),
    });
    return presentPayroll(doc);
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'Payroll for this employee and month already exists.', 'DUPLICATE_PAYROLL');
    }
    throw error;
  }
}

function payrollFilter(query) {
  const filter = {};
  const search = queryString(query, 'search');
  const status = queryString(query, 'status');
  const month = queryString(query, 'month', 2);
  const year = queryString(query, 'year', 4);
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ employeeName: pattern }, { employeeCode: pattern }];
  }
  if (['processed', 'paid'].includes(status)) filter.status = status;
  if (month) {
    const monthNumber = Number(month);
    if (Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12) filter.month = monthNumber;
  }
  if (year) {
    const yearNumber = Number(year);
    if (Number.isInteger(yearNumber)) filter.year = yearNumber;
  }
  return filter;
}

async function listPayroll(query) {
  const { page, limit, skip } = pageParams(query);
  const sort = PAYROLL_SORTS[queryString(query, 'sort')] || PAYROLL_SORTS.newest;
  const filter = payrollFilter(query);
  const [items, total] = await Promise.all([
    Payroll.find(filter).sort(sort).skip(skip).limit(limit),
    Payroll.countDocuments(filter),
  ]);
  return paged(items.map(presentPayroll), page, limit, total);
}

async function getPayroll(id) {
  assertObjectId(id);
  const payroll = await Payroll.findById(id);
  if (!payroll) throw new ApiError(404, 'Payroll record not found.', 'PAYROLL_NOT_FOUND');
  return presentPayroll(payroll);
}

async function getSalarySlip(id) {
  assertObjectId(id);
  const payroll = await Payroll.findById(id);
  if (!payroll) throw new ApiError(404, 'Payroll record not found.', 'PAYROLL_NOT_FOUND');
  return buildSalarySlip(payroll.toObject(), config.institutionName);
}

async function markPayrollPaid(id, actor) {
  assertObjectId(id);
  const payroll = await Payroll.findById(id);
  if (!payroll) throw new ApiError(404, 'Payroll record not found.', 'PAYROLL_NOT_FOUND');
  if (payroll.status === 'paid') {
    throw new ApiError(409, 'This payroll is already marked as paid.', 'PAYROLL_ALREADY_PAID');
  }
  payroll.status = 'paid';
  payroll.paidAt = new Date();
  payroll.paidBy = actorSnapshot(actor);
  await payroll.save();
  return presentPayroll(payroll);
}

module.exports = {
  listSalaryProfiles,
  saveSalaryProfile,
  previewPayroll,
  processPayroll,
  listPayroll,
  getPayroll,
  getSalarySlip,
  markPayrollPaid,
};
