import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import request from 'supertest';

// Stub Midtrans Core API (QRIS): server HTTP nyata supaya jalur
// /v2/charge, /v2/:order/status, dan gambar QR diuji sungguhan.
const SERVER_KEY = 'SB-Mid-server-uji';
const PRICE = 25000;
const AUTH = `Basic ${Buffer.from(SERVER_KEY + ':').toString('base64')}`;
const QR_BYTES = Buffer.from('89504e470d0a1a0a-qr-png-uji', 'hex');

let chargeCount = 0;
let chargeBody = null;
let statusFor = 'settlement'; // status yang dikembalikan endpoint status Midtrans

const midtrans = http.createServer((req, res) => {
  assert.equal(req.headers.authorization, AUTH, 'server key dikirim sebagai Basic auth');
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'POST' && url.pathname === '/v2/charge') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      chargeCount++;
      chargeBody = JSON.parse(body);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        status_code: '201',
        status_message: 'QRIS transaction is created',
        transaction_id: 'trx-uji-1',
        order_id: chargeBody.transaction_details.order_id,
        gross_amount: `${chargeBody.transaction_details.gross_amount}.00`,
        payment_type: 'qris',
        transaction_status: 'pending',
        fraud_status: 'accept',
        expiry_time: '2030-01-01 00:00:00',
        actions: [{ name: 'generate-qr-code', method: 'GET', url: `http://127.0.0.1:${midtrans.address().port}/v2/qris/trx-uji-1/qr-code` }],
      }));
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/v2/qris/trx-uji-1/qr-code') {
    res.writeHead(200, { 'content-type': 'image/png' });
    return res.end(QR_BYTES);
  }

  const statusMatch = url.pathname.match(/^\/v2\/(.+)\/status$/);
  if (req.method === 'GET' && statusMatch) {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({
      transaction_id: 'trx-uji-1',
      order_id: decodeURIComponent(statusMatch[1]),
      gross_amount: `${PRICE}.00`,
      transaction_status: statusFor,
      fraud_status: 'accept',
      status_code: '200',
      settlement_time: statusFor === 'settlement' ? '2030-01-01 00:05:00' : undefined,
    }));
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end('{"status_message":"not found"}');
});
await new Promise((resolve) => midtrans.listen(0, '127.0.0.1', resolve));
const midtransBase = `http://127.0.0.1:${midtrans.address().port}`;

process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_AUTH_MAX = '1000';
process.env.JWT_ACCESS_SECRET = 'test-secret-pembayaran-cukup-panjang-32';
process.env.AI_BASE_URL = 'http://127.0.0.1:1/v1';
process.env.AI_API_KEY = '';
process.env.AI_MODEL = '';
process.env.MIDTRANS_API_BASE = midtransBase;
process.env.MIDTRANS_SERVER_KEY = SERVER_KEY;
process.env.MIDTRANS_IS_PRODUCTION = 'false';
process.env.PREMIUM_PRICE_IDR = String(PRICE);
process.env.PREMIUM_DURATION_DAYS = '30';
delete process.env.MAIL_HOST;

const { createApp } = await import('../src/app.js');
const { users } = await import('../src/repositories/index.js');
const app = createApp();

const emailOf = () => `bayar${Date.now()}${Math.random().toString(16).slice(2, 8)}@runut.test`;

async function newUser(agent) {
  const email = emailOf();
  const res = await agent.post('/api/auth/register').send({ name: 'Pembeli Uji', email, password: 'rahasia12345' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { agent, token: res.body.accessToken, id: res.body.user.id };
}

const signature = (orderId, statusCode, gross) =>
  crypto.createHash('sha512').update(`${orderId}${statusCode}${gross}${SERVER_KEY}`).digest('hex');

test('QRIS: transaksi dibuat dari tarif server, bukan angka kiriman klien', async () => {
  const agent = request.agent(app);
  const user = await newUser(agent);
  const res = await agent.post('/api/payments').set('Authorization', `Bearer ${user.token}`).send({ amount: 1, gross_amount: 1 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(chargeCount, 1);
  assert.equal(chargeBody.payment_type, 'qris');
  assert.equal(chargeBody.transaction_details.gross_amount, PRICE, 'nominal berasal dari PREMIUM_PRICE_IDR');
  assert.equal(chargeBody.qris.acquirer, 'gopay');
  assert.equal(res.body.payment.status, 'pending');
  assert.equal(res.body.payment.amount, PRICE);
  assert.equal(res.body.payment.qr_available, true);
  assert.equal(res.body.payment.expiry_time, '2030-01-01 00:00:00');
  assert.equal(res.body.payment.is_production, false);
  assert.ok(res.body.payment.order_id.startsWith('RUNUT-'));
});

test('QRIS: gambar QR diteruskan apa adanya; transaksi orang lain ditolak', async () => {
  const agent = request.agent(app);
  const user = await newUser(agent);
  const created = await agent.post('/api/payments').set('Authorization', `Bearer ${user.token}`).send({});
  const orderId = created.body.payment.order_id;
  const auth = { Authorization: `Bearer ${user.token}` };

  const qr = await agent.get(`/api/payments/${orderId}/qr`).set(auth);
  assert.equal(qr.status, 200);
  assert.equal(qr.headers['content-type'], 'image/png');
  assert.ok(Buffer.isBuffer(qr.body) && qr.body.length === QR_BYTES.length, 'byte gambar dari Midtrans diteruskan');

  const other = await newUser(request.agent(app));
  const denied = await agent.get(`/api/payments/${orderId}/status`).set({ Authorization: `Bearer ${other.token}` });
  assert.equal(denied.status, 403);
});

test('QRIS: notifikasi tanpa signature sah ditolak', async () => {
  const agent = request.agent(app);
  const user = await newUser(agent);
  const created = await agent.post('/api/payments').set('Authorization', `Bearer ${user.token}`).send({});
  const orderId = created.body.payment.order_id;

  const bad = await request(app).post('/api/payments/notify').send({
    order_id: orderId, status_code: '200', gross_amount: `${PRICE}.00`, signature_key: 'palsu', transaction_status: 'settlement',
  });
  assert.equal(bad.status, 403);
  assert.equal(bad.body.code, 'BAD_SIGNATURE');

  const mismatch = await request(app).post('/api/payments/notify').send({
    order_id: orderId, status_code: '200', gross_amount: '1.00',
    signature_key: signature(orderId, '200', '1.00'), transaction_status: 'settlement',
  });
  assert.equal(mismatch.status, 400);
  assert.equal(mismatch.body.code, 'AMOUNT_MISMATCH');
});

test('QRIS: periksa status, premium aktif sekali walau notifikasi diulang', async () => {
  const agent = request.agent(app);
  const user = await newUser(agent);
  const auth = { Authorization: `Bearer ${user.token}` };
  const created = await agent.post('/api/payments').set('Authorization', `Bearer ${user.token}`).send({});
  const orderId = created.body.payment.order_id;

  const meBefore = await agent.get('/api/auth/me').set(auth);
  assert.equal(meBefore.body.user.is_premium, false);

  statusFor = 'settlement';
  const checked = await agent.get(`/api/payments/${orderId}/status`).set(auth);
  assert.equal(checked.status, 200);
  assert.equal(checked.body.payment.status, 'success');
  assert.ok(checked.body.payment.paid_at);

  const meAfter = await agent.get('/api/auth/me').set(auth);
  assert.equal(meAfter.body.user.is_premium, true);
  const until = meAfter.body.user.premium_until;

  // Notifikasi sukses yang sama dikirim ulang: tidak boleh menambah masa premium.
  const notify = await request(app).post('/api/payments/notify').send({
    order_id: orderId, status_code: '200', gross_amount: `${PRICE}.00`,
    signature_key: signature(orderId, '200', `${PRICE}.00`), transaction_status: 'settlement', fraud_status: 'accept',
  });
  assert.equal(notify.status, 200);
  assert.equal(notify.body.ok, true);

  const meAgain = await agent.get('/api/auth/me').set(auth);
  assert.equal(meAgain.body.user.premium_until, until, 'masa premium tidak digandakan');
});

test('QRIS: transaksi kedaluwarsa dan dibatalkan dibedakan dari gagal', async () => {
  const agent = request.agent(app);
  const user = await newUser(agent);
  const auth = { Authorization: `Bearer ${user.token}` };
  const created = await agent.post('/api/payments').set('Authorization', `Bearer ${user.token}`).send({});
  const orderId = created.body.payment.order_id;

  statusFor = 'expire';
  const expired = await agent.get(`/api/payments/${orderId}/status`).set(auth);
  assert.equal(expired.body.payment.status, 'expired');

  statusFor = 'deny';
  const denied = await agent.get(`/api/payments/${orderId}/status`).set(auth);
  assert.equal(denied.body.payment.status, 'failed');

  const me = await agent.get('/api/auth/me').set(auth);
  assert.equal(me.body.user.is_premium, false, 'transaksi gagal tidak mengaktifkan premium');

  const list = await agent.get('/api/payments').set(auth);
  assert.equal(list.status, 200);
  assert.equal(list.body.payments.length, 1);
});

test.after(() => midtrans.close());
