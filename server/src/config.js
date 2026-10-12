import 'dotenv/config';

function required(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') throw new Error(`Konfigurasi ${name} belum diisi. Lihat server/.env.example dan README.`);
  return v;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),
  databaseUrl: process.env.DATABASE_URL || '',
  testMemDb: process.env.TEST_USE_PGMEM === '1',

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshDays: Number(process.env.REFRESH_TOKEN_DAYS || 30),
  },

  ai: {
    provider: (process.env.AI_PROVIDER || '9router').toLowerCase(),
    baseUrl: (process.env.AI_BASE_URL || '').replace(/\/$/, ''),
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || '',
    timeoutMs: Number(process.env.AI_TIMEOUT_MS || 10000),
    stub: (process.env.AI_PROVIDER || '').toLowerCase() === 'stub',
  },

  midtrans: {
    isProduction: String(process.env.MIDTRANS_IS_PRODUCTION || 'false') === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY || '',
    clientKey: process.env.MIDTRANS_CLIENT_KEY || '',
  },
  premium: {
    priceIdr: Number(process.env.PREMIUM_PRICE_IDR || 49000),
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
};

export function checkStartupConfig() {
  const problems = [];
  if (!config.databaseUrl && !config.testMemDb) problems.push('DATABASE_URL kosong (atau set TEST_USE_PGMEM=1 untuk pengujian).');
  if (!config.ai.baseUrl || !config.ai.model || (config.ai.provider === '9router' && !config.ai.apiKey)) {
    if (!config.ai.stub) problems.push('Konfigurasi AI (AI_BASE_URL/AI_API_KEY/AI_MODEL) belum lengkap — endpoint analisis akan menjawab 503 yang eksplisit sampai dilengkapi.');
  }
  if (!config.midtrans.serverKey) problems.push('MIDTRANS_SERVER_KEY kosong — pembuatan transaksi premium akan menjawab 503 yang eksplisit.');
  if (!config.mail.configured) problems.push('SMTP belum dikonfigurasi — reset password via email belum bisa dipakai (503 eksplisit).');
  return problems;
}
