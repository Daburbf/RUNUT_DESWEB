// Klien HTTP terpusat untuk backend Runut (VITE_API_URL, default :3000).
// Menyertakan access token, me-refresh otomatis sekali saat 401, lalu mengulang
// permintaan. TIDAK PERNAH menyimpan API key AI — semua rahasia milik server.
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const ACCESS_KEY = 'runut_access';
const REFRESH_KEY = 'runut_refresh';

export const tokens = {
  get access() {
    try { return localStorage.getItem(ACCESS_KEY); } catch { return null; }
  },
  get refresh() {
    try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
  },
  set(pair) {
    try {
      if (pair?.accessToken) localStorage.setItem(ACCESS_KEY, pair.accessToken);
      if (pair?.refreshToken) localStorage.setItem(REFRESH_KEY, pair.refreshToken);
    } catch { /* abaikan */ }
  },
  clear() {
    try { localStorage.removeItem(ACCESS_KEY); localStorage.removeItem(REFRESH_KEY); } catch { /* abaikan */ }
  },
};

export class ApiError extends Error {
  constructor(status, payload) {
    super(payload?.error || `Permintaan gagal (HTTP ${status}).`);
    this.status = status;
    this.code = payload?.code;
    this.details = payload?.details;
  }
}

async function raw(path, { method = 'GET', body, form, token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export async function api(path, opts = {}, retry = true) {
  try {
    return await raw(path, { ...opts, token: tokens.access });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && retry && tokens.refresh && !path.startsWith('/api/auth/')) {
      try {
        const pair = await raw('/api/auth/refresh', { method: 'POST', body: { refreshToken: tokens.refresh } });
        tokens.set(pair);
        return await raw(path, { ...opts, token: tokens.access });
      } catch {
        tokens.clear();
      }
    }
    throw err;
  }
}

export const apiBase = BASE;
