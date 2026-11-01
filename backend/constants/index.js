const ROLES = ['SUPER_ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'FEE_CLERK', 'TEACHER'];

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  PRINCIPAL: 'Principal',
  ACCOUNTANT: 'Accountant',
  FEE_CLERK: 'Fee Clerk',
  TEACHER: 'Teacher',
};

// Server-side permission matrix. Frontend display must not be trusted in place of this.
const PERMISSIONS = {
  'feeStructure.read': ['SUPER_ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'FEE_CLERK'],
  'feeStructure.write': ['SUPER_ADMIN', 'PRINCIPAL'],
  'fees.collect': ['ACCOUNTANT', 'FEE_CLERK'],
  'fees.read': ['SUPER_ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'FEE_CLERK'],
  'receipts.cancel': ['ACCOUNTANT', 'FEE_CLERK'],
  'reports.read': ['SUPER_ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'FEE_CLERK'],
  'payroll.read': ['SUPER_ADMIN', 'PRINCIPAL', 'ACCOUNTANT'],
  'payroll.write': ['SUPER_ADMIN', 'ACCOUNTANT'],
  'settings.read': ['SUPER_ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'FEE_CLERK'],
  'users.manage': ['SUPER_ADMIN'],
};

const PERMISSION_LABELS = {
  'feeStructure.read': 'View fee structures',
  'feeStructure.write': 'Create and update fee structures',
  'fees.collect': 'Collect fees',
  'fees.read': 'View fees, payments, and balances',
  'receipts.cancel': 'Cancel receipts',
  'reports.read': 'View financial reports',
  'payroll.read': 'View payroll',
  'payroll.write': 'Set salaries and process payroll',
  'settings.read': 'View finance settings',
  'users.manage': 'Manage system users',
};

const FEE_COMPONENTS = [
  { code: 'TUITION', label: 'Tuition Fee' },
  { code: 'ADMISSION', label: 'Admission Fee' },
  { code: 'EXAMINATION', label: 'Examination Fee' },
  { code: 'TRANSPORT', label: 'Transport Fee' },
  { code: 'LIBRARY', label: 'Library Fee' },
  { code: 'OTHER', label: 'Other Fees' },
];

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
];

const ALLOWANCES = [
  { code: 'HRA', label: 'House Rent Allowance' },
  { code: 'DA', label: 'Dearness Allowance' },
  { code: 'TRANSPORT', label: 'Transport Allowance' },
  { code: 'OTHER', label: 'Other Allowance' },
];

const DEDUCTIONS = [
  { code: 'PF', label: 'Provident Fund' },
  { code: 'PT', label: 'Professional Tax' },
  { code: 'TDS', label: 'Tax Deducted at Source' },
  { code: 'OTHER', label: 'Other Deduction' },
];

module.exports = {
  ROLES,
  ROLE_LABELS,
  PERMISSIONS,
  PERMISSION_LABELS,
  FEE_COMPONENTS,
  PAYMENT_MODES,
  ALLOWANCES,
  DEDUCTIONS,
};
