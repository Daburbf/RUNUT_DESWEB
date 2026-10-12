import multer from 'multer';
import { query } from '../db.js';
import { HttpError, asyncHandler } from '../middleware/errors.js';
import { AiError, analyzeWithProvider } from '../services/aiProvider.js';
import { analyzeLocal } from '../services/localHeuristic.js';
import { buildSignals } from '../services/signals.js';
import { rankIssues, validateAiIssues } from '../services/aiValidate.js';
import { computeStats, countWords, CATEGORIES } from '../services/stats.js';

export const FREE_WORD_LIMIT = 500;
export const PREMIUM_WORD_LIMIT = 10000;
export const FREE_TOP_ISSUES = 3;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

async function extractText(file) {
  if (!file) throw new HttpError(400, 'Tidak ada file yang diunggah.');
  const name = (file.originalname || '').toLowerCase();
  if (file.mimetype === 'text/plain' || name.endsWith('.txt')) {
    return file.buffer.toString('utf8');
  }
  if (name.endsWith('.docx')) {
    const { default: mammoth } = await import('mammoth');
    const { value } = await mammoth.extractRawText({ buffer: file.buffer });
    return value || '';
  }
  if (file.mimetype === 'application/pdf' || name.endsWith('.pdf')) {
    const mod = await import('pdf-parse');
    const parse = mod.default || mod;
    const data = await parse(file.buffer);
    return data?.text || '';
  }
  throw new HttpError(415, 'Format file tidak didukung. Gunakan TXT, DOCX, atau PDF (maksimal 5 MB).');
}

// POST /api/analysis — menganalisis teks milik pengguna yang sedang masuk.
// Alur: validasi batas kata (gratis 500 / premium 10.000) -> statistik backend
// -> AI provider -> validasi respons -> simpan dokumen + hasil + issues.
export const createAnalysis = asyncHandler(async (req, res) => {
  let text = typeof req.body?.text === 'string' ? req.body.text : '';
  if (req.file) text = await extractText(req.file);
  text = (text || '').replace(/\r\n/g, '\n');
  const words = countWords(text);
  if (words < 20) throw new HttpError(400, 'Teks minimal 20 kata agar bisa dianalisis.');
  const limit = req.user.is_premium ? PREMIUM_WORD_LIMIT : FREE_WORD_LIMIT;
  if (words > limit) {
    throw new HttpError(403, req.user.is_premium
      ? `Teks melebihi batas ${PREMIUM_WORD_LIMIT.toLocaleString('id-ID')} kata.`
      : `Batas analisis akun gratis adalah ${FREE_WORD_LIMIT} kata. Ringkas teks Anda atau tingkatkan ke Premium untuk batas ${PREMIUM_WORD_LIMIT.toLocaleString('id-ID')} kata.`,
    { code: 'WORD_LIMIT', limit, words });
  }

  const stats = computeStats(text);
  let providerMeta = { provider: 'none', model: '', latencyMs: null };
  let issues = [];
  let aiStatus = 'ok';
  let aiErrors = [];
  // Fallback demo/dev: AI_PROVIDER=local memakai heuristik deterministik
  // server-side (jujur dilabeli, bukan AI). Produksi memakai 9Router/Ollama.
  const useLocal = (process.env.AI_PROVIDER || '').toLowerCase() === 'local';
  try {
    if (useLocal) {
      const started = Date.now();
      const parsed = analyzeLocal(text, 30);
      providerMeta = { provider: 'local-heuristic', model: 'deterministic-v1', latencyMs: Date.now() - started };
      const { valid, errors } = validateAiIssues(parsed, text, { maxIssues: 30 });
      issues = rankIssues(valid);
      aiErrors = errors;
      if (issues.length === 0) aiStatus = 'empty';
    } else {
      const { parsed, latencyMs, provider, model } = await analyzeWithProvider(text, { maxIssues: 30 });
      providerMeta = { provider, model, latencyMs };
      const { valid, errors } = validateAiIssues(parsed, text, { maxIssues: 30 });
      issues = rankIssues(valid);
      aiErrors = errors;
      if (issues.length === 0) aiStatus = 'empty';
    }
  } catch (err) {
    if (err instanceof AiError) {
      if (err.status === 503 || err.code === 'AI_NOT_CONFIGURED') throw new HttpError(503, err.message, { code: err.code });
      aiStatus = 'failed';
      aiErrors = [err.message];
    } else throw err;
  }

  const title = String(req.body?.title || '').trim().slice(0, 255) || 'Dokumen tanpa judul';
  const topIssues = req.user.is_premium ? issues : issues.slice(0, FREE_TOP_ISSUES);

  // Sinyal provisional (D8): ai_likeness heuristik + slot model Qwen,
  // similarity HANYA vs dokumen milik sendiri. Bukan % AI, bukan Turnitin.
  let signals = null;
  try {
    const { rows: prevDocs } = await query(
      'SELECT id, title, original_text FROM documents WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 20',
      [req.user.id],
    );
    signals = await buildSignals(text, prevDocs.map((d) => ({ id: d.id, title: d.title, text: d.original_text })));
  } catch (err) {
    signals = { ai_likeness: null, similarity: null, meta: { ai_source: 'unavailable', error: String(err?.message || err) } };
  }

  const { rows: docRows } = await query(
    `INSERT INTO documents (user_id, title, original_text, revised_text, status, word_count, last_analyzed_at, expires_at)
     VALUES ($1, $2, $3, NULL, 'analyzed', $4, now(), now() + interval '30 days')
     RETURNING id, title, status, word_count, created_at, updated_at, expires_at`,
    [req.user.id, title, text, stats.word_count],
  );
  const doc = docRows[0];
  const { rows: arRows } = await query(
    `INSERT INTO analysis_results (document_id, stats, locked, ai_provider, ai_model, ai_latency_ms, ai_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
    [doc.id, JSON.stringify({ ...stats, ai_errors: aiErrors, signals }), !req.user.is_premium,
      providerMeta.provider, providerMeta.model, providerMeta.latencyMs, aiStatus],
  );
  const analysisId = arRows[0].id;
  for (const it of topIssues) {
    await query(
      `INSERT INTO issues (analysis_id, category, start_pos, end_pos, snippet, explanation, suggestion, needs_manual_review)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [analysisId, it.category, it.start_pos, it.end_pos, it.snippet, it.explanation, it.suggestion, it.needs_manual_review],
    );
  }

  console.log(JSON.stringify({
    event: 'ai_analysis', user: req.user.id, provider: providerMeta.provider,
    model: providerMeta.model, latencyMs: providerMeta.latencyMs, status: aiStatus, issues: topIssues.length,
  }));

  res.status(201).json({
    document: { ...doc, original_text: text, revised_text: null },
    analysis: {
      id: analysisId,
      stats,
      locked: !req.user.is_premium,
      ai: { ...providerMeta, status: aiStatus },
      categories: CATEGORIES,
      signals,
    },
    issues: topIssues.map((it, i) => ({ id: `a${i}`, ...it, decision: 'pending' })),
    meta: {
      is_premium: req.user.is_premium,
      shown: topIssues.length,
      total_found: issues.length,
      locked_note: req.user.is_premium ? null : 'Akun gratis menampilkan statistik dan maksimal 3 masalah paling signifikan. Saran perbaikan lengkap terkunci untuk Premium.',
      ai_warnings: aiErrors.slice(0, 3),
    },
  });
});
