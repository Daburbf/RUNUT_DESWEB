import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { query, closeDb } from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, 'migrations');

export async function migrate() {
  await query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const done = await query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
    if (done.rowCount > 0) {
      console.log(`[migrate] lewati ${file} (sudah diterapkan)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await query(sql);
    await query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    console.log(`[migrate] terapkan ${file}`);
  }
}

export async function seedDev() {
  const email = 'demo@runut.local';
  const exists = await query('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
  if (exists.rowCount === 0) {
    const hash = await bcrypt.hash('Demo1234', 10);
    await query('INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)', ['Demo Runut', email, hash]);
    console.log('[seed] akun demo dibuat: demo@runut.local / Demo1234');
  } else {
    console.log('[seed] akun demo sudah ada');
  }
}

const runSeed = process.argv.includes('--seed');
// Hanya jalan otomatis saat dieksekusi langsung (node src/migrate.js),
// bukan saat diimpor (mis. oleh demo.js).
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  migrate()
  .then(() => (runSeed ? seedDev() : null))
  .then(() => closeDb())
  .then(() => console.log('[migrate] selesai'))
  .catch((err) => {
    console.error('[migrate] GAGAL:', err.message);
    process.exitCode = 1;
    return closeDb();
  });
}
