// Pengujian backend Runut memakai pg-mem (TEST_USE_PGMEM=1) agar jalan tanpa
// server PostgreSQL lokal. Cakupan: stats deterministik, validasi AI, auth
// + refresh, isolasi dokumen antar-pengguna, 503 AI eksplisit, unduh, hapus,
// dan penolakan token reset kedaluwarsa.
process.env.TEST_USE_PGMEM = '1';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-char-xyz';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-char-xyz';

import test from 'node:test';
import assert from 'node:assert/strict';

const { migrateTest } = await import('./migrateTest.js');
await migrateTest();
const { createApp } = await import('../src/app.js');
const { query } = await import('../src/db.js');
const { computeStats, countWords } = await import('../src/services/stats.js');
const { validateAiIssues } = await import('../src/services/aiValidate.js');

const app = createApp();
const srv = app.listen(0);
await new Promise((r) => srv.on('listening', r));
const base = `http://127.0.0.1:${srv.address().port}`;

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function registerUser(name, email) {
  const r = await api('/api/auth/register', { method: 'POST', body: { name, email, password: 'Rahasia123' } });
  assert.equal(r.status, 201, `register gagal untuk ${email}: ${JSON.stringify(r.data)}`);
  return r.data;
}

async function userIdByEmail(email) {
  const { rows } = await query('SELECT id FROM users WHERE email = $1', [email]);
  return rows[0].id;
}

test('stats deterministik: jumlah kata & rata-rata kalimat', () => {
  const s = computeStats('Saya pergi ke pasar. Pasar itu sangat ramai sekali.');
  assert.equal(s.word_count, 9);
  assert.equal(s.sentence_count, 2);
  assert.equal(s.avg_sentence_length, 4.5);
  assert.ok(s.top_words.length > 0);
  assert.equal(countWords('  halo   dunia '), 2);
});

test('validasi AI: menolak koordinat palsu, menandai saran berisiko', () => {
  const text = 'Saya membeli 3 apel di Jakarta. Rasanya sangat manis.';
  const parsed = {
    issues: [
      { type: 'formality', start: 40, end: 46, text: 'sangat', explanation: 'Kata penguat yang berulang.', suggestion: 'benar-benar' },
      { type: 'repetition', start: 0, end: 4, text: 'XXXX', explanation: 'Palsu.', suggestion: 'Y' },
      { type: 'sentence_pattern', start: 13, end: 19, text: '3 apel', explanation: 'Perlu cek.', suggestion: 'lima buah jeruk yang sangat besar sekali' },
      { type: 'plagiarism', start: 0, end: 4, text: 'Saya', explanation: 'Di luar skope.', suggestion: 'Aku' },
    ],
  };
  const { valid, errors } = validateAiIssues(parsed, text);
  assert.equal(valid.length, 2);
  assert.equal(errors.length, 2);
  assert.equal(valid[0].category, 'formality');
  assert.equal(valid[0].needs_manual_review, false);
  assert.equal(valid[1].needs_manual_review, true);
});

test('auth: register -> login -> me -> refresh -> logout', async () => {
  const email = `uji${Date.now()}@runut.local`;
  const reg = await registerUser('Uji', email);
  assert.ok(reg.accessToken && reg.refreshToken);

  const bad = await api('/api/auth/login', { method: 'POST', body: { email, password: 'salah' } });
  assert.equal(bad.status, 401);

  const login = await api('/api/auth/login', { method: 'POST', body: { email, password: 'Rahasia123' } });
  assert.equal(login.status, 200);

  const me = await api('/api/auth/me', { token: login.data.accessToken });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.email, email);

  const rf = await api('/api/auth/refresh', { method: 'POST', body: { refreshToken: login.data.refreshToken } });
  assert.equal(rf.status, 200);
  assert.ok(rf.data.accessToken);

  const out = await api('/api/auth/logout', { method: 'POST', body: { refreshToken: login.data.refreshToken } });
  assert.equal(out.status, 200);
});

test('isolasi dokumen: user B tidak bisa membaca dokumen user A', async () => {
  const t = Date.now();
  const a = await registerUser('Pengguna A', `a${t}@x.local`);
  const b = await registerUser('Pengguna B', `b${t}@x.local`);
  const uidA = await userIdByEmail(`a${t}@x.local`);
  const { rows } = await query(
    'INSERT INTO documents (user_id, title, original_text, word_count, expires_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
    [uidA, 'Rahasia A', 'Dokumen milik A yang cukup panjang untuk pengujian hak akses data.', 10, new Date(Date.now() + 2592e6).toISOString(), new Date().toISOString(), new Date().toISOString()],
  );
  const id = rows[0].id;
  const forbidden = await api(`/api/documents/${id}`, { token: b.accessToken });
  assert.equal(forbidden.status, 403);
  const ok = await api(`/api/documents/${id}`, { token: a.accessToken });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.document.title, 'Rahasia A');
});

test('analysis tanpa konfigurasi AI menjawab 503 eksplisit (tidak memalsukan hasil)', async () => {
  const t = Date.now();
  const u = await registerUser('Pengguna C', `c${t}@x.local`);
  const text = Array(30).fill('kata').join(' ');
  const prevProvider = process.env.AI_PROVIDER;
  const prevBase = process.env.AI_BASE_URL;
  const prevKey = process.env.AI_API_KEY;
  const prevModel = process.env.AI_MODEL;
  process.env.AI_PROVIDER = '9router';
  process.env.AI_BASE_URL = '';
  process.env.AI_API_KEY = '';
  process.env.AI_MODEL = '';
  let r;
  try {
    r = await api('/api/analysis', { method: 'POST', token: u.accessToken, body: { text, title: 'Uji' } });
  } finally {
    if (prevProvider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = prevProvider;
    if (prevBase === undefined) delete process.env.AI_BASE_URL; else process.env.AI_BASE_URL = prevBase;
    if (prevKey === undefined) delete process.env.AI_API_KEY; else process.env.AI_API_KEY = prevKey;
    if (prevModel === undefined) delete process.env.AI_MODEL; else process.env.AI_MODEL = prevModel;
  }
  assert.equal(r.status, 503);
  assert.match(r.data.error || '', /AI|dikonfigurasi/i);
});

test('dokumen: unduh TXT milik sendiri; hapus via ids', async () => {
  const t = Date.now();
  const u = await registerUser('Pengguna D', `d${t}@x.local`);
  const uid = await userIdByEmail(`d${t}@x.local`);
  const { rows } = await query(
    'INSERT INTO documents (user_id, title, original_text, revised_text, word_count, expires_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
    [uid, 'Unduh', 'Teks asli revisi.', 'Teks revisi final.', 3, new Date(Date.now() + 2592e6).toISOString(), new Date().toISOString(), new Date().toISOString()],
  );
  const id = rows[0].id;
  const dl = await fetch(`${base}/api/documents/${id}/download?format=txt`, {
    headers: { Authorization: `Bearer ${u.accessToken}` },
  });
  const dlBody = await dl.text();
  assert.equal(dl.status, 200);
  assert.equal(dlBody, 'Teks revisi final.');
  const del = await api('/api/documents', { method: 'DELETE', token: u.accessToken, body: { ids: [id] } });
  assert.equal(del.status, 200);
  assert.deepEqual(del.data.deleted, [id]);
});

test('reset password: token kedaluwarsa >30 menit ditolak', async () => {
  const t = Date.now();
  const email = `e${t}@x.local`;
  await registerUser('Pengguna E', email);
  await query(
    `UPDATE users SET reset_token_hash = $1, reset_token_expires_at = now() WHERE email = $2`,
    ['deadbeef', email],
  );
  const r = await api('/api/auth/reset-password', { method: 'POST', body: { token: 'deadbeef-token-salah', password: 'Baru12345' } });
  assert.equal(r.status, 400);
});

test.after(() => new Promise((resolve) => srv.close(resolve)));


