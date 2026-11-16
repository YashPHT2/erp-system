const config = require('../../config/env');
const User = require('../../models/User');
const { isConfigured } = require('./email.service');
const { ROLE_LABELS, ROLES, PERMISSIONS, PERMISSION_LABELS, PAYMENT_MODES, FEE_COMPONENTS, ALLOWANCES, DEDUCTIONS } = require('../../constants');
const { currentAcademicYear, academicYearOptions } = require('../../utils/dates');
async function getMeta() {
  return {
    institutionName: config.institutionName, authMode: 'jwt', setupRequired: !await User.exists({}),
    demo: process.env.DEMO_MODE === 'true' && new URL(config.mongoUri).pathname === '/edufinance_demo',
    ...(process.env.DEMO_MODE === 'true' && new URL(config.mongoUri).pathname === '/edufinance_demo' ? {
      demoAccounts: require('../../demo/accounts').DEMO_ACCOUNTS,
      demoPassword: process.env.DEMO_PASSWORD || 'Demo#Finance2026',
    } : {}),
    passwordResetAvailable: isConfigured(), academicYear: currentAcademicYear(new Date(), config.timezone),
    academicYears: academicYearOptions(new Date(), config.timezone), timezone: config.timezone, currency: 'INR',
    paymentModes: PAYMENT_MODES, feeComponents: FEE_COMPONENTS, allowances: ALLOWANCES, deductions: DEDUCTIONS,
    roleLabels: ROLE_LABELS, studentProvider: config.studentProvider, employeeProvider: config.employeeProvider,
    overpaymentAllowed: config.isOverpaymentAllowed(),
  };
}
async function getSettings() {
  return { ...await getMeta(), transactionsEnabled: config.transactionsEnabled,
    roles: ROLES.map(role => ({ role, label: ROLE_LABELS[role] })),
    permissions: Object.entries(PERMISSIONS).map(([key, roles]) => ({ key, label: PERMISSION_LABELS[key], roles })),
    integration: { students: { provider: config.studentProvider }, employees: { provider: config.employeeProvider } },
  };
}
module.exports = { getMeta, getSettings };
