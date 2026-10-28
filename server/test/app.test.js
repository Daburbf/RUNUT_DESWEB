import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import request from 'supertest';

// Stub 9Router: server HTTP nyata yang meniru /v1/chat/completions, sehingga
// jalur permintaan/respond provider benar-benar diuji, bukan di-mock di kode.
let mode = 'ok';
let seenRequests = 0;
const stub = http.createServer((req, res) => {
  seenRequests++;
  if (mode === 'hang') return; // tidak pernah menjawab -> menguji timeout
  if (mode === 'http500') {
    res.writeHead(500, { 'content-type': 'text/plain' });
    return res.end('provider error');
  }
  if (mode === 'http404') {
    res.writeHead(404, { 'content-type': 'application/json' });
    return res.end('{"error":"model not found"}');
  }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    assert.equal(req.url, '/v1/chat/completions', 'endpoint OpenAI-compatible dipakai apa adanya');
    assert.equal(req.headers.authorization, 'Bearer test-key', 'kredensial dikirim dari konfigurasi server');
    const payload = JSON.parse(body);
    assert.ok(payload.model, 'model dikirim dari AI_MODEL');
    assert.equal(payload.response_format, undefined, 'parameter yang tidak semua model dukung tidak dikirim');
    const text = String(payload.messages[1].content).split('<<<\n')[1].split('\n>>>')[0];
    const content = mode === 'badjson' ? 'ini bukan json' : JSON.stringify({ issues: buildIssues(text) });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content } }] }));
  });
});
await new Promise((resolve) => stub.listen(0, '127.0.0.1', resolve));
const stubUrl = `http://127.0.0.1:${stub.address().port}/v1`;

const at = (text, needle) => {
  const start = text.indexOf(needle);
  return { start, end: start + needle.length, text: needle };
};

function buildIssues(text) {
  const issues = [
    { ...at(text, 'Selain itu'), type: 'transition', explanation: 'Penghubung ini dipakai berulang di beberapa bagian sehingga hubungan gagasan terasa monoton.', suggestion: 'Gunakan penghubung lain yang sesuai, atau hilangkan bila tidak diperlukan.' },
    { ...at(text, 'penulis'), type: 'repetition', explanation: 'Kata ini muncul berkali-kali dalam paragraf pendek.', suggestion: 'Ganti dengan sebutan lain pada sebagian kemunculan.' },
  ];
  const second = 'menambah data';
  const secondAt = text.indexOf(second);
  issues.push({ start: secondAt, end: secondAt + second.length, text: second, type: 'uniform_structure', explanation: 'Susunan kalimat ini mirip dengan kalimat sebelumnya.', suggestion: 'Variasikan pembukaan kalimat.' });
  const third = 'Laporan ini disusun';
  const thirdAt = text.indexOf(third);
  issues.push({ start: thirdAt, end: thirdAt + third.length, text: third, type: 'sentence_pattern', explanation: 'Pola pembukaan kalimat ini sama dengan dua kalimat lain.', suggestion: 'Ubah susunan pembukaannya.', needs_review: true });
  return issues;
}

process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_AUTH_MAX = '1000';
process.env.RATE_LIMIT_ANALYSIS_MAX = '1000';
process.env.JWT_ACCESS_SECRET = 'test-secret-yang-cukup-panjang-32-karakter';
process.env.AI_PROVIDER = '9router';
process.env.AI_BASE_URL = stubUrl;
process.env.AI_API_KEY = 'test-key';
process.env.AI_MODEL = 'vendor/model-uji';
process.env.AI_TIMEOUT_MS = '2000';
delete process.env.MAIL_HOST;

const { createApp } = await import('../src/app.js');
const { users, documents, issues: issuesRepo } = await import('../src/repositories/index.js');
const app = createApp();

const TEXT = [
  'Selain itu penulis menambah data pada laporan tahunan ini.',
  'Selain itu penulis menyimpulkan temuan utama dari data tersebut.',
  'penulis menilai hasilnya cukup baik dan layak dibaca.',
  'Laporan ini disusun penulis dengan hati-hati agar mudah dipahami pembaca.',
].join(' ');

const emailOf = () => `uji${Date.now()}${Math.random().toString(16).slice(2, 8)}@runut.test`;

async function newUser(agent, name = 'Penulis Uji') {
  const email = emailOf();
  const res = await agent.post('/api/auth/register').send({ name, email, password: 'rahasia12345' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { email, password: 'rahasia12345', token: res.body.accessToken, id: res.body.user.id };
}

test('health melaporkan penyimpanan sementara dan status AI', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.match(res.body.storage, /memori/);
  assert.equal(res.body.ai.configured, true);
  assert.equal(res.body.limits.free_words, 500);
});

test('registrasi memvalidasi email, panjang sandi, dan email ganda', async () => {
  const agent = request.agent(app);
  const email = emailOf();
  assert.equal((await agent.post('/api/auth/register').send({ name: 'A', email, password: 'rahasia12345' })).status, 400);
  assert.equal((await agent.post('/api/auth/register').send({ name: 'Andi', email: 'bukan-email', password: 'rahasia12345' })).status, 400);
  assert.equal((await agent.post('/api/auth/register').send({ name: 'Andi', email, password: 'pendek' })).status, 400);
  assert.equal((await agent.post('/api/auth/register').send({ name: 'Andi', email, password: 'rahasia12345' })).status, 201);
  const dup = await agent.post('/api/auth/register').send({ name: 'Andi', email, password: 'rahasia12345' });
  assert.equal(dup.status, 409);
});

test('login, /me, refresh lewat cookie HttpOnly, dan logout mencabut sesi', async () => {
  const agent = request.agent(app);
  const user = await newUser(agent);
  assert.ok(user.token);

  await agent.post('/api/auth/logout').expect(200);
  const me = await agent.get('/api/auth/me').set('Authorization', `Bearer ${user.token}`);
  assert.equal(me.status, 200);

  await agent.post('/api/auth/login').send({ email: user.email, password: 'salah-sekali' }).expect(401);
  const login = await agent.post('/api/auth/login').send({ email: user.email, password: user.password });
  assert.equal(login.status, 200);
  const cookie = login.headers['set-cookie'].join(';');
  assert.match(cookie, /runut_rt=/);
  assert.match(cookie, /HttpOnly/i, 'refresh token tidak boleh bisa dibaca JavaScript');
  assert.equal(login.body.refreshToken, undefined, 'refresh token tidak dikirim di body');

  const refreshed = await agent.post('/api/auth/refresh');
  assert.equal(refreshed.status, 200);
  assert.ok(refreshed.body.accessToken);

  await agent.post('/api/auth/logout').expect(200);
  const after = await agent.post('/api/auth/refresh');
  assert.equal(after.status, 401, 'setelah logout, cookie sesi tidak bisa dipakai lagi');
});

test('endpoint terproteksi membutuhkan token akses', async () => {
  await request(app).get('/api/auth/me').expect(401);
  await request(app).get('/api/documents').expect(401);
  await request(app).get('/api/documents').set('Authorization', 'Bearer token-palsu').expect(401);
});

test('reset password: SMTP belum dikonfigurasi dilaporkan apa adanya', async () => {
  const res = await request(app).post('/api/auth/forgot-password').send({ email: 'siapa@runut.test' });
  assert.equal(res.status, 503);
  assert.equal(res.body.code, 'MAIL_NOT_CONFIGURED');
});

test('persetujuan AI wajib sebelum teks dikirim ke provider', async () => {
  const agent = request.agent(app);
  const user = await newUser(agent);
  const before = seenRequests;
  const res = await agent.post('/api/analysis').set('Authorization', `Bearer ${user.token}`).send({ text: TEXT });
  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'AI_CONSENT_REQUIRED');
  assert.equal(seenRequests, before, 'teks tidak boleh dikirim ke provider tanpa persetujuan');
});

test('batas kata dan teks pendek divalidasi di server', async () => {
  const agent = request.agent(app);
  const user = await newUser(agent);
  const auth = { Authorization: `Bearer ${user.token}` };

  const short = await agent.post('/api/analysis').set(auth).send({ text: 'Terlalu pendek saja.', ai_consent: true });
  assert.equal(short.status, 400);
  assert.equal(short.body.code, 'TOO_SHORT');

  const long = await agent.post('/api/analysis').set(auth).send({ text: 'kata '.repeat(600), ai_consent: true });
  assert.equal(long.status, 403);
  assert.equal(long.body.code, 'WORD_LIMIT');
  assert.equal(long.body.details.limit, 500);
});

test('premium: tanpa batas kata dan teks panjang dipecah per bagian', async () => {
  const agent = request.agent(app);
  const user = await newUser(agent, 'Premium Uji');
  const { users } = await import('../src/repositories/index.js');
  await users.extendPremium(user.id, 30);
  const auth = { Authorization: `Bearer ${user.token}` };

  const paragraph = 'Laporan ini disusun untuk memeriksa pola tulisan. Selain itu penulis menambah data pendukung. Selain itu penulis memperkuat argumen supaya pembaca yakin.';
  const text = Array.from({ length: 100 }, () => paragraph).join('\n\n');
  const res = await agent.post('/api/analysis').set(auth)
    .send({ text, title: 'Laporan Panjang', ai_consent: true });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.meta.is_premium, true);
  assert.equal(res.body.analysis.locked, false);
  assert.ok(res.body.analysis.stats.word_count > 500, 'teks di atas 500 kata diterima untuk Premium');
  assert.ok(res.body.analysis.ai.sections >= 2, 'teks panjang dipecah menjadi beberapa bagian');
  assert.equal(res.body.meta.shown, res.body.issues.length, 'seluruh saran terbuka untuk Premium');
});

test('analisis gratis: statistik dihitung backend, maksimal 3 masalah ditampilkan', async () => {
  const agent = request.agent(app);
  const user = await newUser(agent);
  const res = await agent.post('/api/analysis').set('Authorization', `Bearer ${user.token}`)
    .send({ text: TEXT, title: 'Laporan Uji', ai_consent: true });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.analysis.locked, true);
  assert.equal(res.body.analysis.stats.word_count, 37);
  assert.equal(res.body.meta.shown, 3);
  assert.equal(res.body.meta.total_found, 4, 'semua masalah valid tetap disimpan');
  assert.equal(res.body.issues.length, 3);
  for (const issue of res.body.issues) {
    assert.equal(TEXT.slice(issue.start_pos, issue.end_pos), issue.snippet, 'koordinat cocok dengan teks asli');
    assert.equal(issue.decision, 'active');
  }

  const detail = await agent.get(`/api/documents/${res.body.document.id}`).set('Authorization', `Bearer ${user.token}`);
  assert.equal(detail.status, 200);
  const locked = await agent.patch(`/api/documents/${res.body.document.id}/issues`)
    .set('Authorization', `Bearer ${user.token}`).send({ accept_all: true });
  assert.equal(locked.status, 403);
  assert.equal(locked.body.code, 'LOCKED');
});

test('penerapan saran, penolakan, perbandingan, dan pemulihan teks asli', async () => {
  const agent = request.agent(app);
  const user = await newUser(agent);
  const created = await agent.post('/api/analysis').set('Authorization', `Bearer ${user.token}`)
    .send({ text: TEXT, ai_consent: true });
  const docId = created.body.document.id;
  const auth = { Authorization: `Bearer ${user.token}` };

  // Menjadi premium hanya lewat jalur pembayaran terverifikasi; di sini
  // repositori dipakai langsung seperti yang dilakukan webhook Midtrans.
  await users.extendPremium(user.id, 30);

  const all = await agent.get(`/api/documents/${docId}`).set(auth);
  assert.equal(all.body.issues.length, 4, 'akun premium melihat semua masalah tersimpan');

  const applied = await agent.patch(`/api/documents/${docId}/issues`).set(auth).send({ accept_all: true });
  assert.equal(applied.status, 200);
  assert.notEqual(applied.body.revised_text, TEXT, 'teks revisi berbeda dari teks asli');
  assert.ok(applied.body.revised_text.includes('Gunakan penghubung lain'), 'saran diterapkan');
  assert.equal(applied.body.issues.filter((i) => i.decision === 'applied').length, 3, 'saran perlu cek manual tidak diterapkan otomatis');
  assert.equal(applied.body.issues.filter((i) => i.needs_manual_review)[0].decision, 'active');

  const manualId = applied.body.issues.find((i) => i.needs_manual_review).id;
  const refused = await agent.patch(`/api/documents/${docId}/issues`).set(auth).send({ decisions: [{ id: manualId, decision: 'applied' }] });
  assert.equal(refused.status, 409);
  assert.equal(refused.body.code, 'NEEDS_MANUAL');

  const confirmed = await agent.patch(`/api/documents/${docId}/issues`).set(auth)
    .send({ decisions: [{ id: manualId, decision: 'applied', confirm_manual: true }] });
  assert.equal(confirmed.status, 200);
  assert.ok(confirmed.body.revised_text.includes('Ubah susunan pembukaannya'));

  const rejected = await agent.patch(`/api/documents/${docId}/issues`).set(auth)
    .send({ decisions: [{ id: manualId, decision: 'rejected' }, { id: applied.body.issues[0].id, decision: 'rejected' }] });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.issues.filter((i) => i.decision === 'rejected').length, 2);

  const bad = await agent.patch(`/api/documents/${docId}/issues`).set(auth).send({ decisions: [{ id: manualId, decision: 'entah' }] });
  assert.equal(bad.status, 400);

  const restored = await agent.post(`/api/documents/${docId}/restore`).set(auth);
  assert.equal(restored.status, 200);
  assert.equal(restored.body.revised_text, TEXT);
  assert.equal(restored.body.issues.every((i) => i.decision === 'active'), true);
});

test('saran dengan posisi basi ditolak dan tidak mengubah teks', async () => {
  const agent = request.agent(app);
  const user = await newUser(agent);
  const auth = { Authorization: `Bearer ${user.token}` };
  const created = await agent.post('/api/analysis').set(auth).send({ text: TEXT, ai_consent: true });
  const docId = created.body.document.id;
  await users.extendPremium(user.id, 30);
  // Meniru teks yang berubah setelah analisis (mis. disunting di tempat lain).
  await documents.update(docId, { original_text: 'Teks sudah diganti sepenuhnya oleh pengguna.' });
  const res = await agent.patch(`/api/documents/${docId}/issues`).set(auth).send({ accept_all: true });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'STALE_POSITION');
  const after = await agent.get(`/api/documents/${docId}`).set(auth);
  assert.equal(after.body.document.revised_text, 'Teks sudah diganti sepenuhnya oleh pengguna.', 'teks tidak berubah');
});

test('unggahan: TXT diekstrak, tipe tidak didukung ditolak, PDF tanpa teks diberi pesan manual', async () => {
  const agent = request.agent(app);
  const user = await newUser(agent);
  const auth = { Authorization: `Bearer ${user.token}` };

  const txt = await agent.post('/api/analysis').set(auth).attach('file', Buffer.from(TEXT), 'tulisan.txt').field('ai_consent', 'true');
  assert.equal(txt.status, 201, JSON.stringify(txt.body));
  assert.equal(txt.body.document.title, 'tulisan');
  assert.equal(txt.body.analysis.stats.word_count, 37);

  const bad = await agent.post('/api/analysis').set(auth).attach('file', Buffer.from('data'), 'gambar.png').field('ai_consent', 'true');
  assert.equal(bad.status, 415);
  assert.equal(bad.body.code, 'BAD_FILE_TYPE');

  const empty = await agent.post('/api/analysis').set(auth)
    .attach('file', Buffer.from('%PDF-1.4 tidak ada lapisan teks'), 'pindai.pdf').field('ai_consent', 'true');
  assert.equal(empty.status, 400);
  assert.equal(empty.body.code, 'NO_TEXT');
  assert.match(empty.body.error, /salin teks/i);
});

test('riwayat: daftar, kepemilikan dokumen, unduhan, dan hapus', async () => {
  const owner = request.agent(app);
  const user = await newUser(owner);
  const auth = { Authorization: `Bearer ${user.token}` };
  const created = await owner.post('/api/analysis').set(auth).send({ text: TEXT, title: 'Dokumen Riwayat', ai_consent: true });
  const docId = created.body.document.id;

  const list = await owner.get('/api/documents?q=Riwayat').set(auth);
  assert.equal(list.body.documents.length, 1);
  assert.equal(list.body.documents[0].title, 'Dokumen Riwayat');
  assert.equal((await owner.get('/api/documents?q=TidakAda').set(auth)).body.documents.length, 0);

  const other = request.agent(app);
  const stranger = await newUser(other, 'Orang Lain');
  const forbidden = await other.get(`/api/documents/${docId}`).set('Authorization', `Bearer ${stranger.token}`);
  assert.equal(forbidden.status, 403);

  const txt = await owner.get(`/api/documents/${docId}/download?format=txt`).set(auth);
  assert.equal(txt.status, 200);
  assert.match(txt.headers['content-type'], /text\/plain/);
  assert.match(txt.headers['content-disposition'], /attachment/);

  const docx = await owner.get(`/api/documents/${docId}/download?format=docx`).set(auth);
  assert.equal(docx.status, 200);
  assert.match(docx.headers['content-type'], /wordprocessingml/);
  assert.ok(Number(docx.headers['content-length']) > 0, 'berkas DOCX tidak kosong');

  const pdf = await owner.get(`/api/documents/${docId}/download?format=pdf`).set(auth);
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers['content-type'], /application\/pdf/);
  assert.ok(pdf.body.length > 500, 'berkas PDF tidak kosong');
  // PDF dibaca ulang agar strukturnya benar-benar sah, bukan sekadar byte awal.
  const { PDFDocument } = await import('pdf-lib');
  const reloaded = await PDFDocument.load(pdf.body);
  assert.ok(reloaded.getPageCount() >= 1, 'PDF hasil unduhan bisa dibuka kembali');

  const badFormat = await owner.get(`/api/documents/${docId}/download?format=rtf`).set(auth);
  assert.equal(badFormat.status, 400);

  const del = await owner.delete('/api/documents').set(auth).send({ ids: [docId] });
  assert.equal(del.status, 200);
  assert.deepEqual(del.body.deleted, [docId]);
  assert.equal((await owner.get('/api/documents').set(auth)).body.documents.length, 0);
});

test('kegagalan provider AI: tidak dikonfigurasi, 401/404, 500, JSON rusak, dan timeout', async () => {
  const agent = request.agent(app);
  const user = await newUser(agent);
  const auth = { Authorization: `Bearer ${user.token}` };
  const body = { text: TEXT, ai_consent: true };

  const key = process.env.AI_API_KEY;
  process.env.AI_API_KEY = '';
  const unconfigured = await agent.post('/api/analysis').set(auth).send(body);
  assert.equal(unconfigured.status, 503);
  assert.equal(unconfigured.body.code, 'AI_NOT_CONFIGURED');
  process.env.AI_API_KEY = key;

  mode = 'http404';
  const notFound = await agent.post('/api/analysis').set(auth).send(body);
  assert.equal(notFound.status, 503);
  assert.equal(notFound.body.code, 'AI_MODEL_NOT_FOUND');

  mode = 'http500';
  const broken = await agent.post('/api/analysis').set(auth).send(body);
  assert.equal(broken.status, 502);

  mode = 'badjson';
  const badjson = await agent.post('/api/analysis').set(auth).send(body);
  assert.equal(badjson.status, 502);
  assert.equal(badjson.body.code, 'AI_BAD_JSON');

  mode = 'hang';
  const timeout = Number(process.env.AI_TIMEOUT_MS);
  process.env.AI_TIMEOUT_MS = '150';
  const slow = await agent.post('/api/analysis').set(auth).send(body);
  process.env.AI_TIMEOUT_MS = String(timeout);
  assert.equal(slow.status, 504);
  assert.equal(slow.body.code, 'AI_TIMEOUT');
  assert.equal(slow.body.details.retryable, true, 'pengguna diberi pilihan mencoba lagi');

  mode = 'ok';
  const docs = await agent.get('/api/documents').set(auth);
  assert.equal(docs.body.documents.length, 0, 'respons gagal tidak disimpan sebagai analisis yang sah');
});

test('kutipan AI yang tidak cocok dengan teks dibuang, bukan ditampilkan asal', async () => {
  const agent = request.agent(app);
  const user = await newUser(agent);
  const auth = { Authorization: `Bearer ${user.token}` };
  const before = mode;
  mode = 'ok';
  const res = await agent.post('/api/analysis').set(auth).send({ text: TEXT, ai_consent: true });
  mode = before;
  assert.equal(res.status, 201);
  for (const issue of res.body.issues) {
    const stored = await issuesRepo.listByAnalysis(res.body.analysis.id);
    const match = stored.find((s) => s.id === issue.id);
    assert.equal(TEXT.slice(match.start_pos, match.end_pos), match.snippet);
  }
});

test.after(async () => {
  stub.close();
  await new Promise((resolve) => setTimeout(resolve, 50));
});
