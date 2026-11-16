const ROLES = ['SUPER_ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'FEE_CLERK', 'TEACHER', 'STUDENT', 'LIBRARIAN'];

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  PRINCIPAL: 'Principal',
  ACCOUNTANT: 'Accountant',
  FEE_CLERK: 'Fee Clerk',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  LIBRARIAN: 'Librarian',
};

// Server-side permission matrix. Frontend display must not be trusted in place of this.
const PERMISSIONS = {
  'feeStructure.read': ['SUPER_ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'FEE_CLERK'],
  'feeStructure.write': ['SUPER_ADMIN', 'PRINCIPAL'],
  'fees.collect': ['SUPER_ADMIN', 'ACCOUNTANT', 'FEE_CLERK'],
  'fees.read': ['SUPER_ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'FEE_CLERK'],
  'receipts.cancel': ['SUPER_ADMIN', 'ACCOUNTANT', 'FEE_CLERK'],
  'reports.read': ['SUPER_ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'FEE_CLERK'],
  'payroll.read': ['SUPER_ADMIN', 'PRINCIPAL', 'ACCOUNTANT'],
  'payroll.write': ['SUPER_ADMIN', 'ACCOUNTANT'],
  'settings.read': ['SUPER_ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'FEE_CLERK'],
  'users.manage': ['SUPER_ADMIN'],
  'directory.students': ['SUPER_ADMIN', 'PRINCIPAL'],
  'directory.employees': ['SUPER_ADMIN', 'PRINCIPAL'],
  'teaching.self': ['TEACHER'],
  'teaching.manage': ['SUPER_ADMIN', 'PRINCIPAL'],
  'student.self': ['STUDENT'],
  'library.read': ['SUPER_ADMIN','PRINCIPAL','LIBRARIAN','TEACHER','STUDENT'],
  'library.manage': ['SUPER_ADMIN','PRINCIPAL','LIBRARIAN'],
  'library.self': ['TEACHER','STUDENT'],
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
  'directory.students': 'Manage students',
  'directory.employees': 'Manage employees',
  'teaching.self': 'View own teaching, salary, attendance and assignments',
  'teaching.manage': 'Manage teaching sections, teacher links and timetable',
  'student.self': 'View own student profile, fees, payments and receipts',
  'library.read': 'Browse the library catalog',
  'library.manage': 'Manage books, copies, issues and returns',
  'library.self': 'View own borrowed books and due dates',
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
