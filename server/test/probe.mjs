import { newDb } from 'pg-mem';
import { randomUUID } from 'node:crypto';

const mem = newDb();
mem.public.registerFunction({ name: 'now', returns: 'timestamptz', implementation: () => new Date() });
mem.public.registerFunction({ name: 'gen_random_uuid', returns: 'uuid', implementation: () => randomUUID() });
const { Pool } = mem.adapters.createPg();
const p = new Pool();
try {
  await p.query('CREATE TABLE t1 (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  console.log('create-with-defaults ok');
  const r = await p.query(`INSERT INTO t1 (name) VALUES ('x') RETURNING id`);
  console.log('insert ok', r.rows[0].id);
  await p.query(`SELECT 1 WHERE now() > now() - interval '1 day'`);
  console.log('interval ok');
  await p.query(`CREATE UNIQUE INDEX t1_lower ON t1 (lower(name))`);
  console.log('expr-index ok');
  await p.query(`CREATE TABLE t2 (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), u UUID REFERENCES t1(id) ON DELETE CASCADE)`);
  console.log('fk ok');
  await p.query(`SELECT * FROM t1 WHERE lower(name) = lower('X')`);
  console.log('lower-eq ok');
} catch (e) {
  console.log('FAIL:', String(e?.message || e).split('\n').slice(0, 4).join(' | '));
}
await p.end();
