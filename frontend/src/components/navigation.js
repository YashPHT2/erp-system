import {
  AlertTriangle,
  Banknote,
  BookOpen,
  BarChart3,
  Clock,
  FileText,
  History,
  Layers,
  LayoutDashboard,
  Receipt,
  ScrollText,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';

export const navigation = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Overview', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Student workspace',
    items: [
      { to: '/student/fees', label: 'My fees', icon: Wallet, permission: 'student.self' },
      { to: '/student/payments', label: 'My payments', icon: History, permission: 'student.self' },
      { to: '/student/receipts', label: 'My receipts', icon: Receipt, permission: 'student.self' },
    ],
  },
  {
    label: 'Teacher workspace',
    items: [
      { to: '/teacher/salary', label: 'My salary', icon: Banknote, permission: 'teaching.self' },
      { to: '/teacher/sections', label: 'My sections', icon: Users, permission: 'teaching.self' },
      { to: '/teacher/timetable', label: 'My timetable', icon: Clock, permission: 'teaching.self' },
      { to: '/teacher/attendance', label: 'Student attendance', icon: ScrollText, permission: 'teaching.self' },
      { to: '/teacher/assignments', label: 'Assignments', icon: FileText, permission: 'teaching.self' },
    ],
  },
  {
    label: 'Library',
    items: [
      { to: '/library', label: 'Library overview', icon: BookOpen, permission: 'library.read', end: true },
      { to: '/library/books', label: 'Book catalog', icon: Layers, permission: 'library.read' },
      { to: '/library/circulation', label: 'Issues and returns', icon: History, permission: 'library.manage' },
      { to: '/library/my-books', label: 'My borrowed books', icon: BookOpen, permission: 'library.self' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/directory/students', label: 'Students', icon: Users, permission: 'directory.students' },
      { to: '/directory/employees', label: 'Employees', icon: Users, permission: 'directory.employees' },
      { to: '/settings/users', label: 'User accounts', icon: Users, permission: 'users.manage' },
      { to: '/teaching/manage', label: 'Teaching management', icon: Layers, permission: 'teaching.manage' },
    ],
  },
  {
    label: 'Fee management',
    items: [
      { to: '/fees/structures', label: 'Fee structure', icon: Layers, permission: 'feeStructure.read' },
      { to: '/fees/collect', label: 'Collect fee', icon: Wallet, permission: 'fees.collect' },
      { to: '/fees/payments', label: 'Payment history', icon: History, permission: 'fees.read' },
      { to: '/fees/receipts', label: 'Receipts', icon: Receipt, permission: 'fees.read' },
      { to: '/fees/pending', label: 'Pending fees', icon: Clock, permission: 'reports.read' },
      { to: '/fees/defaulters', label: 'Defaulters', icon: AlertTriangle, permission: 'reports.read' },
    ],
  },
  {
    label: 'Insights',
    items: [{ to: '/reports', label: 'Financial reports', icon: BarChart3, permission: 'reports.read' }],
  },
  {
    label: 'Payroll',
    items: [
      { to: '/payroll/salaries', label: 'Employee salaries', icon: Users, permission: 'payroll.read' },
      { to: '/payroll/process', label: 'Process payroll', icon: Banknote, permission: 'payroll.write' },
      { to: '/payroll/history', label: 'Payroll history', icon: FileText, permission: 'payroll.read' },
      { to: '/payroll/slips', label: 'Salary slips', icon: ScrollText, permission: 'payroll.read' },
    ],
  },
];

export const settingsItem = { to: '/settings', label: 'Settings', icon: Settings };
