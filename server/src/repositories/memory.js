import { randomUUID } from 'node:crypto';

// Adapter penyimpanan SEMENTARA (in-memory) untuk pengembangan dan pengujian.
// Isi hilang saat server dimatikan - bukan penyimpanan persisten dan bukan
// pengganti PostgreSQL. Logika bisnis hanya berbicara lewat kontrak repository
// di ./index.js, sehingga adapter PostgreSQL dapat ditambahkan kemudian tanpa
// mengubah routes/services.
const now = () => new Date().toISOString();
const clone = (row) => (row ? { ...row } : row);

// Mode demo presentasi: DEMO_PREMIUM=1 membuat akun baru langsung berstatus
// Premium supaya alur "terapkan saran" bisa diperlihatkan tanpa jalur
// pembayaran (pembayaran masih 501). Dibaca saat dipanggil, bukan saat modul
// dimuat, agar tidak bergantung urutan pemuatan dotenv. Selalu mati saat tes
// berjalan (NODE_ENV=test) supaya rangkaian uji menguji perilaku sebenarnya.
const demoPremium = () => process.env.DEMO_PREMIUM === '1' && process.env.NODE_ENV !== 'test';

export function createMemoryRepositories() {
  const tables = {
    users: [],
    documents: [],
    analyses: [],
    issues: [],
    refresh_tokens: [],
    payments: [],
  };

  const insert = (table, row) => {
    const record = { id: randomUUID(), created_at: now(), ...row };
    tables[table].push(record);
    return clone(record);
  };

  const users = {
    async create({ name, email, password_hash }) {
      const premium = demoPremium();
      return insert('users', {
        name,
        email,
        password_hash,
        is_premium: premium,
        premium_until: premium ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
        reset_token_hash: null,
        reset_token_expires_at: null,
        updated_at: now(),
      });
    },
    async findById(id) {
      return clone(tables.users.find((u) => u.id === id));
    },
    async findByEmail(email) {
      const needle = String(email || '').trim().toLowerCase();
      return clone(tables.users.find((u) => u.email.toLowerCase() === needle));
    },
    async findByResetTokenHash(hash) {
      return clone(tables.users.find((u) => u.reset_token_hash && u.reset_token_hash === hash));
    },
    async update(id, patch) {
      const row = tables.users.find((u) => u.id === id);
      if (!row) return null;
      Object.assign(row, patch, { updated_at: now() });
      return clone(row);
    },
    // Aktivasi premium tidak bisa dipicu dari HTTP: pembayaran belum dibuka,
    // jadi hanya dipanggil langsung oleh operator/migrasi bila diperlukan.
    async extendPremium(id, days) {
      const row = tables.users.find((u) => u.id === id);
      if (!row) return null;
      const base = row.premium_until && new Date(row.premium_until) > new Date() ? new Date(row.premium_until) : new Date();
      base.setDate(base.getDate() + Number(days));
      row.is_premium = true;
      row.premium_until = base.toISOString();
      row.updated_at = now();
      return clone(row);
    },
  };

  const refreshTokens = {
    async create({ user_id, token_hash, expires_at, user_agent }) {
      return insert('refresh_tokens', { user_id, token_hash, expires_at, user_agent: user_agent || null, revoked_at: null });
    },
    async findByHash(token_hash) {
      return clone(tables.refresh_tokens.find((t) => t.token_hash === token_hash));
    },
    async revokeByHash(token_hash) {
      const row = tables.refresh_tokens.find((t) => t.token_hash === token_hash && !t.revoked_at);
      if (row) row.revoked_at = now();
      return Boolean(row);
    },
    async revokeById(id) {
      const row = tables.refresh_tokens.find((t) => t.id === id);
      if (row) row.revoked_at = now();
    },
    async revokeAllForUser(user_id) {
      for (const t of tables.refresh_tokens) if (t.user_id === user_id && !t.revoked_at) t.revoked_at = now();
    },
  };

  const documents = {
    async create(row) {
      return insert('documents', {
        revised_text: null,
        status: 'analyzed',
        expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        last_analyzed_at: now(),
        updated_at: now(),
        ...row,
      });
    },
    async findById(id) {
      return clone(tables.documents.find((d) => d.id === id));
    },
    async listByUser(user_id, { q = '', limit = 100 } = {}) {
      const needle = q.trim().toLowerCase();
      return tables.documents
        .filter((d) => d.user_id === user_id && (!needle || d.title.toLowerCase().includes(needle)))
        .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
        .slice(0, limit)
        .map(clone);
    },
    async update(id, patch) {
      const row = tables.documents.find((d) => d.id === id);
      if (!row) return null;
      Object.assign(row, patch, { updated_at: now() });
      return clone(row);
    },
    async deleteMany(user_id, ids) {
      const owned = tables.documents.filter((d) => d.user_id === user_id && ids.includes(d.id));
      tables.documents = tables.documents.filter((d) => !owned.includes(d));
      for (const d of owned) {
        const analyses = tables.analyses.filter((a) => a.document_id === d.id);
        tables.issues = tables.issues.filter((i) => !analyses.some((a) => a.id === i.analysis_id));
        tables.analyses = tables.analyses.filter((a) => a.document_id !== d.id);
      }
      return owned.map((d) => d.id);
    },
    // Kebijakan retensi SRS: dokumen disimpan 30 hari setelah analisis terakhir.
    async deleteExpired(at = new Date().toISOString()) {
      const expired = tables.documents.filter((d) => d.expires_at && d.expires_at < at);
      for (const d of expired) {
        const owned = tables.analyses.filter((a) => a.document_id === d.id);
        tables.issues = tables.issues.filter((i) => !owned.some((a) => a.id === i.analysis_id));
        tables.analyses = tables.analyses.filter((a) => a.document_id !== d.id);
      }
      tables.documents = tables.documents.filter((d) => !expired.includes(d));
      return expired.length;
    },
  };

  const analyses = {
    async create(row) {
      return insert('analyses', row);
    },
    async findLatestByDocument(document_id) {
      const rows = tables.analyses.filter((a) => a.document_id === document_id);
      return clone(rows[rows.length - 1]);
    },
  };

  const issues = {
    async createMany(rows) {
      return rows.map((r) => insert('issues', r));
    },
    async listByAnalysis(analysis_id) {
      return tables.issues
        .filter((i) => i.analysis_id === analysis_id)
        .sort((a, b) => a.start_pos - b.start_pos)
        .map(clone);
    },
    async countPendingByDocument(document_id) {
      const ids = tables.analyses.filter((a) => a.document_id === document_id).map((a) => a.id);
      return tables.issues.filter((i) => ids.includes(i.analysis_id) && i.decision === 'active').length;
    },
    async updateDecision(id, { decision, suggestion }) {
      const row = tables.issues.find((i) => i.id === id);
      if (!row) return null;
      row.decision = decision;
      if (suggestion !== undefined) row.suggestion = suggestion;
      row.updated_at = now();
      return clone(row);
    },
    async resetDecisions(analysis_id) {
      for (const i of tables.issues) if (i.analysis_id === analysis_id) i.decision = 'active';
    },
  };

  // Transaksi pembayaran. Idempotensi premium bergantung pada
  // markPaidIfPending(): hanya transisi pertama ke 'paid' yang mengembalikan
  // baris, sehingga notifikasi berulang tidak pernah menggandakan masa aktif.
  const payments = {
    async create(row) {
      return insert('payments', { updated_at: now(), ...row });
    },
    async findById(id) {
      return clone(tables.payments.find((p) => p.id === id));
    },
    async findByOrderId(order_id) {
      return clone(tables.payments.find((p) => p.order_id === order_id));
    },
    async listByUser(user_id, { limit = 30 } = {}) {
      return tables.payments
        .filter((p) => p.user_id === user_id)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, limit)
        .map(clone);
    },
    async update(id, patch) {
      const row = tables.payments.find((p) => p.id === id);
      if (!row) return null;
      Object.assign(row, patch, { updated_at: now() });
      return clone(row);
    },
    async markPaidIfPending(id, patch) {
      const row = tables.payments.find((p) => p.id === id);
      if (!row || row.status === 'paid') return null;
      Object.assign(row, patch, { status: 'paid', updated_at: now() });
      return clone(row);
    },
  };

  return { users, refreshTokens, documents, analyses, issues, payments };
}
