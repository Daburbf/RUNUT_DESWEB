import pg from 'pg';
import { config } from './config.js';

let pool;

if (config.testMemDb) {
  const { newDb } = await import('pg-mem');
  const { randomUUID } = await import('node:crypto');
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  mem.public.registerFunction({
    name: 'now',
    returns: 'timestamptz',
    implementation: () => new Date(),
  });
  mem.public.registerFunction({
    name: 'gen_random_uuid',
    returns: 'uuid',
    implementation: () => randomUUID(), impure: true });
  const { Pool } = mem.adapters.createPg();
  pool = new Pool();
} else {
  pool = new pg.Pool({
    connectionString: config.databaseUrl,
    max: Number(process.env.PG_POOL_MAX || 20),
  });
  pool.on('error', (err) => console.error('[db] pool error:', err.message));
}

export function getPool() {
  return pool;
}

export function query(text, params) {
  return pool.query(text, params);
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch { /* abaikan */ }
    throw err;
  } finally {
    client.release();
  }
}

export async function closeDb() {
  await pool.end();
}

