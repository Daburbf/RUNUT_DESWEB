import crypto from 'node:crypto';
import { config } from '../config.js';
import { query, withTransaction } from '../db.js';
import { HttpError, asyncHandler } from '../middleware/errors.js';

function snapBase() {
  return config.midtrans.isProduction ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
}
function apiBase() {
  return config.midtrans.isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
}

function requireMidtrans() {
  if (!config.midtrans.serverKey) {
    throw new HttpError(503, 'Pembayaran belum dikonfigurasi (MIDTRANS_SERVER_KEY kosong). Lengkapi server/.env lalu coba lagi.', { code: 'MIDTRANS_NOT_CONFIGURED' });
  }
}

// POST /api/payments — buat transaksi Snap. Premium TIDAK aktif di sini;
// hanya aktif setelah notifikasi terverifikasi (FR-07).
export const createPayment = asyncHandler(async (req, res) => {
  requireMidtrans();
  const orderId = `RUNUT-${req.user.id.slice(0, 8)}-${Date.now()}`;
  const gross = config.premium.priceIdr;
  const auth = Buffer.from(config.midtrans.serverKey + ':').toString('base64');
  const snapRes = await fetch(`${apiBase()}/snap/v1/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: gross },
      customer_details: { first_name: req.user.name, email: req.user.email },
      item_details: [{ id: 'premium-30d', price: gross, quantity: 1, name: `Runut Premium ${config.premium.durationDays} hari` }],
      callbacks: { finish: `${config.frontendUrl}/#/premium` },
    }),
  });
  if (!snapRes.ok) {
    const body = await snapRes.text().catch(() => '');
    throw new HttpError(502, `Midtrans menolak pembuatan transaksi (HTTP ${snapRes.status}).`, { code: 'MIDTRANS_CREATE_FAILED' });
  }
  const snap = await snapRes.json();
  await query(
    `INSERT INTO payments (user_id, order_id, amount, currency, status, snap_token, redirect_url)
     VALUES ($1, $2, $3, 'IDR', 'pending', $4, $5)`,
    [req.user.id, orderId, gross, snap.token || null, snap.redirect_url || null],
  );
  console.log(JSON.stringify({ event: 'payment_created', user: req.user.id, order: orderId, amount: gross }));
  res.status(201).json({
    order_id: orderId,
    amount: gross,
    currency: 'IDR',
    snap_token: snap.token,
    redirect_url: snap.redirect_url,
    client_key: config.midtrans.clientKey || undefined,
    snap_js: `${snapBase()}/snap/snap.js`,
    is_production: config.midtrans.isProduction,
  });
});

// GET /api/payments — audit transaksi milik sendiri.
export const listPayments = asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT id, order_id, amount, currency, status, paid_at, created_at FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [req.user.id],
  );
  res.json({ payments: rows });
});

// POST /api/payments/notify — webhook Midtrans (TANPA auth user).
// Verifikasi signature_key = SHA512(order_id + status_code + gross_amount + serverKey).
export const midtransNotify = asyncHandler(async (req, res) => {
  requireMidtrans();
  const n = req.body || {};
  const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } = n;
  if (!order_id || !status_code || !gross_amount || !signature_key) {
    throw new HttpError(400, 'Payload notifikasi tidak lengkap.');
  }
  const expect = crypto.createHash('sha512')
    .update(`${order_id}${status_code}${gross_amount}${config.midtrans.serverKey}`)
    .digest('hex');
  if (expect !== String(signature_key).toLowerCase()) {
    console.warn(JSON.stringify({ event: 'payment_bad_signature', order: order_id }));
    throw new HttpError(403, 'Signature notifikasi tidak valid.');
  }
  const { rows } = await query('SELECT * FROM payments WHERE order_id = $1', [order_id]);
  const payment = rows[0];
  if (!payment) {
    console.warn(JSON.stringify({ event: 'payment_unknown_order', order: order_id }));
    return res.json({ ok: true });
  }
  const success = (transaction_status === 'capture' && fraud_status === 'accept')
    || transaction_status === 'settlement';
  const failed = ['deny', 'cancel', 'expire', 'failure'].includes(transaction_status);
  await withTransaction(async (client) => {
    await client.query('UPDATE payments SET status = $1, raw_notify = $2, paid_at = CASE WHEN $1 IN (\'settlement\',\'capture\',\'paid\') THEN coalesce(paid_at, now()) ELSE paid_at END, updated_at = now() WHERE id = $3',
      [transaction_status, JSON.stringify(n), payment.id]);
    // Aktivasi premium HANYA setelah pembayaran terverifikasi sukses — jangan
    // pernah percaya status premium dari browser (NFR/FR-07).
    if (success && payment.status !== 'settlement' && payment.status !== 'paid' && payment.status !== 'capture') {
      await client.query(
        `UPDATE users SET is_premium = TRUE,
          premium_until = GREATEST(coalesce(premium_until, now()), now()) + ($1 || ' days')::interval,
          updated_at = now() WHERE id = $2`,
        [String(config.premium.durationDays), payment.user_id],
      );
    }
  });
  console.log(JSON.stringify({ event: 'payment_notify', order: order_id, status: transaction_status, success, failed }));
  res.json({ ok: true });
});
