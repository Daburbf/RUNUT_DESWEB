import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../src/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(here, '..', 'src', 'migrations', '001_init.sql'), 'utf8');

// pg-mem tidak mendukung IF NOT EXISTS pada CREATE TABLE/INDEX/EXTENSION.
// Untuk pengujian, strip klausa tersebut — migrasi produksi tidak berubah.
// Juga daftarkan fungsi now() dan gen_random_uuid() agar default & interval jalan.
export async function migrateTest() {
  const cleaned = sql
    .replace(/CREATE EXTENSION[^;]+;/g, '')
    .replace(/CREATE TABLE IF NOT EXISTS/g, 'CREATE TABLE')
    .replace(/CREATE UNIQUE INDEX IF NOT EXISTS/g, 'CREATE UNIQUE INDEX')
    .replace(/CREATE INDEX IF NOT EXISTS/g, 'CREATE INDEX');
  for (const stmt of cleaned.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
    await query(stmt);
  }
  await query(`CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL)`);
  await query(`INSERT INTO schema_migrations (name, applied_at) VALUES ('001_init.sql', now())`);
}
