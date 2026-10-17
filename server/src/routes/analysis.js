import multer from 'multer';
import { documents, analyses, issues as issuesRepo } from '../repositories/index.js';
import { HttpError, asyncHandler } from '../middleware/errors.js';
import { AiError, analyzeWithProvider } from '../services/aiProvider.js';
import { rankIssues, validateAiIssues } from '../services/aiValidate.js';
import { computeStats, computeScores, countWords, CATEGORIES } from '../services/stats.js';

export const FREE_WORD_LIMIT = 500;
export const PREMIUM_WORD_LIMIT = 10000;
export const FREE_SHOWN_ISSUES = 3;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const AI_MAX_ISSUES = 30;

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

async function extractText(file) {
  const name = (file.originalname || '').toLowerCase();
  const isDocx = name.endsWith('.docx') || file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const isPdf = name.endsWith('.pdf') || file.mimetype === 'application/pdf';
  const isTxt = name.endsWith('.txt') || file.mimetype === 'text/plain';
  if (isTxt) return file.buffer.toString('utf8');
  try {
    if (isDocx) {
      const { default: mammoth } = await import('mammoth');
      const { value } = await mammoth.extractRawText({ buffer: file.buffer });
      return value || '';
    }
    if (isPdf) {
      const mod = await import('pdf-parse');
      const parse = mod.default || mod;
      const data = await parse(file.buffer);
      return data?.text || '';
    }
  } catch {
    // Berkas rusak atau PDF hasil pindai tanpa lapisan teks: dilaporkan sebagai
    // teks yang tidak terbaca, bukan error internal. OCR bukan fitur versi ini.
    return '';
  }
  throw new HttpError(415, 'Format file tidak didukung. Gunakan TXT, DOCX, atau PDF (maksimal 5 MB).', { code: 'BAD_FILE_TYPE' });
}

// POST /api/analysis - body JSON { text, title, ai_consent } atau multipart
// dengan field "file". Kata-kata pengguna dikirim ke provider AI hanya bila
// pengguna menyatakan setuju (ai_consent: true).
export const createAnalysis = asyncHandler(async (req, res) => {
  let text = typeof req.body?.text === 'string' ? req.body.text : '';
  if (req.file) text = await extractText(req.file);
  text = (text || '').replace(/\r\n/g, '\n');

  if (!text.trim()) {
    throw new HttpError(400, req.file
      ? 'File tidak menghasilkan teks yang bisa dibaca. Untuk PDF hasil pindai tanpa lapisan teks, salin teksnya secara manual lalu tempel di editor.'
      : 'Teks masih kosong.', { code: 'NO_TEXT' });
  }
  const words = countWords(text);
  if (words < 20) throw new HttpError(400, `Teks minimal 20 kata agar bisa dianalisis (saat ini ${words} kata).`, { code: 'TOO_SHORT' });
  const limit = req.user.is_premium ? PREMIUM_WORD_LIMIT : FREE_WORD_LIMIT;
  if (words > limit) {
    throw new HttpError(403, req.user.is_premium
      ? `Teks melebihi batas ${PREMIUM_WORD_LIMIT.toLocaleString('id-ID')} kata.`
      : `Batas analisis akun gratis adalah ${FREE_WORD_LIMIT} kata. Ringkas teks Anda atau tingkatkan ke Premium untuk batas ${PREMIUM_WORD_LIMIT.toLocaleString('id-ID')} kata.`,
    { code: 'WORD_LIMIT', limit, words });
  }
  if (req.body?.ai_consent !== true && req.body?.ai_consent !== 'true') {
    throw new HttpError(400, 'Persetujuan diperlukan: teks akan dikirim ke layanan AI yang dikonfigurasi server (9Router) untuk dianalisis.', { code: 'AI_CONSENT_REQUIRED' });
  }

  const stats = computeStats(text);
  stats.scores = computeScores(text, stats);
  // Kegagalan provider tidak pernah diganti hasil buatan dan tidak disimpan.
  let providerMeta;
  let issues;
  let aiStatus = 'ok';
  let aiWarnings = [];
  try {
    const { parsed, latencyMs, provider, model } = await analyzeWithProvider(text, { maxIssues: AI_MAX_ISSUES });
    providerMeta = { provider, model, latencyMs };
    const { valid, errors } = validateAiIssues(parsed, text, { maxIssues: AI_MAX_ISSUES });
    issues = rankIssues(valid, text);
    aiWarnings = errors.slice(0, 3);
    if (issues.length === 0) aiStatus = 'empty';
  } catch (err) {
    if (err instanceof AiError) {
      throw new HttpError(err.status, err.message, { code: err.code, retryable: err.retryable });
    }
    throw err;
  }

  console.log(JSON.stringify({
    event: 'ai_analysis', user: req.user.id, provider: providerMeta.provider,
    model: providerMeta.model, latency_ms: providerMeta.latencyMs, status: aiStatus,
    issues: issues.length, rejected_by_validation: aiWarnings.length,
  }));

  const fileTitle = req.file ? String(req.file.originalname || '').replace(/\.[^.]+$/, '').trim().slice(0, 255) : '';
  const title = String(req.body?.title || '').trim().slice(0, 255) || fileTitle || 'Dokumen tanpa judul';
  const doc = await documents.create({
    user_id: req.user.id,
    title,
    original_text: text,
    word_count: stats.word_count,
    file_name: req.file ? String(req.file.originalname || '').slice(0, 255) : null,
  });
  const analysis = await analyses.create({
    document_id: doc.id,
    stats: { ...stats, ai_warnings: aiWarnings },
    locked: !req.user.is_premium,
    ai_provider: providerMeta.provider,
    ai_model: providerMeta.model,
    ai_latency_ms: providerMeta.latencyMs,
    ai_status: aiStatus,
  });
  // Semua issue valid disimpan; akun gratis hanya ditampilkan tiga teratas,
  // sehingga peningkatan ke Premium tidak perlu analisis ulang.
  const stored = await issuesRepo.createMany(issues.map((it) => ({
    analysis_id: analysis.id,
    category: it.category,
    start_pos: it.start_pos,
    end_pos: it.end_pos,
    snippet: it.snippet,
    explanation: it.explanation,
    suggestion: it.suggestion,
    needs_manual_review: it.needs_manual_review,
    review_reasons: it.review_reasons || [],
    evidence: it.evidence || null,
    decision: 'active',
  })));

  const shown = req.user.is_premium ? stored : stored.slice(0, FREE_SHOWN_ISSUES);
  res.status(201).json({
    document: {
      id: doc.id, title: doc.title, original_text: doc.original_text, revised_text: null,
      word_count: doc.word_count, status: doc.status,
      created_at: doc.created_at, updated_at: doc.updated_at, expires_at: doc.expires_at,
    },
    analysis: {
      id: analysis.id, stats, locked: !req.user.is_premium,
      ai: { ...providerMeta, status: aiStatus },
      categories: CATEGORIES,
      warnings: aiWarnings,
    },
    issues: shown,
    meta: {
      is_premium: req.user.is_premium,
      shown: shown.length,
      total_found: stored.length,
      locked_note: req.user.is_premium
        ? null
        : `Akun gratis menampilkan statistik dan maksimal ${FREE_SHOWN_ISSUES} masalah paling kuat buktinya. Saran perbaikan terkunci untuk Premium.`,
    },
  });
});
