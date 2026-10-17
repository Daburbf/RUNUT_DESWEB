import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

// Pembayaran SENGAJA dinonaktifkan: halaman Premium hanya menampilkan paket dan
// metode sebagai gambaran. Berkas ini mengunci kontrak itu - tidak ada endpoint
// pembayaran yang bisa membuat transaksi atau mengaktifkan Premium.
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_AUTH_MAX = '1000';
process.env.JWT_ACCESS_SECRET = 'test-secret-yang-cukup-panjang-32-karakter';

const { createApp } = await import('../src/app.js');
const app = createApp();

const emailOf = () => `bayar${Date.now()}${Math.random().toString(16).slice(2, 8)}@runut.test`;

async function newUser(agent) {
  const res = await agent.post('/api/auth/register')
    .send({ name: 'Pembayar Uji', email: emailOf(), password: 'rahasia12345' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { token: res.body.accessToken, id: res.body.user.id };
}

test('semua endpoint pembayaran menjawab 501 dan tidak mengaktifkan Premium', async () => {
  const agent = request.agent(app);
  const user = await newUser(agent);
  const auth = { Authorization: `Bearer ${user.token}` };

  const created = await agent.post('/api/payments').set(auth).send({ amount: 1 });
  assert.equal(created.status, 501, JSON.stringify(created.body));
  assert.equal(created.body.code, 'PAYMENTS_DISABLED');

  assert.equal((await agent.get('/api/payments').set(auth)).status, 501);
  assert.equal((await agent.get('/api/payments/ORDER-1/qr').set(auth)).status, 501);
  assert.equal((await agent.get('/api/payments/ORDER-1/status').set(auth)).status, 501);
  assert.equal((await request(app).post('/api/payments/notify').send({ order_id: 'ORDER-1', signature_key: 'apa saja' })).status, 501);

  const me = await agent.get('/api/auth/me').set(auth);
  assert.equal(me.body.user.is_premium, false, 'premium tidak bisa diaktifkan lewat HTTP');
});

test('health menampilkan harga Premium sebagai tampilan saja', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.premium.available, false);
  assert.equal(res.body.premium.price_idr, 49000, 'harga seragam dengan footer website');
  assert.equal(res.body.premium.duration_days, 30);
});
