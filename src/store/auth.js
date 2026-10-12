// Store sesi — JWT + profil dari backend (menggantikan mock localStorage lama).
import { reactive } from 'vue';
import { api, tokens } from '../utils/api';

export const auth = reactive({
  user: null,
  ready: false,

  async init() {
    if (tokens.access) {
      try {
        const { user } = await api('/api/auth/me');
        this.user = user;
      } catch {
        tokens.clear();
        this.user = null;
      }
    }
    this.ready = true;
  },

  async register({ name, email, password }) {
    const data = await api('/api/auth/register', { method: 'POST', body: { name, email, password } });
    tokens.set(data);
    this.user = data.user;
  },

  async login(email, password) {
    const data = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    tokens.set(data);
    this.user = data.user;
  },

  async logout() {
    try {
      await api('/api/auth/logout', { method: 'POST', body: { refreshToken: tokens.refresh } });
    } catch { /* tetap keluar lokal */ }
    tokens.clear();
    this.user = null;
  },

  async refreshProfile() {
    try {
      const { user } = await api('/api/auth/me');
      this.user = user;
    } catch { /* abaikan */ }
  },
});
