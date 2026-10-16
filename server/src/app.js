import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config, checkStartupConfig } from './config.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { requireAuth } from './middleware/auth.js';
import {
  register, login, refresh, logout, me, forgotPassword, resetPassword,
} from './routes/auth.js';
import { createAnalysis, upload, FREE_WORD_LIMIT, PREMIUM_WORD_LIMIT } from './routes/analysis.js';
import {
  listDocuments, getDocument, decideIssues, restoreOriginal, renameDocument,
  deleteDocuments, downloadDocument,
} from './routes/documents.js';
import { createPayment, listPayments, midtransNotify, paymentQr, paymentStatus } from './routes/payments.js';
import { startRetentionJob } from './services/retention.js';
import { getProviderInfo } from './services/aiProvider.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      // Di luar produksi, port dev apa pun diizinkan: Vite kadang naik ke 5174
      // bila 5173 masih dipegang proses lama, dan origin tetap kena tolak.
      const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      const allowed = [config.frontendUrl, 'http://localhost:5173', 'http://localhost:4173'];
      cb(null, allowed.includes(origin) || (config.env !== 'production' && local));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Batas laju dapat dinaikkan lewat environment untuk pengujian beban/uji
  // otomatis; nilai bawaan tetap ketat untuk pemakaian normal.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_AUTH_MAX || 30),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });
  const analysisLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.RATE_LIMIT_ANALYSIS_MAX || 10),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });

  app.get('/api/health', (_req, res) => {
    const ai = getProviderInfo();
    res.json({
      ok: true,
      storage: config.storage,
      ai: { provider: ai.provider, model: ai.model || null, configured: ai.configured, timeout_ms: ai.timeoutMs },
      premium: { price_idr: config.premium.priceIdr, duration_days: config.premium.durationDays, configured: Boolean(config.premium.priceIdr && config.midtrans.serverKey) },
      mail_configured: config.mail.configured,
      limits: { free_words: FREE_WORD_LIMIT, premium_words: PREMIUM_WORD_LIMIT, free_shown_issues: 3 },
    });
  });

  // ---- Autentikasi (FR-01) ----
  app.post('/api/auth/register', authLimiter, register);
  app.post('/api/auth/login', authLimiter, login);
  app.post('/api/auth/refresh', authLimiter, refresh);
  app.post('/api/auth/logout', logout);
  app.get('/api/auth/me', requireAuth, me);
  app.post('/api/auth/forgot-password', authLimiter, forgotPassword);
  app.post('/api/auth/reset-password', authLimiter, resetPassword);

  // ---- Analisis (FR-02..FR-06) ----
  app.post('/api/analysis', requireAuth, analysisLimiter, upload.single('file'), createAnalysis);

  // ---- Dokumen, saran, unduhan (FR-08..FR-11) ----
  app.get('/api/documents', requireAuth, listDocuments);
  app.delete('/api/documents', requireAuth, deleteDocuments);
  // /:id/download didaftarkan sebelum /:id agar tidak tertelan parameter.
  app.get('/api/documents/:id/download', requireAuth, downloadDocument);
  app.get('/api/documents/:id', requireAuth, getDocument);
  app.patch('/api/documents/:id/issues', requireAuth, decideIssues);
  app.post('/api/documents/:id/restore', requireAuth, restoreOriginal);
  app.patch('/api/documents/:id/title', requireAuth, renameDocument);

  // ---- Pembayaran (FR-07) ----
  app.post('/api/payments', requireAuth, createPayment);
  app.get('/api/payments', requireAuth, listPayments);
  app.get('/api/payments/:orderId/qr', requireAuth, paymentQr);
  app.get('/api/payments/:orderId/status', requireAuth, paymentStatus);
  app.post('/api/payments/notify', express.json({ limit: '100kb' }), midtransNotify);

  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}

export function start() {
  for (const problem of checkStartupConfig()) console.warn('[config] ' + problem);
  const app = createApp();
  startRetentionJob();
  return app.listen(config.port, () => {
    console.log(`[runut] API berjalan di http://localhost:${config.port} — penyimpanan: ${config.storage}`);
  });
}
