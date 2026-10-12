import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config, checkStartupConfig } from './config.js';
import { query } from './db.js';
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
import { createPayment, listPayments, midtransNotify } from './routes/payments.js';
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
      const allowed = [config.frontendUrl, 'http://localhost:5173', 'http://localhost:4173'];
      cb(null, allowed.includes(origin));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: 'draft-7', legacyHeaders: false });
  const analysisLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: 'draft-7', legacyHeaders: false });

  app.get('/api/health', async (_req, res) => {
    let db = 'down';
    try {
      await query('SELECT 1');
      db = 'up';
    } catch { /* tetap balas status */ }
    const ai = getProviderInfo();
    res.json({
      ok: db === 'up', db,
      ai: { provider: ai.provider, model: ai.model || null, configured: ai.configured },
      premium_price_idr: config.premium.priceIdr,
      limits: { free_words: FREE_WORD_LIMIT, premium_words: PREMIUM_WORD_LIMIT },
    });
  });

  // ---- Auth (FR-01) ----
  app.post('/api/auth/register', authLimiter, register);
  app.post('/api/auth/login', authLimiter, login);
  app.post('/api/auth/refresh', authLimiter, refresh);
  app.post('/api/auth/logout', logout);
  app.get('/api/auth/me', requireAuth, me);
  app.post('/api/auth/forgot-password', authLimiter, forgotPassword);
  app.post('/api/auth/reset-password', authLimiter, resetPassword);

  // ---- Analisis (FR-02..FR-06) ----
  app.post('/api/analysis', requireAuth, analysisLimiter, upload.single('file'), createAnalysis);

  // ---- Dokumen (FR-08..FR-11) ----
  app.get('/api/documents', requireAuth, listDocuments);
  app.delete('/api/documents', requireAuth, deleteDocuments);
  // Penting: daftarkan /:id/download SEBELUM /:id agar tidak tertelan param.
  app.get('/api/documents/:id/download', requireAuth, downloadDocument);
  app.get('/api/documents/:id', requireAuth, getDocument);
  app.patch('/api/documents/:id/issues', requireAuth, decideIssues);
  app.post('/api/documents/:id/restore', requireAuth, restoreOriginal);
  app.patch('/api/documents/:id/title', requireAuth, renameDocument);

  // ---- Pembayaran (FR-07) ----
  app.post('/api/payments', requireAuth, createPayment);
  app.get('/api/payments', requireAuth, listPayments);
  app.post('/api/payments/notify', express.json({ limit: '100kb' }), midtransNotify);

  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}

export function start() {
  const problems = checkStartupConfig();
  for (const p of problems) console.warn('[config] ' + p);
  const app = createApp();
  startRetentionJob();
  app.listen(config.port, () => console.log(`[runut] API berjalan di http://localhost:${config.port}`));
  return app;
}
