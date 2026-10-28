import { payments } from '../repositories/index.js';
import { HttpError, asyncHandler } from '../middleware/errors.js';
import { buildPdf } from '../services/pdf.js';
import {
  createPayment, publicPayment, paymentInfo, refreshPayment, simulatePaid,
  handleNotification, fetchQrImage,
} from '../services/payments.js';

const STATUS_LABEL = {
  pending: 'Menunggu pembayaran',
  paid: 'Lunas',
  failed: 'Gagal',
  expired: 'Kedaluwarsa',
  cancelled: 'Dibatalkan',
  refunded: 'Dikembalikan',
};

async function ownedPayment(userId, orderId) {
  const row = await payments.findByOrderId(orderId);
  if (!row) throw new HttpError(404, 'Transaksi tidak ditemukan.', { code: 'ORDER_NOT_FOUND' });
  if (row.user_id !== userId) throw new HttpError(403, 'Transaksi ini bukan milik akun Anda.');
  return row;
}

const fmtIdr = (n) => 'Rp' + Number(n || 0).toLocaleString('id-ID');
const fmtDate = (v) => (v ? new Date(v).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' }) : '-');

// GET /api/payments - katalog metode, status gateway, dan riwayat transaksi.
export const listPayments = asyncHandler(async (req, res) => {
  const rows = await payments.listByUser(req.user.id, { limit: 20 });
  res.json({ ...paymentInfo(), orders: rows.map(publicPayment) });
});

// POST /api/payments - buat transaksi. Nominal dan nomor order ditentukan
// server; isi body hanya "method".
export const createPaymentHandler = asyncHandler(async (req, res) => {
  const row = await createPayment(req.user, req.body?.method);
  res.status(201).json({ payment: publicPayment(row) });
});

// GET /api/payments/:orderId - status terbaru (dipakai polling dan tombol
// "Periksa status"). Status tidak pernah ditentukan dari parameter URL.
export const getPayment = asyncHandler(async (req, res) => {
  const row = await ownedPayment(req.user.id, req.params.orderId);
  const fresh = await refreshPayment(row);
  res.json({ payment: publicPayment(fresh) });
});

export const paymentQr = asyncHandler(async (req, res) => {
  const row = await ownedPayment(req.user.id, req.params.orderId);
  const { buffer, contentType } = await fetchQrImage(row);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
});

// Mode simulasi saja: menandai lunas tanpa gateway. Tidak pernah tersedia di
// produksi maupun untuk transaksi Midtrans asli.
export const simulatePayment = asyncHandler(async (req, res) => {
  const row = await ownedPayment(req.user.id, req.params.orderId);
  const fresh = await simulatePaid(row);
  res.json({ payment: publicPayment(fresh) });
});

// GET /api/payments/:orderId/invoice - bukti pembayaran dalam bentuk PDF.
export const paymentInvoice = asyncHandler(async (req, res) => {
  const row = await ownedPayment(req.user.id, req.params.orderId);
  const body = [
    `Nomor pesanan : ${row.order_id}`,
    `Tanggal       : ${fmtDate(row.created_at)}`,
    `Metode        : ${row.method_label || row.method}`,
    `Status        : ${STATUS_LABEL[row.status] || row.status}`,
    `Jumlah        : ${fmtIdr(row.amount)}`,
    `Masa aktif    : ${row.premium_days} hari`,
    `Dibayar pada  : ${fmtDate(row.paid_at)}`,
    '',
    'Terima kasih telah mendukung Runut. Invoice ini dibuat otomatis oleh sistem',
    'dan sah tanpa tanda tangan basah.',
  ].join('\n');
  const pdf = await buildPdf({
    title: 'Invoice Runut',
    meta: row.status === 'paid' ? 'PEMBAYARAN LUNAS' : `STATUS: ${(STATUS_LABEL[row.status] || row.status).toUpperCase()}`,
    body,
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${row.order_id}.pdf"`);
  res.send(pdf);
});

// POST /api/payments/notify - webhook Midtrans. Tanpa server key, notifikasi
// ditolak (503) supaya tidak ada jalur "lunas" tanpa verifikasi.
export const paymentNotification = asyncHandler(async (req, res) => {
  const row = await handleNotification(req.body);
  res.json({ ok: true, order_id: row.order_id, status: row.status });
});
