import api, { unwrap } from '../../services/api';
export const teachingService = {
  overview: () => api.get('/teaching/overview').then(unwrap),
  slip: id => api.get(`/teaching/salary-slips/${id}`).then(unwrap),
  attendance: params => api.get('/teaching/attendance', { params }).then(unwrap),
  saveAttendance: body => api.post('/teaching/attendance', body).then(unwrap),
  importAttendance: body => api.post('/teaching/attendance/import', body).then(unwrap),
  assignments: () => api.get('/teaching/assignments').then(unwrap),
  publish: body => api.post('/teaching/assignments', body).then(unwrap),
  admin: () => api.get('/teaching/admin').then(unwrap),
  createSection: body => api.post('/teaching/sections', body).then(unwrap),
  saveProfile: (id, body) => api.put(`/teaching/profiles/${id}`, body).then(unwrap),
  createSlot: body => api.post('/teaching/timetable', body).then(unwrap),
  removeSlot: id => api.delete(`/teaching/timetable/${id}`).then(unwrap),
};
export async function downloadAssignment(id, filename) {
  const response = await api.get(`/teaching/assignments/${id}/file`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
