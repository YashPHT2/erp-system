const config = require('../../config/env');
const { DevUser, SystemMeta } = require('../../models/System');
const { DEV_ACCOUNTS } = require('../../seed/devAccounts');
const {
  ROLE_LABELS,
  ROLES,
  PERMISSIONS,
  PERMISSION_LABELS,
  PAYMENT_MODES,
  FEE_COMPONENTS,
  ALLOWANCES,
  DEDUCTIONS,
} = require('../../constants');
const { currentAcademicYear, academicYearOptions } = require('../../utils/dates');

async function getMeta() {
  const now = new Date();
  const demo = await SystemMeta.findOne({ key: 'finance' });
  const devUserCount = config.authMode === 'mock' ? await DevUser.countDocuments() : 0;
  const data = {
    institutionName: config.institutionName,
    authMode: config.authMode,
    academicYear: currentAcademicYear(now, config.timezone),
    academicYears: academicYearOptions(now, config.timezone),
    timezone: config.timezone,
    currency: 'INR',
    paymentModes: PAYMENT_MODES,
    feeComponents: FEE_COMPONENTS,
    allowances: ALLOWANCES,
    deductions: DEDUCTIONS,
    roleLabels: ROLE_LABELS,
    demoSeed: Boolean(demo?.demoSeed),
    studentProvider: config.studentProvider,
    employeeProvider: config.employeeProvider,
    overpaymentAllowed: config.isOverpaymentAllowed(),
    devUsersReady: devUserCount > 0,
  };

  if (config.authMode === 'mock' && config.nodeEnv !== 'production') {
    data.demoAccounts = DEV_ACCOUNTS.map((account) => ({
      name: account.name,
      email: account.email,
      role: account.role,
      roleLabel: ROLE_LABELS[account.role],
      password: process.env.DEV_USER_PASSWORD || '',
    }));
  }

  return data;
}

async function getSettings() {
  const meta = await getMeta();
  delete meta.demoAccounts;
  return {
    ...meta,
    transactionsEnabled: config.transactionsEnabled,
    roles: ROLES.map((role) => ({ role, label: ROLE_LABELS[role] })),
    permissions: Object.entries(PERMISSIONS).map(([key, roles]) => ({
      key,
      label: PERMISSION_LABELS[key],
      roles,
    })),
    integration: {
      students: {
        provider: config.studentProvider,
        baseUrl: config.studentProvider === 'http' ? config.studentApiBaseUrl : '',
      },
      employees: {
        provider: config.employeeProvider,
        baseUrl: config.employeeProvider === 'http' ? config.employeeApiBaseUrl : '',
      },
      authMode: config.authMode,
    },
  };
}

module.exports = { getMeta, getSettings };
