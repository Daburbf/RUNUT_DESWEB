import crypto from 'node:crypto';
import { config } from '../config.js';
import { payments, users } from '../repositories/index.js';
import { HttpError, asyncHandler } from '../middleware/errors.js';

// Midtrans Core API (QRIS). Sandbox vs production hanya berbeda host.
const apiBase = () => config.midtrans.apiBase
  || (config.midtrans.isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com');
const authHeader = () => `Basic ${Buffer.from(config.midtrans.serverKey + ':').toString('base64')}`;

function requireMidtrans() {
  if (!config.midtrans.serverKey) {
    throw new HttpError(503, 'Pembayaran belum dikonfigurasi (MIDTRANS_SERVER_KEY kosong).', { code: 'MIDTRANS_NOT_CONFIGURED' });
  }
  if (!config.premium.priceIdr) {
    throw new HttpError(503, 'Tarif premium belum ditetapkan server. Isi PREMIUM_PRICE_IDR di server/.env — SRS/SDD tidak menetapkan harga, jadi tidak ada nilai bawaan.', { code: 'PRICE_NOT_CONFIGURED' });
  }
}

// Ringkasan transaksi untuk klien. Tidak ada nilai yang bisa dipalsukan klien:
// semua berasal dari konfigurasi server dan respons Midtrans.
const toPublic = (p) => ({
  id: p.id,
  order_id: p.order_id,
  amount: p.amount,
  currency: p.currency,
  status: p.status,
  midtrans_status: p.midtrans_status || null,
  expiry_time: p.expiry_time || null,
  paid_at: p.paid_at,
  created_at: p.created_at,
  qr_available: Boolean(p.qr_url),
  is_production: config.midtrans.isProduction,
});

async function midtransCall(path, init) {
  let res;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: authHeader(), ...(init?.headers || {}) },
    });
  } catch (err) {
    throw new HttpError(503, `Tidak dapat menghubungi Midtrans: ${err.message}`, { code: 'MIDTRANS_UNREACHABLE' });
  }
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!res.ok) {
    throw new HttpError(502, `Midtrans menolak permintaan (HTTP ${res.status}). ${String(body?.status_message || text).slice(0, 200)}`, { code: 'MIDTRANS_FAILED' });
  }
  return body;
}

// transaction_status QRIS: pending | settlement | expire | deny (+ capture/cancel/failure).
function outcomeOf(transaction_status, fraud_status) {
  if (transaction_status === 'settlement' || (transaction_status === 'capture' && fraud_status !== 'challenge')) return 'success';
  if (transaction_status === 'expire') return 'expired';
  if (transaction_status === 'cancel') return 'cancelled';
  if (['deny', 'failure'].includes(transaction_status)) return 'failed';
  return 'pending';
}

// Menyimpan status terbaru dan memperpanjang premium HANYA pada transisi
// pending -> success yang pertama: notifikasi/webhook berulang tidak
// menggandakan masa premium.
async function syncOutcome(payment, charge, transaction_status, fraud_status) {
  const outcome = outcomeOf(transaction_status, fraud_status);
  const wasPaid = payment.status === 'success';
  const updated = await payments.update(payment.id, {
    status: outcome,
    midtrans_status: transaction_status || null,
    transaction_id: charge?.transaction_id || payment.transaction_id || null,
    expiry_time: charge?.expiry_time || payment.expiry_time || null,
    paid_at: outcome === 'success' ? (payment.paid_at || new Date().toISOString()) : payment.paid_at,
    settlement_time: charge?.settlement_time || payment.settlement_time || null,
    raw_status: charge || payment.raw_status || null,
  });
  if (outcome === 'success' && !wasPaid) {
    await users.extendPremium(payment.user_id, config.premium.durationDays);
  }
  return updated;
}

// POST /api/payments — buat transaksi QRIS. Premium TIDAK aktif di sini.
export const createPayment = asyncHandler(async (req, res) => {
  requireMidtrans();
  const orderId = `RUNUT-${req.user.id.slice(0, 8)}-${Date.now()}`;
  const gross = config.premium.priceIdr;
  const charge = await midtransCall('/v2/charge', {
    method: 'POST',
    body: JSON.stringify({
      payment_type: 'qris',
      transaction_details: { order_id: orderId, gross_amount: gross },
      item_details: [{ id: `premium-${config.premium.durationDays}d`, price: gross, quantity: 1, name: `Runut Premium ${config.premium.durationDays} hari` }],
      customer_details: { first_name: req.user.name, email: req.user.email },
      qris: { acquirer: config.midtrans.qrisAcquirer },
    }),
  });
  const qrAction = (charge.actions || []).find((a) => a.name === 'generate-qr-code') || (charge.actions || [])[0] || null;
  const row = await payments.create({
    user_id: req.user.id,
    order_id: orderId,
    amount: gross,
    status: outcomeOf(charge.transaction_status, charge.fraud_status),
    midtrans_status: charge.transaction_status || 'pending',
    transaction_id: charge.transaction_id || null,
    expiry_time: charge.expiry_time || null,
    qr_url: qrAction?.url || null,
    raw_status: charge,
  });
  console.log(JSON.stringify({ event: 'payment_created', order: orderId, amount: gross, status: row.status }));
  res.status(201).json({ payment: toPublic(row), reference: charge.transaction_id || null });
});

export const listPayments = asyncHandler(async (req, res) => {
  const list = await payments.listByUser(req.user.id);
  res.json({ payments: list.map(toPublic) });
});

async function ownPayment(userId, orderId) {
  const payment = await payments.findByOrderId(orderId);
  if (!payment) throw new HttpError(404, 'Transaksi tidak ditemukan.');
  if (payment.user_id !== userId) throw new HttpError(403, 'Anda tidak berhak mengakses transaksi ini.');
  return payment;
}

// GET /api/payments/:orderId/qr — meneruskan gambar QR dari Midtrans.
// Gambar tidak dibuat sendiri: ini kode QR asli dari transaksi Midtrans.
export const paymentQr = asyncHandler(async (req, res) => {
  const payment = await ownPayment(req.user.id, req.params.orderId);
  if (!payment.qr_url) throw new HttpError(404, 'Transaksi ini tidak memiliki kode QR.');
  let upstream;
  try {
    upstream = await fetch(payment.qr_url, { headers: { Authorization: authHeader(), Accept: 'image/png' } });
  } catch (err) {
    throw new HttpError(503, `Tidak dapat mengambil kode QR dari Midtrans: ${err.message}`, { code: 'MIDTRANS_UNREACHABLE' });
  }
  if (!upstream.ok) {
    throw new HttpError(502, `Midtrans tidak memberikan kode QR (HTTP ${upstream.status}).`, { code: 'QR_UNAVAILABLE' });
  }
  res.set('Content-Type', upstream.headers.get('content-type') || 'image/png');
  res.set('Cache-Control', 'no-store');
  res.send(Buffer.from(await upstream.arrayBuffer()));
});

// GET /api/payments/:orderId/status — tombol "Periksa status": tanya langsung
// ke Midtrans, lalu sinkronkan penyimpanan sementara.
export const paymentStatus = asyncHandler(async (req, res) => {
  requireMidtrans();
  const payment = await ownPayment(req.user.id, req.params.orderId);
  const status = await midtransCall(`/v2/${encodeURIComponent(payment.order_id)}/status`, { method: 'GET' });
  const updated = await syncOutcome(payment, status, status.transaction_status, status.fraud_status);
  res.json({ payment: toPublic(updated) });
});

// POST /api/payments/notify — webhook Midtrans tanpa autentikasi pengguna.
// signature_key = SHA512(order_id + status_code + gross_amount + serverKey).
export const midtransNotify = asyncHandler(async (req, res) => {
  requireMidtrans();
  const n = req.body || {};
  const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } = n;
  if (!order_id || !status_code || !gross_amount || !signature_key) {
    throw new HttpError(400, 'Payload notifikasi tidak lengkap.');
  }
  const expected = crypto.createHash('sha512')
    .update(`${order_id}${status_code}${gross_amount}${config.midtrans.serverKey}`)
    .digest('hex');
  if (expected !== String(signature_key).toLowerCase()) {
    console.warn(JSON.stringify({ event: 'payment_bad_signature', order: order_id }));
    throw new HttpError(403, 'Signature notifikasi tidak valid.', { code: 'BAD_SIGNATURE' });
  }
  const payment = await payments.findByOrderId(order_id);
  if (!payment) {
    console.warn(JSON.stringify({ event: 'payment_unknown_order', order: order_id }));
    return res.json({ ok: true });
  }
  // Jumlah yang dibayar harus sama dengan yang ditagih.
  if (Number(gross_amount) !== Number(payment.amount)) {
    console.warn(JSON.stringify({ event: 'payment_amount_mismatch', order: order_id }));
    throw new HttpError(400, 'Jumlah pembayaran tidak cocok dengan transaksi.', { code: 'AMOUNT_MISMATCH' });
  }
  const updated = await syncOutcome(payment, n, transaction_status, fraud_status);
  console.log(JSON.stringify({ event: 'payment_notify', order: order_id, status: transaction_status, outcome: updated.status }));
  res.json({ ok: true });
});
