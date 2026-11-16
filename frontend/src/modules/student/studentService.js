import api, { unwrap } from '../../services/api';
export const studentService = {
  overview: params => api.get('/student/overview', { params }).then(unwrap),
  payments: params => api.get('/student/payments', { params }).then(unwrap),
  receipts: params => api.get('/student/receipts', { params }).then(unwrap),
  getReceipt: id => api.get(`/student/receipts/${id}`).then(unwrap),
};
