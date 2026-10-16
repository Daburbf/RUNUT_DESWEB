import 'dotenv/config';
import { randomBytes } from 'node:crypto';

const ephemeral = [];

// Kunci JWT wajib diisi di produksi. Untuk pengembangan, kunci acak sementara
// dibuat agar server tetap bisa dijalankan — dengan catatan jelas bahwa sesi
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

  jwt: {
    accessSecret: secretFor('JWT_ACCESS_SECRET'),
    accessTtl: process.env.JWT_ACCESS_TTL || '1h',
    refreshDays: Number(process.env.REFRESH_TOKEN_DAYS || 30),
  },

  // Provider AI aktif: 9Router (endpoint kompatibel OpenAI).
  // AI_MODEL tidak punya nilai bawaan — tidak ada ID model yang dikarang.
  ai: {
    provider: (process.env.AI_PROVIDER || '9router').toLowerCase(),
    baseUrl: (process.env.AI_BASE_URL || 'http://localhost:20128/v1').replace(/\/$/, ''),
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || '',
    timeoutMs: Number(process.env.AI_TIMEOUT_MS || 10000),
  },

  midtrans: {
    isProduction: String(process.env.MIDTRANS_IS_PRODUCTION || 'false') === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY || '',
    clientKey: process.env.MIDTRANS_CLIENT_KEY || '',
    qrisAcquirer: process.env.MIDTRANS_QRIS_ACQUIRER || 'gopay',
    // Kosong = pakai host resmi sandbox/production. Diisi hanya untuk mengarahkan
    // ke lingkungan uji (mis. stub di pengujian otomatis).
    apiBase: process.env.MIDTRANS_API_BASE || '',
  },
  // Tarif premium belum ditetapkan SRS/SDD, jadi tidak ada harga bawaan:
  // pembuatan transaksi hanya jalan bila PREMIUM_PRICE_IDR diisi operator.
  premium: {
    priceIdr: Number(process.env.PREMIUM_PRICE_IDR || 0) || null,
    durationDays: Number(process.env.PREMIUM_DURATION_DAYS || 30),
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

  // Penyimpanan sementara di memori: hilang saat server dimatikan.
  storage: 'memori sementara (bukan persisten — isi hilang saat server dimatikan)',
};

export function checkStartupConfig() {
  const problems = [];
  if (ephemeral.length) {
    problems.push(`${ephemeral.join(', ')} kosong — memakai kunci acak sementara; semua sesi tidak valid setelah server restart.`);
  }
  if (!config.ai.baseUrl || !config.ai.model || !config.ai.apiKey) {
    problems.push('Konfigurasi AI belum lengkap (AI_BASE_URL/AI_API_KEY/AI_MODEL) — endpoint analisis menjawab 503 sampai dilengkapi.');
  }
  if (!config.midtrans.serverKey) problems.push('MIDTRANS_SERVER_KEY kosong — pembuatan transaksi premium menjawab 503.');
  if (!config.premium.priceIdr) problems.push('PREMIUM_PRICE_IDR kosong — tarif belum ditetapkan, pembuatan transaksi premium menjawab 503.');
  if (!config.mail.configured) problems.push('SMTP belum dikonfigurasi — reset password via email menjawab 503.');
  return problems;
}
