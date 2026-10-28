import multer from 'multer';
import { documents, analyses, issues as issuesRepo } from '../repositories/index.js';
import { HttpError, asyncHandler } from '../middleware/errors.js';
import { AiError, analyzeWithProvider } from '../services/aiProvider.js';
import { rankIssues, validateAiIssues } from '../services/aiValidate.js';
import { computeStats, computeScores, countWords, CATEGORIES } from '../services/stats.js';
import { splitForAi, mapLimit } from '../services/chunk.js';

// Akun gratis dibatasi 500 kata. Premium tidak dibatasi jumlah kata; teks
// panjang dipecah per bagian (services/chunk.js) lalu digabung, dan hanya batas
// praktis ukuran satu dokumen yang berlaku.
export const FREE_WORD_LIMIT = 500;
export const PREMIUM_WORD_LIMIT = null;
export const FREE_SHOWN_ISSUES = 3;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
// Batas praktis: ~200.000 karakter (sekitar 30.000 kata). Di atas itu waktu
// tunggu masuk akal untuk dipecah menjadi beberapa dokumen.
export const AI_MAX_CHARS = 200000;
export const AI_MAX_ISSUES = 12; // per bagian
export const AI_MAX_TOTAL_ISSUES = 120;
export const AI_PARALLEL = 3;

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

// Bukti yang dihitung program (bukan model) dan disertakan pada prompt, supaya
// model memeriksa pola yang benar-benar berulang di teks, bukan menebak.
export function buildEvidenceBrief(stats) {
  const parts = [];
  for (const p of (stats.top_phrases || []).slice(0, 6)) parts.push(`frasa "${p.phrase}" muncul ${p.count}x`);
  for (const o of (stats.repeated_openings || []).slice(0, 4)) parts.push(`pembuka "${o.opening}" muncul ${o.count}x`);
  for (const w of (stats.top_words || []).filter((x) => !x.common && x.count > 2).slice(0, 8)) parts.push(`kata "${w.word}" muncul ${w.count}x`);
  return parts.join('; ');
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
  if (!req.user.is_premium && words > FREE_WORD_LIMIT) {
    throw new HttpError(403, `Batas analisis akun gratis adalah ${FREE_WORD_LIMIT} kata. Ringkas teks Anda atau tingkatkan ke Premium (tanpa batas kata).`, { code: 'WORD_LIMIT', limit: FREE_WORD_LIMIT, words });
  }
  if (text.length > AI_MAX_CHARS) {
    throw new HttpError(413, `Teks ${text.length.toLocaleString('id-ID')} karakter melebihi batas satu dokumen (${AI_MAX_CHARS.toLocaleString('id-ID')} karakter). Pecah menjadi beberapa dokumen.`, { code: 'TEXT_TOO_LARGE', limit: AI_MAX_CHARS, chars: text.length });
  }
  if (req.body?.ai_consent !== true && req.body?.ai_consent !== 'true') {
    throw new HttpError(400, 'Persetujuan diperlukan: teks akan dikirim ke layanan AI yang dikonfigurasi server (9Router) untuk dianalisis.', { code: 'AI_CONSENT_REQUIRED' });
  }

  const stats = computeStats(text);
  stats.scores = computeScores(text, stats);
  const evidence = buildEvidenceBrief(stats);
  const chunks = splitForAi(text);
  const startedAt = Date.now();

  const results = await mapLimit(chunks, AI_PARALLEL, async (chunk) => {
    try {
      const out = await analyzeWithProvider(chunk.text, { maxIssues: AI_MAX_ISSUES, evidence });
      return { chunk, ...out };
    } catch (err) {
      return { chunk, error: err };
    }
  });

  const failures = results.filter((r) => r.error);
  if (failures.length === results.length) {
    const first = failures[0].error;
    if (first instanceof AiError) throw new HttpError(first.status, first.message, { code: first.code, retryable: first.retryable });
    throw first;
  }

  const warnings = [];
  const seen = new Set();
  let all = [];
  let providerMeta = null;
  for (const result of results) {
    if (result.error) {
      warnings.push(`${result.error.message || 'Satu bagian teks gagal dianalisis.'} Bagian lain tetap diperiksa.`);
      continue;
    }
    providerMeta ||= { provider: result.provider, model: result.model };
    const { valid, errors } = validateAiIssues(result.parsed, result.chunk.text, { maxIssues: AI_MAX_ISSUES });
    warnings.push(...errors.slice(0, 2));
    for (const issue of valid) {
      const start = issue.start_pos + result.chunk.offset;
      const end = issue.end_pos + result.chunk.offset;
      const key = `${issue.category}:${start}:${end}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // Posisi digeser ke teks asli dan diperiksa ulang agar sorotan tidak
      // pernah berada di luar dokumen.
      if (text.slice(start, end) !== issue.snippet) {
        warnings.push('Satu saran dilewati karena posisinya tidak cocok dengan teks asli.');
        continue;
      }
      all.push({ ...issue, start_pos: start, end_pos: end });
    }
  }

  const ranked = rankIssues(all, text).slice(0, AI_MAX_TOTAL_ISSUES);
  const aiStatus = ranked.length === 0 ? 'empty' : (failures.length ? 'partial' : 'ok');
  const providerMetaSafe = providerMeta || { provider: 'tidak diketahui', model: 'tidak diketahui' };

  console.log(JSON.stringify({
    event: 'ai_analysis', user: req.user.id, provider: providerMetaSafe.provider,
    model: providerMetaSafe.model, latency_ms: Date.now() - startedAt, status: aiStatus,
    sections: chunks.length, failed_sections: failures.length,
    issues: ranked.length, rejected_by_validation: warnings.length,
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
    stats: { ...stats, ai_sections: chunks.length, ai_warnings: warnings.slice(0, 5) },
    locked: !req.user.is_premium,
    ai_provider: providerMetaSafe.provider,
    ai_model: providerMetaSafe.model,
    ai_latency_ms: Date.now() - startedAt,
    ai_status: aiStatus,
  });
  // Semua issue valid disimpan; akun gratis hanya ditampilkan tiga teratas,
  // sehingga peningkatan ke Premium tidak perlu analisis ulang.
  const stored = await issuesRepo.createMany(ranked.map((it) => ({
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
      ai: { ...providerMetaSafe, latencyMs: Date.now() - startedAt, status: aiStatus, sections: chunks.length },
      categories: CATEGORIES,
      warnings: warnings.slice(0, 5),
    },
    issues: shown,
    meta: {
      is_premium: req.user.is_premium,
      shown: shown.length,
      total_found: stored.length,
      sections: chunks.length,
      locked_note: req.user.is_premium
        ? null
        : `Akun gratis menampilkan statistik, maksimal ${FREE_WORD_LIMIT} kata, dan ${FREE_SHOWN_ISSUES} masalah paling kuat buktinya. Saran perbaikan dan teks tanpa batas terbuka di Premium.`,
    },
  });
});
