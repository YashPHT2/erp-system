import axios from 'axios';
const options = { baseURL: import.meta.env.VITE_API_URL || '/api/v1', withCredentials: true };
export const authApi = axios.create(options);
const api = axios.create(options);
let accessToken = '';
let generation = 0;
let refreshPromise;
export function setAccessToken(token) { accessToken = token || ''; }
export function clearAccessToken() { generation += 1; accessToken = ''; }
async function rotateSession() {
  const started = generation;
  const { data } = await authApi.post('/auth/refresh');
  if (started !== generation) throw new Error('Session changed.');
  setAccessToken(data.data.accessToken);
  return data.data;
}
export function refreshSession() {
  if (!refreshPromise) {
    const perform = () => rotateSession();
    refreshPromise = (navigator.locks ? navigator.locks.request('edufinance-session', perform) : perform())
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}
api.interceptors.request.use(config => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});
api.interceptors.response.use(response => response, async error => {
  const request = error.config;
  if (request && error.response?.status === 401 && !request._retried && request.url !== '/meta') {
    request._retried = true;
    try {
      await refreshSession();
      return api(request);
    } catch (refreshError) {
      if (refreshError.response?.status === 401) {
        clearAccessToken();
        window.dispatchEvent(new Event('edufinance:session-ended'));
      }
      return Promise.reject(refreshError);
    }
  }
  return Promise.reject(error);
});

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
