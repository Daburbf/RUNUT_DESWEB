import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

// Alur simulasi QRIS sudah dihapus bersama fitur pembayaran. Yang tersisa hanya
// satu hal yang perlu dijaga: webhook tidak memproses apa pun - tidak ada
// signature yang bisa dipalsukan untuk menandai transaksi lunas.
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-secret-yang-cukup-panjang-32-karakter';

const { createApp } = await import('../src/app.js');
const app = createApp();

test('webhook pembayaran tidak memproses notifikasi apa pun', async () => {
  const res = await request(app).post('/api/payments/notify').send({
    order_id: 'SIMULASI-1',
    transaction_status: 'settlement',
    status_code: '200',
    gross_amount: '49000.00',
    signature_key: 'palsu',
  });
  assert.equal(res.status, 501);
  assert.equal(res.body.code, 'PAYMENTS_DISABLED');
  assert.equal(res.body.payment, undefined, 'tidak ada data transaksi pada respons');
});
