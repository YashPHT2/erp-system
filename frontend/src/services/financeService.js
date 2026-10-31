import api, { unwrap } from './api';

export const feeService = {
  listStructures: (params) => api.get('/fee-structures', { params }).then(unwrap),
  createStructure: (body) => api.post('/fee-structures', body).then(unwrap),
  updateStructure: (id, body) => api.put(`/fee-structures/${id}`, body).then(unwrap),
  searchStudents: (q) => api.get('/integration/students', { params: { q } }).then(unwrap),
  classes: () => api.get('/integration/classes').then(unwrap),
  feeAccount: (params) => api.get('/fee-accounts', { params }).then(unwrap),
  collect: (body) => api.post('/fee-payments', body).then(unwrap),
  listPayments: (params) => api.get('/fee-payments', { params }).then(unwrap),
  listReceipts: (params) => api.get('/receipts', { params }).then(unwrap),
  getReceipt: (id) => api.get(`/receipts/${id}`).then(unwrap),
  cancelReceipt: (id, reason) => api.post(`/receipts/${id}/cancel`, { reason }).then(unwrap),
};

export const reportService = {
  dashboard: () => api.get('/reports/dashboard').then(unwrap),
  daily: (params) => api.get('/reports/daily', { params }).then(unwrap),
  monthly: (params) => api.get('/reports/monthly', { params }).then(unwrap),
  classWise: (params) => api.get('/reports/class-wise', { params }).then(unwrap),
  paymentModes: (params) => api.get('/reports/payment-modes', { params }).then(unwrap),
  pending: (params) => api.get('/reports/pending', { params }).then(unwrap),
  defaulters: (params) => api.get('/reports/defaulters', { params }).then(unwrap),
  cancelled: (params) => api.get('/reports/cancelled', { params }).then(unwrap),
  notifications: () => api.get('/notifications').then(unwrap),
};

export const payrollService = {
  employees: (params) => api.get('/integration/employees', { params }).then(unwrap),
  salaries: (params) => api.get('/salary-profiles', { params }).then(unwrap),
  saveSalary: (employeeId, body) => api.put(`/salary-profiles/${employeeId}`, body).then(unwrap),
  preview: (body) => api.post('/payroll/preview', body).then(unwrap),
  process: (body) => api.post('/payroll', body).then(unwrap),
  list: (params) => api.get('/payroll', { params }).then(unwrap),
  slip: (id) => api.get(`/payroll/${id}/slip`).then(unwrap),
  markPaid: (id) => api.patch(`/payroll/${id}/payment`, { status: 'paid' }).then(unwrap),
};

export const settingsService = {
  get: () => api.get('/settings').then(unwrap),
};
