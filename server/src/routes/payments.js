import { asyncHandler } from '../middleware/errors.js';

// Pembayaran SENGAJA belum dibuka. Halaman Premium hanya menampilkan paket dan
// pilihan metode pembayaran sebagai gambaran - tidak ada transaksi, kode QR,
// maupun webhook yang diproses, dan tidak ada uang yang berpindah. Semua
// endpoint pembayaran menjawab 501 supaya klien tidak pernah mengira Premium
// bisa diaktifkan lewat HTTP.
export const paymentsDisabled = asyncHandler(async (_req, res) => {
  res.status(501).json({
    error: 'Pembayaran belum dibuka. Paket dan metode pembayaran hanya ditampilkan sebagai gambaran di halaman Premium.',
    code: 'PAYMENTS_DISABLED',
  });
});
