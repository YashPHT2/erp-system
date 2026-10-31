import {
  AlertTriangle,
  Banknote,
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
    label: 'Fee management',
    items: [
      { to: '/fees/structures', label: 'Fee structure', icon: Layers },
      { to: '/fees/collect', label: 'Collect fee', icon: Wallet },
      { to: '/fees/payments', label: 'Payment history', icon: History },
      { to: '/fees/receipts', label: 'Receipts', icon: Receipt },
      { to: '/fees/pending', label: 'Pending fees', icon: Clock },
      { to: '/fees/defaulters', label: 'Defaulters', icon: AlertTriangle },
    ],
  },
  {
    label: 'Insights',
    items: [{ to: '/reports', label: 'Financial reports', icon: BarChart3 }],
  },
  {
    label: 'Payroll',
    items: [
      { to: '/payroll/salaries', label: 'Employee salaries', icon: Users },
      { to: '/payroll/process', label: 'Process payroll', icon: Banknote },
      { to: '/payroll/history', label: 'Payroll history', icon: FileText },
      { to: '/payroll/slips', label: 'Salary slips', icon: ScrollText },
    ],
  },
];

export const settingsItem = { to: '/settings', label: 'Settings', icon: Settings };
