const config = require('../../config/env');
const { mapEmployee } = require('../mapRecords');
const { fetchJson, unwrapList, unwrapOne, requireBaseUrl } = require('../httpClient');

function baseUrl() {
  return requireBaseUrl(config.employeeApiBaseUrl, 'EMPLOYEE_API_BASE_URL');
}

async function searchEmployees(search) {
  const query = typeof search === 'string' ? search.trim() : '';
  if (query.length < 2) return [];
  const result = await fetchJson(`${baseUrl()}/employees?search=${encodeURIComponent(query)}`);
  if (result.notFound) return [];
  return unwrapList(result.body, 'Employee').map(mapEmployee);
}

async function listEmployees(filters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  const result = await fetchJson(`${baseUrl()}/employees?${params.toString()}`);
  if (result.notFound) return [];
  return unwrapList(result.body, 'Employee').map(mapEmployee);
}

async function getEmployeeById(employeeId) {
  const result = await fetchJson(`${baseUrl()}/employees/${encodeURIComponent(employeeId)}`);
  if (result.notFound) return null;
  return mapEmployee(unwrapOne(result.body));
}

module.exports = { searchEmployees, listEmployees, getEmployeeById };
