import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;

// Skema dibuat otomatis saat startup (create table if not exists) supaya
// menyiapkan database lokal cukup satu perintah: buat database, isi
// DATABASE_URL, jalankan server. Nama tabel mengikuti SDD 3.3.
export const SCHEMA = `
create table if not exists users (
  id uuid primary key,
  name text not null,
  email text not null,
  password_hash text not null,
  is_premium boolean not null default false,
  premium_until timestamptz,
  reset_token_hash text,
  reset_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists users_email_key on users (lower(email));

create table if not exists documents (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  original_text text not null,
  revised_text text,
  word_count integer not null default 0,
  file_name text,
  status text not null default 'analyzed',
  expires_at timestamptz,
  last_analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documents_user_updated_idx on documents (user_id, updated_at desc);

create table if not exists analysis_results (
  id uuid primary key,
  document_id uuid not null references documents(id) on delete cascade,
  stats jsonb not null default '{}'::jsonb,
  locked boolean not null default false,
  ai_provider text,
  ai_model text,
  ai_latency_ms integer,
  ai_status text,
  created_at timestamptz not null default now()
);
create index if not exists analysis_results_document_idx on analysis_results (document_id, created_at desc);

create table if not exists issues (
  id uuid primary key,
  analysis_id uuid not null references analysis_results(id) on delete cascade,
  category text not null,
  start_pos integer not null default 0,
  end_pos integer not null default 0,
  snippet text,
  explanation text,
  suggestion text,
  needs_manual_review boolean not null default false,
  review_reasons jsonb not null default '[]'::jsonb,
  evidence jsonb,
  decision text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists issues_analysis_idx on issues (analysis_id, start_pos);

create table if not exists payments (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  order_id text not null,
  method text not null,
  method_label text,
  channel text,
  amount integer not null,
  status text not null default 'pending',
  provider text,
  provider_ref text,
  instructions jsonb not null default '{}'::jsonb,
  premium_days integer not null default 30,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Tabel payments sudah ada di basis data lama: tambahkan kolom baru tanpa
-- menghapus data yang sudah tercatat.
alter table payments add column if not exists order_id text;
alter table payments add column if not exists method text;
alter table payments add column if not exists method_label text;
alter table payments add column if not exists channel text;
alter table payments add column if not exists provider text;
alter table payments add column if not exists instructions jsonb not null default '{}'::jsonb;
alter table payments add column if not exists premium_days integer not null default 30;
alter table payments add column if not exists expires_at timestamptz;
alter table payments add column if not exists paid_at timestamptz;
create unique index if not exists payments_order_id_key on payments (order_id);
create index if not exists payments_user_idx on payments (user_id, created_at desc);

create table if not exists refresh_tokens (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  user_agent text,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists refresh_tokens_token_hash_idx on refresh_tokens (token_hash);
create index if not exists refresh_tokens_user_id_idx on refresh_tokens (user_id);
`;

// Kolom yang boleh diubah lewat update(); kunci lain diabaikan agar tidak ada
// nama kolom dari luar yang masuk ke SQL.
const USER_COLUMNS = new Set([
  'name', 'email', 'password_hash', 'is_premium', 'premium_until',
  'reset_token_hash', 'reset_token_expires_at',
]);
const DOCUMENT_COLUMNS = new Set([
  'title', 'original_text', 'revised_text', 'word_count', 'file_name',
  'status', 'expires_at', 'last_analyzed_at',
]);

// Id yang tidak berbentuk UUID tidak pernah dilanjutkan ke SQL: PostgreSQL
// melempar 22P02, sedangkan adapter memori hanya menjawab "tidak ditemukan".
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => UUID_RE.test(String(v || ''));

const setClause = (patch, allowed, firstIndex = 2) => {
  const keys = Object.keys(patch || {}).filter((k) => allowed.has(k));
  return {
    keys,
    set: keys.map((k, i) => `${k} = $${i + firstIndex}`).join(', '),
    values: keys.map((k) => patch[k]),
  };
};

// Adapter PostgreSQL: seluruh tabel pada SDD 3.3 yang benar-benar dipakai
// aplikasi (users, documents, analysis_results, issues, refresh_tokens).
export async function createPostgresRepositories(connectionString) {
  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000,
  });
  // Tanpa listener ini, satu koneksi idle yang putus membuat Pool memancarkan
  // 'error' tanpa penangkap dan seluruh proses Node mati.
  pool.on('error', (err) => console.error(JSON.stringify({ event: 'pg_pool_error', reason: err.message })));
  try {
    const client = await pool.connect();
    try {
      await client.query(SCHEMA);
    } finally {
      client.release();
    }
  } catch (err) {
    // Startup gagal: pool tidak dipakai lagi, jadi ditutup agar tidak menggantung.
    await pool.end().catch(() => {});
    throw err;
  }

  const users = {
    async create({ name, email, password_hash }) {
      const { rows } = await pool.query(
        `insert into users (id, name, email, password_hash) values ($1, $2, $3, $4) returning *`,
        [randomUUID(), name, email, password_hash],
      );
      return rows[0];
    },
    async findById(id) {
      if (!isUuid(id)) return null;
      const { rows } = await pool.query('select * from users where id = $1', [id]);
      return rows[0] || null;
    },
    async findByEmail(email) {
      const { rows } = await pool.query(
        'select * from users where lower(email) = lower($1) limit 1',
        [String(email || '').trim()],
      );
      return rows[0] || null;
    },
    async findByResetTokenHash(hash) {
      const { rows } = await pool.query(
        'select * from users where reset_token_hash = $1 limit 1',
        [hash],
      );
      return rows[0] || null;
    },
    async update(id, patch) {
      if (!isUuid(id)) return null;
      const { keys, set, values } = setClause(patch, USER_COLUMNS);
      if (!keys.length) return null;
      const { rows } = await pool.query(
        `update users set ${set}, updated_at = now() where id = $1 returning *`,
        [id, ...values],
      );
      return rows[0] || null;
    },
    // Aktivasi premium tidak bisa dipicu dari HTTP (pembayaran belum dibuka).
    async extendPremium(id, days) {
      if (!isUuid(id)) return null;
      const { rows } = await pool.query(
        `update users set
           is_premium = true,
           premium_until = greatest(coalesce(premium_until, now()), now()) + ($2 || ' days')::interval,
           updated_at = now()
         where id = $1 returning *`,
        [id, String(Number(days) || 0)],
      );
      return rows[0] || null;
    },
  };

  const refreshTokens = {
    async create({ user_id, token_hash, expires_at, user_agent }) {
      const { rows } = await pool.query(
        `insert into refresh_tokens (id, user_id, token_hash, expires_at, user_agent)
         values ($1, $2, $3, $4, $5) returning *`,
        [randomUUID(), user_id, token_hash, new Date(expires_at), user_agent || null],
      );
      return rows[0];
    },
    async findByHash(token_hash) {
      const { rows } = await pool.query(
        'select * from refresh_tokens where token_hash = $1 limit 1',
        [token_hash],
      );
      return rows[0] || null;
    },
    async revokeByHash(token_hash) {
      const { rowCount } = await pool.query(
        'update refresh_tokens set revoked_at = now() where token_hash = $1 and revoked_at is null',
        [token_hash],
      );
      return rowCount > 0;
    },
    async revokeById(id) {
      if (!isUuid(id)) return;
      await pool.query('update refresh_tokens set revoked_at = now() where id = $1', [id]);
    },
    async revokeAllForUser(user_id) {
      if (!isUuid(user_id)) return;
      await pool.query(
        'update refresh_tokens set revoked_at = now() where user_id = $1 and revoked_at is null',
        [user_id],
      );
    },
  };

  const documents = {
    // Kebijakan retensi SRS: dokumen disimpan 30 hari setelah analisis terakhir.
    async create(row) {
      const { rows } = await pool.query(
        `insert into documents
           (id, user_id, title, original_text, word_count, file_name, revised_text, status, expires_at, last_analyzed_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8,
           coalesce($9::timestamptz, now() + interval '30 days'),
           coalesce($10::timestamptz, now()))
         returning *`,
        [
          randomUUID(), row.user_id, row.title, row.original_text, row.word_count || 0,
          row.file_name || null, row.revised_text || null, row.status || 'analyzed',
          row.expires_at || null, row.last_analyzed_at || null,
        ],
      );
      return rows[0];
    },
    async findById(id) {
      if (!isUuid(id)) return null;
      const { rows } = await pool.query('select * from documents where id = $1', [id]);
      return rows[0] || null;
    },
    async listByUser(user_id, { q = '', limit = 100 } = {}) {
      if (!isUuid(user_id)) return [];
      const needle = String(q || '').trim();
      const { rows } = await pool.query(
        `select * from documents
          where user_id = $1 and ($2 = '' or title ilike '%' || $2 || '%')
          order by updated_at desc
          limit $3`,
        [user_id, needle, Math.max(1, Math.min(Number(limit) || 100, 500))],
      );
      return rows;
    },
    async update(id, patch) {
      if (!isUuid(id)) return null;
      const { keys, set, values } = setClause(patch, DOCUMENT_COLUMNS);
      if (!keys.length) return null;
      const { rows } = await pool.query(
        `update documents set ${set}, updated_at = now() where id = $1 returning *`,
        [id, ...values],
      );
      return rows[0] || null;
    },
    // analysis_results dan issues ikut terhapus lewat on delete cascade.
    async deleteMany(user_id, ids) {
      if (!isUuid(user_id)) return [];
      const clean = (Array.isArray(ids) ? ids : []).filter(isUuid);
      if (!clean.length) return [];
      const { rows } = await pool.query(
        'delete from documents where user_id = $1 and id = any($2::uuid[]) returning id',
        [user_id, clean],
      );
      return rows.map((r) => r.id);
    },
    async deleteExpired(at = new Date().toISOString()) {
      const { rows } = await pool.query(
        'delete from documents where expires_at is not null and expires_at < $1 returning id',
        [new Date(at)],
      );
      return rows.length;
    },
  };

  const analyses = {
    async create(row) {
      const { rows } = await pool.query(
        `insert into analysis_results
           (id, document_id, stats, locked, ai_provider, ai_model, ai_latency_ms, ai_status)
         values ($1, $2, $3::jsonb, $4, $5, $6, $7, $8)
         returning *`,
        [
          randomUUID(), row.document_id, JSON.stringify(row.stats || {}), Boolean(row.locked),
          row.ai_provider || null, row.ai_model || null,
          Number.isFinite(row.ai_latency_ms) ? row.ai_latency_ms : null, row.ai_status || null,
        ],
      );
      return rows[0];
    },
    async findLatestByDocument(document_id) {
      if (!isUuid(document_id)) return null;
      const { rows } = await pool.query(
        'select * from analysis_results where document_id = $1 order by created_at desc, id desc limit 1',
        [document_id],
      );
      return rows[0] || null;
    },
  };

  const issues = {
    // Satu transaksi: kalau satu baris gagal, tidak ada hasil analisis yang
    // setengah tersimpan.
    async createMany(rows) {
      const list = Array.isArray(rows) ? rows : [];
      if (!list.length) return [];
      const client = await pool.connect();
      try {
        await client.query('begin');
        const stored = [];
        for (const r of list) {
          const { rows: inserted } = await client.query(
            `insert into issues
               (id, analysis_id, category, start_pos, end_pos, snippet, explanation, suggestion,
                needs_manual_review, review_reasons, evidence, decision)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12)
             returning *`,
            [
              randomUUID(), r.analysis_id, r.category, r.start_pos || 0, r.end_pos || 0,
              r.snippet || null, r.explanation || null, r.suggestion || null,
              Boolean(r.needs_manual_review), JSON.stringify(r.review_reasons || []),
              r.evidence ? JSON.stringify(r.evidence) : null, r.decision || 'active',
            ],
          );
          stored.push(inserted[0]);
        }
        await client.query('commit');
        return stored;
      } catch (err) {
        await client.query('rollback').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    async listByAnalysis(analysis_id) {
      if (!isUuid(analysis_id)) return [];
      const { rows } = await pool.query(
        'select * from issues where analysis_id = $1 order by start_pos asc, created_at asc',
        [analysis_id],
      );
      return rows;
    },
    async countPendingByDocument(document_id) {
      if (!isUuid(document_id)) return 0;
      const { rows } = await pool.query(
        `select count(*)::int as total from issues i
           join analysis_results a on a.id = i.analysis_id
          where a.document_id = $1 and i.decision = 'active'`,
        [document_id],
      );
      return rows[0]?.total || 0;
    },
    async updateDecision(id, { decision, suggestion }) {
      if (!isUuid(id)) return null;
      const { rows } = await pool.query(
        `update issues set decision = $2,
           suggestion = case when $3::text is null then suggestion else $3 end,
           updated_at = now()
         where id = $1 returning *`,
        [id, decision, suggestion === undefined || suggestion === null ? null : String(suggestion)],
      );
      return rows[0] || null;
    },
    async resetDecisions(analysis_id) {
      if (!isUuid(analysis_id)) return;
      await pool.query(
        "update issues set decision = 'active', updated_at = now() where analysis_id = $1",
        [analysis_id],
      );
    },
  };

  const payments = {
    async create(row) {
      const { rows } = await pool.query(
        `insert into payments
           (id, user_id, order_id, method, method_label, channel, amount, status,
            provider, provider_ref, instructions, premium_days, expires_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)
         returning *`,
        [
          randomUUID(), row.user_id, row.order_id, row.method, row.method_label || null,
          row.channel || null, row.amount, row.status || 'pending', row.provider || null,
          row.provider_ref || null, JSON.stringify(row.instructions || {}),
          row.premium_days || 30, row.expires_at ? new Date(row.expires_at) : null,
        ],
      );
      return rows[0];
    },
    async findById(id) {
      if (!isUuid(id)) return null;
      const { rows } = await pool.query('select * from payments where id = $1', [id]);
      return rows[0] || null;
    },
    async findByOrderId(order_id) {
      const { rows } = await pool.query('select * from payments where order_id = $1 limit 1', [order_id]);
      return rows[0] || null;
    },
    async listByUser(user_id, { limit = 30 } = {}) {
      if (!isUuid(user_id)) return [];
      const { rows } = await pool.query(
        'select * from payments where user_id = $1 order by created_at desc limit $2',
        [user_id, Math.max(1, Math.min(Number(limit) || 30, 100))],
      );
      return rows;
    },
    async update(id, patch) {
      if (!isUuid(id)) return null;
      const allowed = new Set(['status', 'provider_ref', 'instructions', 'paid_at', 'expires_at']);
      const keys = Object.keys(patch || {}).filter((k) => allowed.has(k));
      if (!keys.length) return null;
      const values = keys.map((k) => (k === 'instructions' ? JSON.stringify(patch[k]) : patch[k]));
      const set = keys.map((k, i) => (k === 'instructions' ? `instructions = $${i + 2}::jsonb` : `${k} = $${i + 2}`)).join(', ');
      const { rows } = await pool.query(
        `update payments set ${set}, updated_at = now() where id = $1 returning *`,
        [id, ...values],
      );
      return rows[0] || null;
    },
    // Satu-satunya jalur yang boleh menandai lunas: syarat status <> 'paid'
    // dievaluasi oleh basis data, jadi dua notifikasi bersamaan tidak bisa
    // sama-sama memperpanjang Premium.
    async markPaidIfPending(id, patch) {
      if (!isUuid(id)) return null;
      const { rows } = await pool.query(
        `update payments set status = 'paid', paid_at = now(), provider_ref = coalesce($2, provider_ref),
           updated_at = now()
         where id = $1 and status <> 'paid' returning *`,
        [id, patch?.provider_ref || null],
      );
      return rows[0] || null;
    },
  };

  return { users, refreshTokens, documents, analyses, issues, payments, driver: 'postgresql', close: () => pool.end() };
}
