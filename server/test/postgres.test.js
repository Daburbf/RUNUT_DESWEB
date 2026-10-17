import test from 'node:test';
import assert from 'node:assert/strict';
import { initStorage, users, refreshTokens, storage } from '../src/repositories/index.js';

// Uji adapter PostgreSQL yang sungguhan. Lewat begitu saja kalau tidak ada
// database uji, supaya `npm test` tetap jalan tanpa DB dan tanpa jaringan:
//   PowerShell: $env:RUNUT_TEST_DATABASE_URL='postgres://postgres:sandi@localhost:5432/runut'; npm.cmd test
// Tabel users & refresh_tokens dibuat otomatis oleh adapter saat koneksi pertama.
const url = process.env.RUNUT_TEST_DATABASE_URL || '';

test('adapter PostgreSQL: skema otomatis, akun, dan siklus sesi', { skip: url || 'RUNUT_TEST_DATABASE_URL belum diisi' }, async () => {
  const info = await initStorage(url);
  assert.equal(info.driver, 'postgresql', 'initStorage harus memilih adapter PostgreSQL');
  assert.match(storage.detail, /PostgreSQL/);

  const email = `pg${Date.now()}${Math.random().toString(16).slice(2, 8)}@runut.test`;
  const created = await users.create({ name: 'Uji PG', email, password_hash: 'x' });
  assert.ok(created.id, 'create mengembalikan baris dengan id');
  assert.equal(created.is_premium, false);
  assert.equal(created.premium_until, null);

  assert.equal((await users.findById(created.id)).email, email);
  assert.equal((await users.findByEmail(email.toUpperCase())).id, created.id, 'email dicocokkan tanpa peduli besar/kecil huruf');

  // Kolom di luar whitelist harus diabaikan, bukan ikut masuk ke SQL.
  const updated = await users.update(created.id, { name: 'Nama Baru', id: '00000000-0000-0000-0000-000000000000', drop_all: true });
  assert.equal(updated.name, 'Nama Baru');
  assert.equal(updated.id, created.id, 'id tidak boleh ikut berubah');
  assert.equal(await users.update(created.id, {}), null, 'patch tanpa kolom sah tidak menjalankan SQL');

  const first = await users.extendPremium(created.id, 30);
  const second = await users.extendPremium(created.id, 30);
  const days = (new Date(second.premium_until) - new Date(first.premium_until)) / 86400000;
  assert.equal(first.is_premium, true);
  assert.ok(days > 29 && days < 31, `perpanjangan harus menumpuk ~30 hari, dapat ${days}`);

  const token = `hash-${Date.now()}`;
  const session = await refreshTokens.create({ user_id: created.id, token_hash: token, expires_at: new Date(Date.now() + 3600e3), user_agent: 'uji' });
  assert.equal((await refreshTokens.findByHash(token)).id, session.id);
  assert.equal(await refreshTokens.revokeByHash(token), true);
  assert.equal(await refreshTokens.revokeByHash(token), false, 'pencabutan kedua tidak mengubah apa pun');

  const token2 = `${token}-2`;
  await refreshTokens.create({ user_id: created.id, token_hash: token2, expires_at: new Date(Date.now() + 3600e3) });
  await refreshTokens.revokeAllForUser(created.id);
  assert.ok((await refreshTokens.findByHash(token2)).revoked_at, 'revokeAllForUser harus mengisi revoked_at');
});
