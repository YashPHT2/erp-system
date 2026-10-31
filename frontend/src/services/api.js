import axios from 'axios';
import { TOKEN_KEY } from '../utils/format';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const status = error.response?.status;
    if (status === 401 && !url.includes('/dev-auth/login') && !url.includes('/meta')) {
      localStorage.removeItem(TOKEN_KEY);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  },
);

export function unwrap(response) {
  return response.data.data;
}

export function getErrorMessage(error) {
  return error?.response?.data?.message || error?.message || 'Something went wrong. Please try again.';
}

export async function downloadCsv(path, filename, params = {}) {
  const response = await api.get(path, {
    params: { ...params, format: 'csv' },
    responseType: 'blob',
  });
  const type = response.headers['content-type'] || '';
  if (type.includes('application/json')) {
    const text = await response.data.text();
    const body = JSON.parse(text);
    throw new Error(body.message || 'The report could not be exported.');
  }
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default api;
