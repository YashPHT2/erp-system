const bcrypt = require('bcryptjs');
const config = require('../config/env');
const { assertRuntimeConfig } = require('../config/env');
const { connectDb } = require('../config/db');
const { refreshTransactionSupport } = require('../utils/transaction');
const { currentAcademicYear, getZonedParts, zonedDateTimeToUtc } = require('../utils/dates');
const { DEV_ACCOUNTS } = require('./devAccounts');
const FeeStructure = require('../models/FeeStructure');
const FeeAccount = require('../models/FeeAccount');
const FeePayment = require('../models/FeePayment');
const Receipt = require('../models/Receipt');
const Counter = require('../models/Counter');
const { SalaryProfile, Payroll } = require('../models/Payroll');
const { DevUser, SystemMeta } = require('../models/System');
const { createFeeStructure } = require('../modules/feeStructure/feeStructure.service');
const { collectFee, getFeeAccountView } = require('../modules/feeCollection/feeCollection.service');
const { cancelReceipt } = require('../modules/receipts/receipt.service');
const { saveSalaryProfile, processPayroll, markPayrollPaid } = require('../modules/payroll/payroll.service');

const principal = { userId: 'seed-principal', name: 'Priya Banerjee', role: 'PRINCIPAL' };
const accountant = { userId: 'seed-accountant', name: 'Vikram Joshi', role: 'ACCOUNTANT' };

function monthsAgo(count, parts) {
  const index = parts.year * 12 + (parts.month - 1) - count;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function pastDate(monthsBack, day, parts) {
  const shifted = monthsAgo(monthsBack, parts);
  const safeDay = monthsBack === 0 ? Math.min(day, parts.day) : day;
  const instant = zonedDateTimeToUtc(shifted.year, shifted.month, safeDay, 11, 0, 0, config.timezone);
  return instant.getTime() > Date.now() ? new Date() : instant;
}

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed when NODE_ENV=production.');
  }
  assertRuntimeConfig();
  const password = process.env.DEV_USER_PASSWORD || '';
  if (password.length < 8) {
    throw new Error('Set DEV_USER_PASSWORD to at least 8 characters in backend/.env before seeding.');
  }

  await connectDb();
  await refreshTransactionSupport();

  await Promise.all([
    FeeStructure.init(),
    FeeAccount.init(),
    FeePayment.init(),
    Receipt.init(),
    Counter.init(),
    SalaryProfile.init(),
    Payroll.init(),
    DevUser.init(),
    SystemMeta.init(),
  ]);

  await Promise.all([
    FeeStructure.deleteMany({}),
    FeeAccount.deleteMany({}),
    FeePayment.deleteMany({}),
    Receipt.deleteMany({}),
    Counter.deleteMany({}),
    SalaryProfile.deleteMany({}),
    Payroll.deleteMany({}),
    DevUser.deleteMany({}),
    SystemMeta.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash(password, 10);
  if (config.authMode === 'mock') {
    await DevUser.insertMany(DEV_ACCOUNTS.map((account) => ({ ...account, passwordHash })));
  }

  const academicYear = currentAcademicYear(new Date(), config.timezone);
  const structures = [
    ['Grade 8', '', [
      { code: 'TUITION', amount: 36000 },
      { code: 'ADMISSION', amount: 5000 },
      { code: 'EXAMINATION', amount: 2000 },
      { code: 'LIBRARY', amount: 800 },
      { code: 'TRANSPORT', amount: 4800 },
    ]],
    ['Grade 9', '', [
      { code: 'TUITION', amount: 40000 },
      { code: 'ADMISSION', amount: 5000 },
      { code: 'EXAMINATION', amount: 2200 },
      { code: 'LIBRARY', amount: 800 },
      { code: 'TRANSPORT', amount: 4800 },
    ]],
    ['Grade 10', '', [
      { code: 'TUITION', amount: 45000 },
      { code: 'ADMISSION', amount: 5000 },
      { code: 'EXAMINATION', amount: 2500 },
      { code: 'LIBRARY', amount: 1000 },
      { code: 'TRANSPORT', amount: 6000 },
    ]],
    ['Grade 10', 'B', [
      { code: 'TUITION', amount: 45000 },
      { code: 'ADMISSION', amount: 5000 },
      { code: 'EXAMINATION', amount: 2500 },
      { code: 'LIBRARY', amount: 1000 },
    ]],
    ['B.Sc Computer Science Year 1', '', [
      { code: 'TUITION', amount: 85000 },
      { code: 'ADMISSION', amount: 10000 },
      { code: 'EXAMINATION', amount: 4000 },
      { code: 'LIBRARY', amount: 2000 },
      { code: 'OTHER', label: 'Laboratory Fee', amount: 8000 },
    ]],
    ['B.Com Year 2', '', [
      { code: 'TUITION', amount: 70000 },
      { code: 'ADMISSION', amount: 8000 },
      { code: 'EXAMINATION', amount: 3500 },
      { code: 'LIBRARY', amount: 1500 },
    ]],
  ];

  for (const [className, section, components] of structures) {
    await createFeeStructure({ academicYear, className, section, components }, principal);
  }

  const parts = getZonedParts(new Date(), config.timezone);
  const payments = [
    { admissionNumber: 'ADM2026001', amount: 20000, paymentMode: 'cash', when: pastDate(4, 12, parts), key: 'seed-payment-0001' },
    { admissionNumber: 'ADM2026001', amount: 10000, paymentMode: 'cheque', chequeNumber: '458721', when: pastDate(3, 8, parts), key: 'seed-payment-0002', cancel: 'Cheque returned by the bank.' },
    { admissionNumber: 'ADM2026002', full: true, paymentMode: 'bank_transfer', referenceNumber: 'NEFT240818', when: pastDate(2, 18, parts), key: 'seed-payment-0003' },
    { admissionNumber: 'ADM2026007', full: true, paymentMode: 'bank_transfer', referenceNumber: 'NEFT240820', when: pastDate(2, 20, parts), key: 'seed-payment-0004' },
    { admissionNumber: 'ADM2026005', amount: 10000, paymentMode: 'cash', when: pastDate(1, 4, parts), key: 'seed-payment-0005' },
    { admissionNumber: 'ADM2026008', amount: 20000, paymentMode: 'cash', when: pastDate(1, 15, parts), key: 'seed-payment-0006' },
    { admissionNumber: 'ADM2026004', amount: 15000, paymentMode: 'cash', when: pastDate(1, 22, parts), key: 'seed-payment-0007' },
    { admissionNumber: 'ADM2026201', full: true, paymentMode: 'bank_transfer', referenceNumber: 'NEFT241006', when: pastDate(0, 6, parts), key: 'seed-payment-0008' },
    { admissionNumber: 'ADM2026202', amount: 25000, paymentMode: 'cash', when: pastDate(0, 10, parts), key: 'seed-payment-0009' },
    { admissionNumber: 'ADM2026101', amount: 40000, paymentMode: 'bank_transfer', referenceNumber: 'IMPS241020', when: pastDate(0, 15, parts), key: 'seed-payment-0010' },
    { admissionNumber: 'ADM2026001', amount: 5000, paymentMode: 'bank_transfer', referenceNumber: 'UPI241031', when: new Date(), key: 'seed-payment-0011' },
  ];

  for (const plan of payments) {
    const view = await getFeeAccountView(plan.admissionNumber, academicYear);
    const amount = plan.full ? view.account.pendingAmount : plan.amount;
    const result = await collectFee({
      idempotencyKey: plan.key,
      admissionNumber: plan.admissionNumber,
      academicYear,
      amount,
      paymentMode: plan.paymentMode,
      chequeNumber: plan.chequeNumber,
      referenceNumber: plan.referenceNumber,
    }, accountant, { paymentDate: plan.when });
    if (plan.cancel) {
      await cancelReceipt(result.receipt.id, { reason: plan.cancel }, accountant);
    }
  }

  const salaries = [
    { employeeId: 'emp_1001', basicSalary: 52000, allowances: [{ code: 'HRA', amount: 12000 }, { code: 'DA', amount: 5000 }], deductions: [{ code: 'PF', amount: 6240 }, { code: 'PT', amount: 200 }] },
    { employeeId: 'emp_1002', basicSalary: 42000, allowances: [{ code: 'HRA', amount: 8000 }], deductions: [{ code: 'PF', amount: 5040 }, { code: 'PT', amount: 200 }] },
    { employeeId: 'emp_1003', basicSalary: 68000, allowances: [{ code: 'HRA', amount: 15000 }, { code: 'DA', amount: 6000 }], deductions: [{ code: 'PF', amount: 8160 }, { code: 'TDS', amount: 2500 }] },
    { employeeId: 'emp_1004', basicSalary: 48000, allowances: [{ code: 'HRA', amount: 9000 }], deductions: [{ code: 'PF', amount: 5760 }, { code: 'PT', amount: 200 }] },
    { employeeId: 'emp_1005', basicSalary: 36000, allowances: [{ code: 'HRA', amount: 6000 }], deductions: [{ code: 'PF', amount: 4320 }, { code: 'PT', amount: 200 }] },
    { employeeId: 'emp_1006', basicSalary: 55000, allowances: [{ code: 'HRA', amount: 11000 }], deductions: [{ code: 'PF', amount: 6600 }, { code: 'PT', amount: 200 }] },
    { employeeId: 'emp_1007', basicSalary: 32000, allowances: [{ code: 'HRA', amount: 5000 }], deductions: [{ code: 'PF', amount: 3840 }, { code: 'PT', amount: 200 }] },
    { employeeId: 'emp_1008', basicSalary: 30000, allowances: [{ code: 'TRANSPORT', amount: 3000 }], deductions: [{ code: 'PF', amount: 3600 }, { code: 'PT', amount: 200 }] },
    { employeeId: 'emp_1009', basicSalary: 90000, allowances: [{ code: 'HRA', amount: 20000 }], deductions: [{ code: 'PF', amount: 10800 }, { code: 'TDS', amount: 8000 }] },
    { employeeId: 'emp_1010', basicSalary: 28000, allowances: [{ code: 'HRA', amount: 4000 }], deductions: [{ code: 'PF', amount: 3360 }, { code: 'PT', amount: 200 }] },
  ];

  for (const salary of salaries) {
    await saveSalaryProfile(salary.employeeId, salary, accountant);
  }

  const previous = monthsAgo(1, parts);
  const processed = [];
  for (const salary of salaries) {
    processed.push(await processPayroll({
      employeeId: salary.employeeId,
      month: previous.month,
      year: previous.year,
    }, accountant));
  }
  const currentRuns = [];
  for (const salary of salaries.slice(0, 6)) {
    currentRuns.push(await processPayroll({
      employeeId: salary.employeeId,
      month: parts.month,
      year: parts.year,
    }, accountant));
  }
  for (const run of currentRuns.slice(0, 3)) {
    await markPayrollPaid(run.id, accountant);
  }

  await SystemMeta.create({ key: 'finance', demoSeed: true, seededAt: new Date() });
  console.log(`Seeded EduFinance sample data for ${academicYear}.`);
  console.log('Development users (password is DEV_USER_PASSWORD in backend/.env):');
  for (const account of DEV_ACCOUNTS) {
    console.log(`- ${account.role}: ${account.email}`);
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
