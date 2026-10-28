import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import request from 'supertest';

// Webhook: satu-satunya jalur yang boleh menandai lunas tanpa interaksi
// pengguna. Kuncinya wajib diverifikasi; tanpa kunci gateway, notifikasi
// ditolak (tidak ada jalur "lunas" tanpa verifikasi).
process.env.NODE_ENV = 'test';
process.env.DEMO_PREMIUM = '';
process.env.MIDTRANS_SERVER_KEY = 'server-key-uji-untuk-tanda-tangan';
process.env.RATE_LIMIT_AUTH_MAX = '1000';
process.env.JWT_ACCESS_SECRET = 'test-secret-yang-cukup-panjang-32-karakter';

const { createApp } = await import('../src/app.js');
const { payments } = await import('../src/repositories/index.js');
const app = createApp();

const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
const sign = (orderId, statusCode, gross) => createHash('sha512')
  .update(`${orderId}${statusCode}${gross}${SERVER_KEY}`)
  .digest('hex');

async function newUser() {
  const agent = request.agent(app);
  const email = `notif${Date.now()}${Math.random().toString(16).slice(2, 8)}@runut.test`;
  const res = await agent.post('/api/auth/register').send({ name: 'Notif Uji', email, password: 'rahasia12345' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { agent, userId: res.body.user.id, auth: { Authorization: `Bearer ${res.body.accessToken}` } };
}

async function seedPayment(orderId, userId) {
  return payments.create({
    user_id: userId,
    order_id: orderId,
    method: 'qris',
    method_label: 'QRIS',
    channel: 'qris',
    amount: 49000,
    status: 'pending',
    provider: 'midtrans',
    provider_ref: null,
    instructions: { qr_url: 'https://example.test/qr.png' },
    premium_days: 30,
    expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
  });
}

test('notifikasi tanpa tanda tangan sah ditolak', async () => {
  const { userId } = await newUser();
  const orderId = 'RUNUT-NOTIF-BAD';
  await seedPayment(orderId, userId);

  const forged = await request(app).post('/api/payments/notify').send({
    order_id: orderId,
    transaction_status: 'settlement',
    status_code: '200',
    gross_amount: '49000.00',
    signature_key: 'palsu',
  });
  assert.equal(forged.status, 403, JSON.stringify(forged.body));
  assert.equal(forged.body.code, 'INVALID_SIGNATURE');

  const row = await payments.findByOrderId(orderId);
  assert.equal(row.status, 'pending', 'transaksi tidak berubah oleh notifikasi palsu');
});

test('nominal notifikasi harus sama dengan tagihan', async () => {
  const { userId } = await newUser();
  const orderId = 'RUNUT-NOTIF-AMOUNT';
  await seedPayment(orderId, userId);

  const wrongAmount = '1000.00';
  const res = await request(app).post('/api/payments/notify').send({
    order_id: orderId,
    transaction_status: 'settlement',
    status_code: '200',
    gross_amount: wrongAmount,
    signature_key: sign(orderId, '200', wrongAmount),
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'AMOUNT_MISMATCH');
  assert.equal((await payments.findByOrderId(orderId)).status, 'pending');
});

test('notifikasi sah melunasi transaksi dan mengaktifkan Premium sekali', async () => {
  const { agent, userId, auth } = await newUser();
  const orderId = 'RUNUT-NOTIF-OK';
  await seedPayment(orderId, userId);

  const body = {
    order_id: orderId,
    transaction_status: 'settlement',
    status_code: '200',
    gross_amount: '49000.00',
    transaction_id: 'midtrans-123',
    signature_key: sign(orderId, '200', '49000.00'),
  };
  const res = await request(app).post('/api/payments/notify').send(body);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.status, 'paid');

  const me = await agent.get('/api/auth/me').set(auth);
  assert.equal(me.body.user.is_premium, true);
  const until = me.body.user.premium_until;

  // Notifikasi ulang dari gateway tidak boleh menambah masa aktif.
  const repeat = await request(app).post('/api/payments/notify').send(body);
  assert.equal(repeat.status, 200);
  const me2 = await agent.get('/api/auth/me').set(auth);
  assert.equal(me2.body.user.premium_until, until);
});

test('notifikasi "expire" menutup transaksi tanpa mengaktifkan Premium', async () => {
  const { agent, userId, auth } = await newUser();
  const orderId = 'RUNUT-NOTIF-EXPIRE';
  await seedPayment(orderId, userId);

  const res = await request(app).post('/api/payments/notify').send({
    order_id: orderId,
    transaction_status: 'expire',
    status_code: '407',
    gross_amount: '49000.00',
    signature_key: sign(orderId, '407', '49000.00'),
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'expired');
  const me = await agent.get('/api/auth/me').set(auth);
  assert.equal(me.body.user.is_premium, false);
});
