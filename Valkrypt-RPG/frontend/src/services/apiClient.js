import axios from 'axios';

function isApiUrl(url = '') {
  if (!url) return false;
  return String(url).startsWith('/api/');
}

function getAuthToken() {
  try {
    return localStorage.getItem('token') || '';
  } catch {
    return '';
  }
}

function makeRequestId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {}
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function mergeHeaders(baseHeaders, nextHeaders) {
  const headers = new Headers(baseHeaders || {});
  if (!nextHeaders) return headers;
  new Headers(nextHeaders).forEach((value, key) => headers.set(key, value));
  return headers;
}

function enrichError(rawError, fallbackMessage = 'Error de red') {
  if (!rawError) return { message: fallbackMessage, code: 'network_error', requestId: '' };

  if (typeof rawError === 'object') {
    const message = String(rawError.message || rawError.error || fallbackMessage);
    return {
      message,
      code: String(rawError.code || 'request_failed'),
      requestId: String(rawError.requestId || '')
    };
  }

  return { message: String(rawError), code: 'request_failed', requestId: '' };
}

function installFetchApiClient() {
  const nativeFetch = globalThis.fetch?.bind(globalThis);
  if (!nativeFetch || globalThis.__valkryptFetchWrapped) return;

  globalThis.fetch = async (input, init = {}) => {
    const requestUrl = typeof input === 'string' ? input : String(input?.url || '');
    const headers = mergeHeaders(input?.headers, init?.headers);
    const requestId = makeRequestId();

    headers.set('x-request-id', requestId);
    if (isApiUrl(requestUrl)) {
      const token = getAuthToken();
      if (token && !headers.has('authorization')) {
        headers.set('authorization', `Bearer ${token}`);
      }
    }

    try {
      const response = await nativeFetch(input, { ...init, headers });
      const responseRequestId = response.headers.get('x-request-id') || requestId;
      response.requestId = responseRequestId;

      if (!response.ok && isApiUrl(requestUrl)) {
        try {
          const payload = await response.clone().json();
          response.apiError = enrichError(payload, `Error HTTP ${response.status}`);
          response.apiError.requestId = responseRequestId;
        } catch {
          response.apiError = {
            message: `Error HTTP ${response.status}`,
            code: 'http_error',
            requestId: responseRequestId
          };
        }
      }

      return response;
    } catch (error) {
      const networkError = new Error(`Error de red. ${String(error?.message || '').trim()}`.trim());
      networkError.code = 'network_error';
      networkError.requestId = requestId;
      throw networkError;
    }
  };

  globalThis.__valkryptFetchWrapped = true;
}

function installAxiosApiClient() {
  if (globalThis.__valkryptAxiosWrapped) return;

  axios.interceptors.request.use((config) => {
    const nextConfig = { ...config };
    const headers = { ...(nextConfig.headers || {}) };
    const requestId = makeRequestId();
    headers['x-request-id'] = headers['x-request-id'] || requestId;

    const url = String(nextConfig.url || '');
    if (isApiUrl(url)) {
      const token = getAuthToken();
      if (token && !headers.Authorization) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    nextConfig.headers = headers;
    nextConfig.meta = { ...(nextConfig.meta || {}), requestId };
    return nextConfig;
  });

  axios.interceptors.response.use(
    (response) => {
      response.requestId = response?.headers?.['x-request-id'] || response?.config?.meta?.requestId || '';
      return response;
    },
    (error) => {
      const responseData = error?.response?.data;
      const normalized = enrichError(responseData, error?.message || 'Error de petición');
      normalized.requestId = String(
        responseData?.requestId
        || error?.response?.headers?.['x-request-id']
        || error?.config?.meta?.requestId
        || ''
      );
      error.apiError = normalized;
      return Promise.reject(error);
    }
  );

  globalThis.__valkryptAxiosWrapped = true;
}

export function setupApiClient() {
  installFetchApiClient();
  installAxiosApiClient();
}

export function getApiErrorMessage(error, fallback = 'Error inesperado.') {
  const source = error?.apiError || error;
  const message = String(source?.message || source?.error || fallback);
  const requestId = String(source?.requestId || '');
  return requestId ? `${message} (ref: ${requestId})` : message;
}
