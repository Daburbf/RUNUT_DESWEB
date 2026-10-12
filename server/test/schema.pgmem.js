// Skema pengujian yang setara dengan 001_init.sql tetapi kompatibel pg-mem
// (tanpa IF NOT EXISTS / now() default / interval / extension / ILIKE).
// Migrasi produksi TIDAK diubah; file ini hanya untuk `npm test`.
export const TEST_SCHEMA = `
CREATE TABLE schema_migrations (
  name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(320) NOT NULL,
  password_hash TEXT NOT NULL,
  is_premium    BOOLEAN NOT NULL DEFAULT FALSE,
  premium_until TIMESTAMPTZ NULL,
  reset_token_hash TEXT NULL,
  reset_token_expires_at TIMESTAMPTZ NULL,
  created_at    TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL
);
CREATE TABLE documents (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title         VARCHAR(255) NOT NULL DEFAULT 'Dokumen tanpa judul',
  original_text TEXT NOT NULL,
  revised_text  TEXT NULL,
  status        VARCHAR(32) NOT NULL DEFAULT 'analyzed',
  word_count    INTEGER NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ NOT NULL,
  last_analyzed_at TIMESTAMPTZ NULL,
  created_at    TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL
);
CREATE TABLE analysis_results (
  id            TEXT PRIMARY KEY,
  document_id   TEXT NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  stats         TEXT NOT NULL DEFAULT '{}',
  locked        BOOLEAN NOT NULL DEFAULT TRUE,
  ai_provider   VARCHAR(64) NOT NULL DEFAULT '',
  ai_model      VARCHAR(128) NOT NULL DEFAULT '',
  ai_latency_ms INTEGER NULL,
  ai_status     VARCHAR(32) NOT NULL DEFAULT 'ok',
  created_at    TIMESTAMPTZ NOT NULL
);
CREATE TABLE issues (
  id             TEXT PRIMARY KEY,
  analysis_id    TEXT NOT NULL REFERENCES analysis_results (id) ON DELETE CASCADE,
  category       VARCHAR(32) NOT NULL,
  start_pos      INTEGER NOT NULL,
  end_pos        INTEGER NOT NULL,
  snippet        TEXT NOT NULL,
  explanation    TEXT NOT NULL,
  suggestion     TEXT NOT NULL,
  needs_manual_review BOOLEAN NOT NULL DEFAULT FALSE,
  decision       VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ NOT NULL
);
CREATE TABLE payments (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  order_id      VARCHAR(128) NOT NULL,
  amount        INTEGER NOT NULL,
  currency      VARCHAR(8) NOT NULL DEFAULT 'IDR',
  status        VARCHAR(32) NOT NULL DEFAULT 'pending',
  snap_token    TEXT NULL,
  redirect_url  TEXT NULL,
  raw_notify    TEXT NULL,
  paid_at       TIMESTAMPTZ NULL,
  created_at    TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL
);
CREATE TABLE refresh_tokens (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ NULL,
  user_agent    TEXT NULL,
  created_at    TIMESTAMPTZ NOT NULL
);
`;
