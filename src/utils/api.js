// Klien HTTP terpusat untuk backend Runut (VITE_API_URL, default :3000).
// Access token disimpan di memori saja. Refresh token berada di cookie
// HttpOnly milik server sehingga tidak bisa dibaca skrip halaman. Tidak ada
// kredensial AI di sisi klien — semua rahasia milik server.
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

let accessToken = null;

export const session = {
  get access() {
    return accessToken;
  },
  set({ accessToken: token } = {}) {
    accessToken = token || null;
  },
  clear() {
    accessToken = null;
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
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: payload, credentials: 'include' });
  } catch {
    // Kegagalan jaringan: jangan teruskan pesan bawaan browser (mis. "Failed to fetch").
    throw new ApiError(0, { error: 'Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.' });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

// Refresh token dirotasi server: satu token hanya sah sekali. Bila beberapa
// permintaan kena 401 bersamaan, semuanya harus menunggu SATU refresh yang sama
// — kalau tidak, yang kalah balapan menerima 401 dan sesi ikut dibersihkan.
let refreshing = null;

export function refreshPair() {
  refreshing ??= raw('/api/auth/refresh', { method: 'POST' }).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function api(path, opts = {}, retry = true) {
  try {
    return await raw(path, { ...opts, token: accessToken });
  } catch (err) {
    // Sekali saja: coba segarkan sesi lewat cookie, lalu ulangi permintaan.
    if (err instanceof ApiError && err.status === 401 && retry && !path.startsWith('/api/auth/')) {
      try {
        session.set(await refreshPair());
        return await raw(path, { ...opts, token: accessToken });
      } catch {
        session.clear();
      }
    }
    throw err;
  }
}

// Dipakai saat halaman dimuat ulang: access token hilang karena hanya di
// memori, jadi sesi dipulihkan dari cookie refresh bila masih berlaku.
export async function restoreSession() {
  const pair = await refreshPair();
  session.set(pair);
  return pair;
}

export const apiBase = BASE;
