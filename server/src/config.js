import 'dotenv/config';
import { randomBytes } from 'node:crypto';

const ephemeral = [];

// Kunci JWT wajib diisi di produksi. Untuk pengembangan, kunci acak sementara
// dibuat agar server tetap bisa dijalankan - dengan catatan jelas bahwa sesi
// tidak bertahan setelah restart. Tidak ada kunci rahasia di source code.
function secretFor(name) {
  const value = process.env[name];
  if (value) {
    if (value.length < 32) console.warn(`[config] ${name} lebih pendek dari 32 karakter.`);
    return value;
  }
  ephemeral.push(name);
  return randomBytes(32).toString('hex');
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),

  // Kosong = penyimpanan memori sementara. Isi untuk menyimpan akun & sesi di
  // PostgreSQL lokal, mis. postgres://postgres:rahasia@localhost:5432/runut
  database: { url: process.env.DATABASE_URL || '' },

  jwt: {
    accessSecret: secretFor('JWT_ACCESS_SECRET'),
    accessTtl: process.env.JWT_ACCESS_TTL || '1h',
    refreshDays: Number(process.env.REFRESH_TOKEN_DAYS || 30),
  },

  // Provider AI aktif: 9Router (endpoint kompatibel OpenAI).
  // AI_MODEL tidak punya nilai bawaan - tidak ada ID model yang dikarang.
  ai: {
    provider: (process.env.AI_PROVIDER || '9router').toLowerCase(),
    baseUrl: (process.env.AI_BASE_URL || 'http://localhost:20128/v1').replace(/\/$/, ''),
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || '',
    timeoutMs: Number(process.env.AI_TIMEOUT_MS || 10000),
  },

  // Harga Premium dipakai seragam oleh halaman Premium dan footer website.
  premium: {
    priceIdr: Number(process.env.PREMIUM_PRICE_IDR || 49000),
    durationDays: Number(process.env.PREMIUM_DURATION_DAYS || 30),
  },

  // Payment gateway. Kosong = mode simulasi (hanya di luar produksi), supaya
  // alur bayar tetap bisa dicoba tanpa kredensial. Tidak ada kode QR palsu
  // yang diklaim sebagai QRIS asli.
  payments: {
    serverKey: process.env.MIDTRANS_SERVER_KEY || '',
    clientKey: process.env.MIDTRANS_CLIENT_KEY || '',
    isProduction: String(process.env.MIDTRANS_IS_PRODUCTION || 'false') === 'true',
    apiBase: (process.env.MIDTRANS_API_BASE || '').replace(/\/$/, ''),
    qrisAcquirer: process.env.MIDTRANS_QRIS_ACQUIRER || 'gopay',
    expiryHours: Number(process.env.PAYMENT_EXPIRY_HOURS || 24),
  },

  mail: {
    host: process.env.MAIL_HOST || '',
    port: Number(process.env.MAIL_PORT || 587),
    secure: String(process.env.MAIL_SECURE || 'false') === 'true',
    user: process.env.MAIL_USER || '',
    pass: process.env.MAIL_PASS || '',
    from: process.env.MAIL_FROM || 'Runut <no-reply@runut.local>',
    configured: Boolean(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS),
  },
};

// Pembayaran: tanpa MIDTRANS_SERVER_KEY, pembelian hanya bisa disimulasikan di
// luar produksi. Produksi tanpa kunci berarti pembelian ditutup (tidak pernah
// mengaktifkan Premium tanpa pembayaran nyata).
export function checkStartupConfig() {
  const problems = [];
  if (ephemeral.length) {
    problems.push(`${ephemeral.join(', ')} kosong - memakai kunci acak sementara; semua sesi tidak valid setelah server restart.`);
  }
  if (!config.ai.baseUrl || !config.ai.model || !config.ai.apiKey) {
    problems.push('Konfigurasi AI belum lengkap (AI_BASE_URL/AI_API_KEY/AI_MODEL) - endpoint analisis menjawab 503 sampai dilengkapi.');
  }
  if (!config.payments.serverKey) {
    problems.push(config.env === 'production'
      ? 'MIDTRANS_SERVER_KEY kosong: pembelian Premium ditutup di produksi.'
      : 'MIDTRANS_SERVER_KEY kosong: pembayaran berjalan dalam mode SIMULASI (tidak ada uang berpindah).');
  }
  if (!config.mail.configured) problems.push('SMTP belum dikonfigurasi - reset password via email menjawab 503.');
  if (process.env.DEMO_PREMIUM === '1') {
    problems.push('DEMO_PREMIUM=1: setiap akun baru langsung berstatus Premium (khusus demo). Kosongkan untuk menguji alur pembayaran.');
  }
  return problems;
}
