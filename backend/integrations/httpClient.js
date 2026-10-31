const ApiError = require('../utils/ApiError');
const { getRequestContext } = require('../utils/requestContext');

async function fetchJson(url) {
  const context = getRequestContext();
  const headers = { Accept: 'application/json' };
  if (context.authorization) headers.Authorization = context.authorization;

  let response;
  try {
    response = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
  } catch (error) {
    throw new ApiError(502, 'The shared module could not be reached.', 'INTEGRATION_UNAVAILABLE');
  }

  if (response.status === 404) return { notFound: true };
  if (!response.ok) throw new ApiError(502, 'The shared module returned an error.', 'INTEGRATION_ERROR');

  const body = await response.json();
  return { body };
}

function unwrapList(body, label) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.data?.items)) return body.data.items;
  throw new ApiError(502, `${label} service returned an unexpected list.`, 'INTEGRATION_CONTRACT');
}

function unwrapOne(body) {
  if (body && typeof body === 'object' && body.data && !Array.isArray(body.data)) return body.data;
  return body;
}

function requireBaseUrl(value, name) {
  if (!value) throw new ApiError(500, `${name} is not configured.`, 'INTEGRATION_CONFIG');
  return value.replace(/\/$/, '');
}

module.exports = { fetchJson, unwrapList, unwrapOne, requireBaseUrl };
