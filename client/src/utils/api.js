/**
 * API client.
 *
 * Holds the access token in memory (not localStorage, which is readable by
 * any injected script) and keeps only the long-lived refresh token in
 * storage. A 401 triggers one silent refresh and a single retry; if that
 * fails the caller is signed out.
 */

const REFRESH_KEY = 'ce_refresh';

let accessToken = null;
let refreshPromise = null;
const listeners = new Set();

export const tokenStore = {
  getAccess: () => accessToken,
  setAccess(token) { accessToken = token; },
  getRefresh() {
    try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
  },
  setRefresh(token) {
    try {
      if (token) localStorage.setItem(REFRESH_KEY, token);
      else localStorage.removeItem(REFRESH_KEY);
    } catch { /* private mode */ }
  },
  clear() {
    accessToken = null;
    this.setRefresh(null);
  },
};

export function onAuthExpired(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyExpired() {
  tokenStore.clear();
  listeners.forEach((fn) => fn());
}

async function refreshAccessToken() {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) return null;

  // Collapse concurrent refreshes into one request.
  refreshPromise ??= (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      tokenStore.setAccess(json.accessToken);
      return json.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(method, path, body, options = {}) {
  const url = path.startsWith('/api') ? path : `/api${path}`;

  const send = async (token) => {
    const headers = { ...(options.headers || {}) };
    let payload = body;

    if (body instanceof FormData) {
      // Let the browser set the multipart boundary.
    } else if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    if (token) headers.authorization = `Bearer ${token}`;

    return fetch(url, { method, headers, body: payload, signal: options.signal });
  };

  let response = await send(accessToken);

  if (response.status === 401 && tokenStore.getRefresh() && !options._retried) {
    const fresh = await refreshAccessToken();
    if (fresh) {
      response = await send(fresh);
    } else {
      notifyExpired();
      throw new ApiError(401, 'Your session has expired. Please sign in again.');
    }
  }

  if (response.status === 204) return null;

  let json;
  const text = await response.text();
  try { json = text ? JSON.parse(text) : null; } catch { json = { error: text }; }

  if (!response.ok) {
    if (response.status === 401) notifyExpired();
    throw new ApiError(response.status, json?.error || `Request failed (${response.status})`, json?.details);
  }
  return json;
}

export const api = {
  get: (path, options) => request('GET', path, undefined, options),
  post: (path, body, options) => request('POST', path, body, options),
  patch: (path, body, options) => request('PATCH', path, body, options),
  put: (path, body, options) => request('PUT', path, body, options),
  delete: (path, options) => request('DELETE', path, undefined, options),

  /** Build a query string from an object, dropping empty values. */
  qs(params = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      search.set(key, String(value));
    }
    const str = search.toString();
    return str ? `?${str}` : '';
  },

  async upload(files, extra = {}) {
    const form = new FormData();
    for (const file of Array.isArray(files) ? files : [files]) form.append('files', file);
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined && value !== null) form.append(key, String(value));
    }
    return request('POST', '/media/upload', form);
  },
};

export default api;
