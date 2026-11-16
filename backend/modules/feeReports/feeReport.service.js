const FeePayment = require('../../models/FeePayment');
const FeeStructure = require('../../models/FeeStructure');
const FeeAccount = require('../../models/FeeAccount');
const Receipt = require('../../models/Receipt');
const { Payroll } = require('../../models/Payroll');
const studentDirectory = require('../../integrations/students');
const config = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { fromPaise } = require('../../utils/money');
const { PAYMENT_MODES } = require('../../constants');
const { pickStructure } = require('../feeStructure/feeStructure.service');
const { calculateBalance } = require('../feeCollection/feeMath');
const { queryString, assertAcademicYear } = require('../../utils/validate');
const { presentPayment, presentReceipt } = require('../../utils/present');
const {
  getZonedParts,
  currentAcademicYear,
  startOfZonedDay,
  addDays,
  monthRange,
  monthKey,
  recentMonths,
  parseIsoDate,
  zonedDateTimeToUtc,
  SHORT_MONTHS,
  periodLabel,
} = require('../../utils/dates');

function dayWindow(dateString, now = new Date()) {
  if (!dateString) {
    const start = startOfZonedDay(now, config.timezone);
    return { start, end: addDays(start, 1) };
  }
  const parsed = parseIsoDate(dateString);
  if (!parsed) throw new ApiError(400, 'Date must use YYYY-MM-DD.', 'VALIDATION_ERROR');
  const start = zonedDateTimeToUtc(parsed.year, parsed.month, parsed.day, 0, 0, 0, config.timezone);
  return { start, end: addDays(start, 1) };
}

async function completedPaymentsBetween(start, end, extra = {}) {
  return FeePayment.find({
    status: 'completed',
    paymentDate: { $gte: start, $lt: end },
    ...extra,
  }).sort({ paymentDate: -1 });
}

function sumPayments(payments) {
  return payments.reduce((total, payment) => total + payment.amountPaise, 0);
}

async function buildBalanceRows(query = {}) {
  const academicYear = query.academicYear
    ? assertAcademicYear(query.academicYear)
    : currentAcademicYear(new Date(), config.timezone);
  const students = await studentDirectory.listStudents({
    academicYear,
    className: queryString(query, 'className'),
    section: queryString(query, 'section'),
    search: queryString(query, 'search'),
  });
  const structures = await FeeStructure.find({ academicYear });
  const accounts = await FeeAccount.find({
    academicYear,
    admissionNumber: { $in: students.map((student) => student.admissionNumber) },
  });
  const accountsByAdmission = new Map(accounts.map((account) => [account.admissionNumber, account]));

  const rows = students.map((student) => {
    const account = accountsByAdmission.get(student.admissionNumber);
    const structure = account
      ? structures.find((item) => String(item._id) === String(account.feeStructureId)) || pickStructure(structures, student)
      : pickStructure(structures, student);

    if (!account && !structure) {
      return {
        studentId: student.id,
        admissionNumber: student.admissionNumber,
        studentName: student.name,
        className: student.className,
        section: student.section || '',
        academicYear: student.academicYear,
        feeAssigned: false,
        totalAmountPaise: 0,
        paidAmountPaise: 0,
        pendingAmountPaise: 0,
        advanceAmountPaise: 0,
        defaulter: false,
      };
    }

    const totalPaise = account ? account.totalAmountPaise : structure.totalAmountPaise;
    const paidPaise = account ? account.paidAmountPaise : 0;
    const balances = calculateBalance(totalPaise, paidPaise);
    return {
      studentId: student.id,
      admissionNumber: student.admissionNumber,
      studentName: student.name,
      className: student.className,
      section: student.section || '',
      academicYear: student.academicYear,
      feeAssigned: true,
      totalAmountPaise: totalPaise,
      paidAmountPaise: paidPaise,
      pendingAmountPaise: balances.pendingPaise,
      advanceAmountPaise: balances.advancePaise,
      defaulter: balances.pendingPaise > 0,
    };
  });

  rows.sort((left, right) => left.className.localeCompare(right.className) || left.studentName.localeCompare(right.studentName));
  return { academicYear, rows };
}

function presentBalanceRow(row) {
  return {
    studentId: row.studentId,
    admissionNumber: row.admissionNumber,
    studentName: row.studentName,
    className: row.className,
    section: row.section,
    academicYear: row.academicYear,
    feeAssigned: row.feeAssigned,
    totalAmount: row.feeAssigned ? fromPaise(row.totalAmountPaise) : null,
    paidAmount: fromPaise(row.paidAmountPaise),
    pendingAmount: row.feeAssigned ? fromPaise(row.pendingAmountPaise) : null,
    advanceAmount: fromPaise(row.advanceAmountPaise),
    defaulter: row.defaulter,
  };
}

function balanceTotals(rows) {
  const assigned = rows.filter((row) => row.feeAssigned);
  const pendingPaise = assigned.reduce((total, row) => total + row.pendingAmountPaise, 0);
  const paidPaise = assigned.reduce((total, row) => total + row.paidAmountPaise, 0);
  return {
    students: rows.length,
    feeAssigned: assigned.length,
    withDues: assigned.filter((row) => row.defaulter).length,
    pendingAmount: fromPaise(pendingPaise),
    paidAmount: fromPaise(paidPaise),
  };
}

async function pendingReport(query) {
  const result = await buildBalanceRows(query);
  return {
    academicYear: result.academicYear,
    rows: result.rows.map(presentBalanceRow),
    totals: balanceTotals(result.rows),
  };
}

async function defaulterReport(query) {
  const result = await buildBalanceRows(query);
  const rows = result.rows.filter((row) => row.defaulter);
  return {
    academicYear: result.academicYear,
    rows: rows.map(presentBalanceRow),
    totals: balanceTotals(rows),
  };
}

function isoDate(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

async function dailyReport(query) {
  const requested = queryString(query, 'date', 10);
  const window = dayWindow(requested);
  const parts = requested ? parseIsoDate(requested) : getZonedParts(new Date(), config.timezone);
  const payments = await completedPaymentsBetween(window.start, window.end);
  return {
    date: isoDate(parts),
    count: payments.length,
    totalAmount: fromPaise(sumPayments(payments)),
    rows: payments.map(presentPayment),
  };
}

async function monthlyReport(query) {
  const parts = getZonedParts(new Date(), config.timezone);
  const year = Number(queryString(query, 'year', 4) || parts.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new ApiError(400, 'Choose a valid year.', 'VALIDATION_ERROR');
  }
  const start = zonedDateTimeToUtc(year, 1, 1, 0, 0, 0, config.timezone);
  const end = zonedDateTimeToUtc(year + 1, 1, 1, 0, 0, 0, config.timezone);
  const payments = await completedPaymentsBetween(start, end);
  const months = SHORT_MONTHS.map((label, index) => ({
    month: index + 1,
    label,
    amountPaise: 0,
    count: 0,
  }));
  for (const payment of payments) {
    const paid = getZonedParts(payment.paymentDate, config.timezone);
    if (paid.year !== year) continue;
    months[paid.month - 1].amountPaise += payment.amountPaise;
    months[paid.month - 1].count += 1;
  }
  return {
    year,
    totalAmount: fromPaise(sumPayments(payments)),
    months: months.map((month) => ({
      month: month.month,
      label: month.label,
      count: month.count,
      amount: fromPaise(month.amountPaise),
    })),
  };
}

async function classWiseReport(query) {
  const academicYear = query.academicYear
    ? assertAcademicYear(query.academicYear)
    : currentAcademicYear(new Date(), config.timezone);
  const rows = await FeePayment.aggregate([
    { $match: { status: 'completed', academicYear } },
    { $group: { _id: '$className', amountPaise: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const items = rows.map((row) => ({
    className: row._id,
    count: row.count,
    amount: fromPaise(row.amountPaise),
  }));
  return {
    academicYear,
    totalAmount: fromPaise(rows.reduce((total, row) => total + row.amountPaise, 0)),
    rows: items,
  };
}

async function paymentModeReport(query) {
  const parts = getZonedParts(new Date(), config.timezone);
  const year = Number(queryString(query, 'year', 4) || parts.year);
  const month = queryString(query, 'month', 2);
  let start = zonedDateTimeToUtc(year, 1, 1, 0, 0, 0, config.timezone);
  let end = zonedDateTimeToUtc(year + 1, 1, 1, 0, 0, 0, config.timezone);
  if (month) {
    const monthNumber = Number(month);
    if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
      throw new ApiError(400, 'Choose a valid month.', 'VALIDATION_ERROR');
    }
    const range = monthRange(year, monthNumber, config.timezone);
    start = range.start;
    end = range.end;
  }
  const rows = await FeePayment.aggregate([
    { $match: { status: 'completed', paymentDate: { $gte: start, $lt: end } } },
    { $group: { _id: '$paymentMode', amountPaise: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
  ]);
  const items = PAYMENT_MODES.map((mode) => {
    const found = rows.find((row) => row._id === mode.value);
    return {
      mode: mode.value,
      label: mode.label,
      count: found?.count || 0,
      amount: fromPaise(found?.amountPaise || 0),
    };
  });
  return {
    totalAmount: fromPaise(rows.reduce((total, row) => total + row.amountPaise, 0)),
    rows: items,
  };
}

async function cancelledReport(query) {
  const filter = { status: 'cancelled' };
  const from = parseIsoDate(queryString(query, 'from', 10));
  const to = parseIsoDate(queryString(query, 'to', 10));
  if (from || to) {
    filter['cancellation.cancelledAt'] = {};
    if (from) {
      filter['cancellation.cancelledAt'].$gte = zonedDateTimeToUtc(from.year, from.month, from.day, 0, 0, 0, config.timezone);
    }
    if (to) {
      filter['cancellation.cancelledAt'].$lt = addDays(
        zonedDateTimeToUtc(to.year, to.month, to.day, 0, 0, 0, config.timezone),
        1,
      );
    }
  }
  const receipts = await Receipt.find(filter).sort({ 'cancellation.cancelledAt': -1 });
  return {
    count: receipts.length,
    totalAmount: fromPaise(receipts.reduce((total, receipt) => total + receipt.amountPaise, 0)),
    rows: receipts.map(presentReceipt),
  };
}

async function dashboard() {
  const now = new Date();
  const academicYear = currentAcademicYear(now, config.timezone);
  const today = dayWindow('', now);
  const months = recentMonths(now, config.timezone, 6);
  const trendStart = monthRange(months[0].year, months[0].month, config.timezone).start;
  const trendEnd = monthRange(months[months.length - 1].year, months[months.length - 1].month, config.timezone).end;

  const [yearPayments, todayPayments, trendPayments, recentPayments, recentReceipts, balances, payrollAll] = await Promise.all([
    FeePayment.find({ status: 'completed', academicYear }),
    completedPaymentsBetween(today.start, today.end),
    completedPaymentsBetween(trendStart, trendEnd),
    FeePayment.find().sort({ paymentDate: -1, createdAt: -1 }).limit(8),
    Receipt.find().sort({ paymentDate: -1 }).limit(5),
    buildBalanceRows({ academicYear }),
    Payroll.aggregate([{ $group: { _id: null, total: { $sum: '$netSalaryPaise' }, count: { $sum: 1 } } }]),
  ]);

  const trendBuckets = new Map(months.map((month) => [month.key, 0]));
  for (const payment of trendPayments) {
    const paid = getZonedParts(payment.paymentDate, config.timezone);
    const key = monthKey(paid.year, paid.month);
    if (trendBuckets.has(key)) trendBuckets.set(key, trendBuckets.get(key) + payment.amountPaise);
  }

  const modeBuckets = new Map(PAYMENT_MODES.map((mode) => [mode.value, 0]));
  for (const payment of yearPayments) {
    modeBuckets.set(payment.paymentMode, (modeBuckets.get(payment.paymentMode) || 0) + payment.amountPaise);
  }

  const pendingByClass = new Map();
  for (const row of balances.rows) {
    if (!row.defaulter) continue;
    const current = pendingByClass.get(row.className) || { className: row.className, students: 0, pendingPaise: 0 };
    current.students += 1;
    current.pendingPaise += row.pendingAmountPaise;
    pendingByClass.set(row.className, current);
  }

  const parts = getZonedParts(now, config.timezone);
  const monthPayroll = await Payroll.find({ month: parts.month, year: parts.year });
  const pendingPaise = balances.rows.reduce((total, row) => total + row.pendingAmountPaise, 0);

  return {
    academicYear,
    totals: {
      feeCollection: fromPaise(sumPayments(yearPayments)),
      pendingFees: fromPaise(pendingPaise),
      todayCollection: fromPaise(sumPayments(todayPayments)),
      payrollExpense: fromPaise(payrollAll[0]?.total || 0),
      studentsWithDues: balances.rows.filter((row) => row.defaulter).length,
    },
    monthlyCollection: months.map((month) => ({
      key: month.key,
      label: month.label,
      amount: fromPaise(trendBuckets.get(month.key) || 0),
    })),
    paymentModes: PAYMENT_MODES.map((mode) => ({
      mode: mode.value,
      label: mode.label,
      amount: fromPaise(modeBuckets.get(mode.value) || 0),
    })),
    recentPayments: recentPayments.map(presentPayment),
    recentReceipts: recentReceipts.map(presentReceipt),
    pendingByClass: Array.from(pendingByClass.values()).map((row) => ({
      className: row.className,
      students: row.students,
      pendingAmount: fromPaise(row.pendingPaise),
    })),
    payrollMonth: {
      label: periodLabel(parts.month, parts.year),
      employeeCount: monthPayroll.length,
      netAmount: fromPaise(monthPayroll.reduce((total, row) => total + row.netSalaryPaise, 0)),
      processed: monthPayroll.filter((row) => row.status === 'processed').length,
      paid: monthPayroll.filter((row) => row.status === 'paid').length,
    },
  };
}

async function getNotifications() {
  const balances = await buildBalanceRows({});
  const dueCount = balances.rows.filter((row) => row.defaulter).length;
  const parts = getZonedParts(new Date(), config.timezone);
  const range = monthRange(parts.year, parts.month, config.timezone);
  const cancelled = await Receipt.countDocuments({
    status: 'cancelled',
    'cancellation.cancelledAt': { $gte: range.start, $lt: range.end },
  });
  const items = [];
  if (dueCount > 0) {
    items.push({
      id: 'pending-dues',
      tone: 'warning',
      text: `${dueCount} student${dueCount === 1 ? '' : 's'} with outstanding dues for ${balances.academicYear}.`,
      href: '/fees/defaulters',
    });
  }
  if (cancelled > 0) {
    items.push({
      id: 'cancelled-receipts',
      tone: 'neutral',
      text: `${cancelled} receipt${cancelled === 1 ? '' : 's'} cancelled this month.`,
      href: '/reports?tab=cancelled',
    });
  }
  return items;
}

module.exports = {
  pendingReport,
  defaulterReport,
  dailyReport,
  monthlyReport,
  classWiseReport,
  paymentModeReport,
  cancelledReport,
  dashboard,
  getNotifications,
};
