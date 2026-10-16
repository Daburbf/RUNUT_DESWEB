// Akses dokumen via backend. Draf analisis aktif tetap di sessionStorage agar
// refresh di halaman hasil tidak menghilangkan konteks.
import { api, apiBase, session } from '../utils/api';

const DRAFT_KEY = 'runut_current_v2';

export const documents = {
  setCurrent(doc) {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(doc)); } catch { /* abaikan */ }
  },
  getCurrent() {
    try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; }
  },
  clearCurrent() {
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* abaikan */ }
  },

  list: (q) => api(`/api/documents${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  get: (id) => api(`/api/documents/${id}`),
  decide: (id, body) => api(`/api/documents/${id}/issues`, { method: 'PATCH', body }),
  restore: (id) => api(`/api/documents/${id}/restore`, { method: 'POST', body: {} }),
  rename: (id, title) => api(`/api/documents/${id}/title`, { method: 'PATCH', body: { title } }),
  removeMany: (ids) => api('/api/documents', { method: 'DELETE', body: { ids } }),

  // Unduh via fetch berautentikasi (token di header, bukan query) lalu blob.
  async download(id, format, filename) {
    const res = await fetch(`${apiBase}/api/documents/${id}/download?format=${format}`, {
      headers: { Authorization: `Bearer ${session.access || ''}` },
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Unduhan gagal. Coba lagi.');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || `runut-revisi.${format === 'docx' ? 'docx' : 'txt'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
};
