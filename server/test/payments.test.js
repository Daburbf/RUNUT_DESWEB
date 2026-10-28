import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

// Payment gateway: satu jalur, semua nominal dari server. Mode simulasi dipakai
// di pengujian karena tidak ada MIDTRANS_SERVER_KEY - alur nyata tetap satu
// kode yang sama (services/payments.js), hanya panggilan gateway yang diganti.
process.env.NODE_ENV = 'test';
process.env.DEMO_PREMIUM = '';
process.env.MIDTRANS_SERVER_KEY = '';
process.env.RATE_LIMIT_AUTH_MAX = '1000';
process.env.JWT_ACCESS_SECRET = 'test-secret-yang-cukup-panjang-32-karakter';

const { createApp } = await import('../src/app.js');
const app = createApp();

const emailOf = () => `bayar${Date.now()}${Math.random().toString(16).slice(2, 8)}@runut.test`;

async function newUser(agent) {
  const res = await agent.post('/api/auth/register')
    .send({ name: 'Pembayar Uji', email: emailOf(), password: 'rahasia12345' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { token: res.body.accessToken, id: res.body.user.id, auth: { Authorization: `Bearer ${res.body.accessToken}` } };
}

test('health & katalog: harga dan metode datang dari server', async () => {
  const health = await request(app).get('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.premium.price_idr, 49000, 'harga seragam dengan footer website');
  assert.equal(health.body.premium.duration_days, 30);
  assert.equal(health.body.premium.available, true, 'tanpa kunci gateway di luar produksi = mode simulasi');
  assert.equal(health.body.premium.mode, 'simulator');
  assert.equal(health.body.limits.free_words, 500);
  assert.equal(health.body.limits.premium_words, null, 'Premium tanpa batas kata');

  const agent = request.agent(app);
  const user = await newUser(agent);
  const res = await agent.get('/api/payments').set(user.auth);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.available, true);
  assert.equal(res.body.mode, 'simulator');
  assert.equal(res.body.price_idr, 49000);
  assert.ok(res.body.methods.length >= 8, 'metode pembayaran lengkap');
  assert.deepEqual(res.body.orders, []);
  const ids = res.body.methods.map((m) => m.id);
  for (const id of ['qris', 'va_bca', 'gopay', 'card', 'alfamart']) {
    assert.ok(ids.includes(id), `metode ${id} tersedia`);
  }
});

test('alur bayar: nominal dari server, lunas mengaktifkan Premium sekali saja', async () => {
  const agent = request.agent(app);
  const user = await newUser(agent);

  // Nominal dari klien diabaikan sepenuhnya.
  const created = await agent.post('/api/payments').set(user.auth).send({ method: 'va_bca', amount: 1 });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const pay = created.body.payment;
  assert.match(pay.order_id, /^RUNUT-/);
  assert.equal(pay.amount, 49000, 'nominal selalu dari konfigurasi server');
  assert.equal(pay.status, 'pending');
  assert.equal(pay.method, 'va_bca');
  assert.ok(pay.instructions.va_number, 'nomor virtual account dikirim ke pengguna');
  assert.ok(pay.expires_at, 'masa berlaku transaksi ada');

  const status = await agent.get(`/api/payments/${pay.order_id}`).set(user.auth);
  assert.equal(status.status, 200);
  assert.equal(status.body.payment.status, 'pending');

  const paid = await agent.post(`/api/payments/${pay.order_id}/simulate`).set(user.auth).send({});
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  assert.equal(paid.body.payment.status, 'paid');

  const me = await agent.get('/api/auth/me').set(user.auth);
  assert.equal(me.body.user.is_premium, true);
  const until = me.body.user.premium_until;

  // Idempoten: menandai lunas dua kali tidak menambah masa aktif.
  const again = await agent.post(`/api/payments/${pay.order_id}/simulate`).set(user.auth).send({});
  assert.equal(again.body.payment.status, 'paid');
  const me2 = await agent.get('/api/auth/me').set(user.auth);
  assert.equal(me2.body.user.premium_until, until, 'masa aktif tidak bertambah dua kali');

  const list = await agent.get('/api/payments').set(user.auth);
  assert.equal(list.body.orders.length, 1);
  assert.equal(list.body.orders[0].status, 'paid');

  const invoice = await agent.get(`/api/payments/${pay.order_id}/invoice`).set(user.auth);
  assert.equal(invoice.status, 200);
  assert.match(invoice.headers['content-type'], /application\/pdf/);
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.load(invoice.body);
  assert.ok(pdf.getPageCount() >= 1, 'invoice bisa dibuka sebagai PDF');
});

test('validasi: metode asing ditolak, QR asli tidak dikarang, akun Premium tidak bisa beli lagi', async () => {
  const agent = request.agent(app);
  const user = await newUser(agent);

  const bad = await agent.post('/api/payments').set(user.auth).send({ method: 'bitcoin' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, 'METHOD_INVALID');

  const empty = await agent.post('/api/payments').set(user.auth).send({});
  assert.equal(empty.status, 400);
  assert.equal(empty.body.code, 'METHOD_INVALID');

  const qris = await agent.post('/api/payments').set(user.auth).send({ method: 'qris' });
  assert.equal(qris.status, 201);
  // Mode simulasi tidak berpura-pura punya QRIS; gambarnya tidak tersedia.
  const qr = await agent.get(`/api/payments/${qris.body.payment.order_id}/qr`).set(user.auth);
  assert.equal(qr.status, 404);
  assert.equal(qr.body.code, 'QR_UNAVAILABLE');

  await agent.post(`/api/payments/${qris.body.payment.order_id}/simulate`).set(user.auth).send({});
  const second = await agent.post('/api/payments').set(user.auth).send({ method: 'gopay' });
  assert.equal(second.status, 409);
  assert.equal(second.body.code, 'ALREADY_PREMIUM');
});

test('transaksi milik akun lain tidak bisa dibaca atau dilunasi', async () => {
  const owner = request.agent(app);
  const mine = await newUser(owner);
  const created = await owner.post('/api/payments').set(mine.auth).send({ method: 'alfamart' });
  assert.equal(created.status, 201);
  const orderId = created.body.payment.order_id;
  assert.ok(created.body.payment.instructions.payment_code, 'kode bayar minimarket tersedia');

  const other = request.agent(app);
  const stranger = await newUser(other);
  const read = await other.get(`/api/payments/${orderId}`).set(stranger.auth);
  assert.equal(read.status, 403);
  const pay = await other.post(`/api/payments/${orderId}/simulate`).set(stranger.auth).send({});
  assert.equal(pay.status, 403);
  assert.equal((await other.get(`/api/payments/${orderId}/invoice`).set(stranger.auth)).status, 403);

  const missing = await owner.get('/api/payments/RUNUT-TIDAK-ADA').set(mine.auth);
  assert.equal(missing.status, 404);
  assert.equal(missing.body.code, 'ORDER_NOT_FOUND');
});
