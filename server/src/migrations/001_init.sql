-- Migrasi Runut (idempotent: aman dijalankan ulang via CREATE IF NOT EXISTS).
-- Membutuhkan PostgreSQL 14+.
-- Keputusan naming: tabel pembayaran = `payments` (penjelasan skema SDD), bukan
-- label diagram `TRANSACTIONS`. Lihat docs/KEPUTUSAN_TEKNIS.md (D2).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================= users =================
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(320) NOT NULL,
  password_hash TEXT NOT NULL,
  is_premium    BOOLEAN NOT NULL DEFAULT FALSE,
  premium_until TIMESTAMPTZ NULL,
  reset_token_hash TEXT NULL,
  reset_token_expires_at TIMESTAMPTZ NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (lower(email));

-- ================= documents =================
-- Retensi 30 hari setelah analisis terakhir ditegakkan oleh job backend
-- (cleanupExpiredDocuments), bukan penghapusan otomatis bawaan PostgreSQL.
CREATE TABLE IF NOT EXISTS documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title         VARCHAR(255) NOT NULL DEFAULT 'Dokumen tanpa judul',
  original_text TEXT NOT NULL,
  revised_text  TEXT NULL,
  status        VARCHAR(32) NOT NULL DEFAULT 'analyzed'
                CHECK (status IN ('draft', 'analyzed', 'revising', 'done')),
  word_count    INTEGER NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  last_analyzed_at TIMESTAMPTZ NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_user_updated_idx ON documents (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS documents_expires_idx ON documents (expires_at);

-- ================= analysis_results =================
CREATE TABLE IF NOT EXISTS analysis_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  stats         JSONB NOT NULL DEFAULT '{}',
  locked        BOOLEAN NOT NULL DEFAULT TRUE,
  ai_provider   VARCHAR(64) NOT NULL DEFAULT '',
  ai_model      VARCHAR(128) NOT NULL DEFAULT '',
  ai_latency_ms INTEGER NULL,
  ai_status     VARCHAR(32) NOT NULL DEFAULT 'ok',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Satu dokumen boleh punya banyak riwayat analisis; yang terbaru yang dipakai.
CREATE INDEX IF NOT EXISTS analysis_results_doc_created_idx ON analysis_results (document_id, created_at DESC);

-- ================= issues =================
CREATE TABLE IF NOT EXISTS issues (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id    UUID NOT NULL REFERENCES analysis_results (id) ON DELETE CASCADE,
  category       VARCHAR(32) NOT NULL CHECK (category IN
                   ('repetition', 'sentence_pattern', 'uniform_structure',
                    'transition', 'formality', 'style_consistency')),
  start_pos      INTEGER NOT NULL CHECK (start_pos >= 0),
  end_pos        INTEGER NOT NULL CHECK (end_pos > start_pos),
  snippet        TEXT NOT NULL,
  explanation    TEXT NOT NULL,
  suggestion     TEXT NOT NULL,
  needs_manual_review BOOLEAN NOT NULL DEFAULT FALSE,
  decision       VARCHAR(16) NOT NULL DEFAULT 'pending'
                 CHECK (decision IN ('pending', 'accepted', 'rejected')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS issues_analysis_idx ON issues (analysis_id);

-- ================= payments =================
CREATE TABLE IF NOT EXISTS payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  order_id      VARCHAR(128) NOT NULL,
  amount        INTEGER NOT NULL CHECK (amount > 0),
  currency      VARCHAR(8) NOT NULL DEFAULT 'IDR',
  status        VARCHAR(32) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'settlement', 'capture', 'deny', 'cancel', 'expire', 'failure', 'refund', 'paid', 'failed')),
  snap_token    TEXT NULL,
  redirect_url  TEXT NULL,
  raw_notify    JSONB NULL,
  paid_at       TIMESTAMPTZ NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payments_order_unique ON payments (order_id);
CREATE INDEX IF NOT EXISTS payments_user_created_idx ON payments (user_id, created_at DESC);

-- ================= refresh_tokens =================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ NULL,
  user_agent    TEXT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_hash_unique ON refresh_tokens (token_hash);
