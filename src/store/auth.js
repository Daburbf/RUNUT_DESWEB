// Store sesi — JWT access token di memori, refresh token di cookie HttpOnly
// milik server. Tidak ada token yang disimpan di localStorage.
import { reactive } from 'vue';
import { api, session, restoreSession } from '../utils/api';

export const auth = reactive({
  user: null,
  ready: false,

  // Saat halaman dimuat ulang, access token sudah hilang; pulihkan sesi dari
  // cookie refresh bila server masih mengenalinya.
  async init() {
    try {
      await restoreSession();
      const { user } = await api('/api/auth/me');
      this.user = user;
    } catch {
      session.clear();
      this.user = null;
    }
    this.ready = true;
  },

  async register({ name, email, password }) {
    const data = await api('/api/auth/register', { method: 'POST', body: { name, email, password } });
    session.set(data);
    this.user = data.user;
  },

  async login(email, password) {
    const data = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    session.set(data);
    this.user = data.user;
  },

  async logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch { /* sesi lokal tetap dibersihkan */ }
    session.clear();
    this.user = null;
  },

  async refreshProfile() {
    try {
      const { user } = await api('/api/auth/me');
      this.user = user;
    } catch { /* abaikan */ }
  },
});
