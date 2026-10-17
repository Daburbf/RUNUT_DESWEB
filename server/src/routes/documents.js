import { documents, analyses, issues as issuesRepo } from '../repositories/index.js';
import { HttpError, asyncHandler } from '../middleware/errors.js';
import { countWords } from '../services/stats.js';
import { FREE_SHOWN_ISSUES } from './analysis.js';

const DECISIONS = new Set(['active', 'applied', 'rejected']);

async function ownDocument(userId, id) {
  const doc = await documents.findById(id);
  if (!doc) throw new HttpError(404, 'Dokumen tidak ditemukan.');
  if (doc.user_id !== userId) throw new HttpError(403, 'Anda tidak berhak mengakses dokumen ini.');
  return doc;
}

const latestAnalysis = (documentId) => analyses.findLatestByDocument(documentId);

// Batas tampilan saran untuk akun gratis dipakai seragam oleh endpoint analisis
// dan endpoint dokumen, supaya yang terlihat di layar sama dengan meta.shown.
const visibleIssues = (user, list) => (user.is_premium ? list : list.slice(0, FREE_SHOWN_ISSUES));

// Kutipan harus masih cocok dengan teks pada posisi tersimpan; kalau teks sudah
// berubah, saran itu dibatalkan (pengguna diminta menganalisis ulang).
function assertStillValid(text, issue) {
  const slice = text.slice(issue.start_pos, issue.end_pos);
  if (slice !== issue.snippet) {
    throw new HttpError(409, `Saran "${issue.snippet}" tidak lagi cocok dengan teks pada posisinya. Jalankan analisis ulang sebelum menerapkan saran.`, { code: 'STALE_POSITION', issue_id: issue.id });
  }
}

function buildRevised(original, issues) {
  const applied = issues
    .filter((i) => i.decision === 'applied')
    .sort((a, b) => a.start_pos - b.start_pos);
  let out = '';
  let pos = 0;
  for (const it of applied) {
    if (it.start_pos < pos) continue; // tumpang tindih: saran berikutnya dilewati
    out += original.slice(pos, it.start_pos) + it.suggestion;
    pos = it.end_pos;
  }
  return out + original.slice(pos);
}

export const listDocuments = asyncHandler(async (req, res) => {
  const list = await documents.listByUser(req.user.id, { q: String(req.query.q || ''), limit: 100 });
  const withCounts = await Promise.all(list.map(async (d) => ({
    id: d.id, title: d.title, status: d.status, word_count: d.word_count,
    created_at: d.created_at, updated_at: d.updated_at, expires_at: d.expires_at,
    pending_count: await issuesRepo.countPendingByDocument(d.id),
  })));
  res.json({ documents: withCounts });
});

export const getDocument = asyncHandler(async (req, res) => {
  const doc = await ownDocument(req.user.id, req.params.id);
  const analysis = await latestAnalysis(doc.id);
  const issues = analysis ? await issuesRepo.listByAnalysis(analysis.id) : [];
  const shown = visibleIssues(req.user, issues);
  res.json({
    document: {
      id: doc.id, title: doc.title,
      original_text: doc.original_text,
      revised_text: buildRevised(doc.original_text, issues),
      status: doc.status, word_count: doc.word_count,
      created_at: doc.created_at, updated_at: doc.updated_at, expires_at: doc.expires_at,
    },
    analysis: analysis ? {
      id: analysis.id, stats: analysis.stats, locked: analysis.locked,
      ai: { provider: analysis.ai_provider, model: analysis.ai_model, latencyMs: analysis.ai_latency_ms, status: analysis.ai_status },
    } : null,
    issues: shown,
    meta: {
      is_premium: req.user.is_premium,
      total_found: issues.length,
      shown: shown.length,
      locked_note: req.user.is_premium ? null : 'Akun gratis menampilkan maksimal 3 masalah. Saran perbaikan terbuka di Premium.',
    },
  });
});

// PATCH /api/documents/:id/issues
// Body: { decisions: [{ id, decision: 'active'|'applied'|'rejected', suggestion?, confirm_manual? }] }
//   atau { accept_all: true } untuk menerapkan semua saran yang valid.
export const decideIssues = asyncHandler(async (req, res) => {
  const doc = await ownDocument(req.user.id, req.params.id);
  const analysis = await latestAnalysis(doc.id);
  if (!analysis) throw new HttpError(404, 'Dokumen ini belum memiliki hasil analisis.');
  if (analysis.locked && !req.user.is_premium) {
    throw new HttpError(403, 'Saran perbaikan terkunci untuk akun gratis. Tingkatkan ke Premium untuk menerapkan saran.', { code: 'LOCKED' });
  }
  const issues = await issuesRepo.listByAnalysis(analysis.id);
  const byId = new Map(issues.map((i) => [i.id, i]));

  let targets;
  if (req.body?.accept_all) {
    // Hanya saran yang masih aktif dan tidak perlu cek manual yang diterapkan
    // sekaligus; saran yang bertumpuk dilewati saat penyusunan teks.
    targets = issues
      .filter((i) => i.decision === 'active' && !i.needs_manual_review)
      .map((i) => ({ id: i.id, decision: 'applied', suggestion: i.suggestion }));
    for (const t of targets) assertStillValid(doc.original_text, byId.get(t.id));
  } else if (Array.isArray(req.body?.decisions)) {
    targets = [];
    for (const d of req.body.decisions) {
      const issue = byId.get(d.id);
      if (!issue) throw new HttpError(404, `Saran ${d.id} tidak ditemukan pada dokumen ini.`);
      if (!DECISIONS.has(d.decision)) throw new HttpError(400, 'decision harus "active", "applied", atau "rejected".');
      if (d.decision === 'applied') {
        assertStillValid(doc.original_text, issue);
        if (issue.needs_manual_review && !d.confirm_manual) {
          throw new HttpError(409, 'Saran ini ditandai perlu cek manual. Tinjau maknanya dulu, lalu kirim ulang dengan confirm_manual: true.', { code: 'NEEDS_MANUAL', issue_id: issue.id });
        }
      }
      targets.push({
        id: issue.id,
        decision: d.decision,
        suggestion: typeof d.suggestion === 'string' && d.suggestion.trim() ? d.suggestion.trim().slice(0, 2000) : issue.suggestion,
      });
    }
  } else {
    throw new HttpError(400, 'Kirim "decisions" atau "accept_all: true".');
  }

  for (const t of targets) await issuesRepo.updateDecision(t.id, { decision: t.decision, suggestion: t.suggestion });
  const fresh = await issuesRepo.listByAnalysis(analysis.id);
  const revised = buildRevised(doc.original_text, fresh);
  await documents.update(doc.id, { revised_text: revised, status: 'revising' });
  res.json({ ok: true, issues: fresh, revised_text: revised, document: { id: doc.id, status: 'revising' } });
});

// POST /api/documents/:id/restore - kembali ke teks asli.
export const restoreOriginal = asyncHandler(async (req, res) => {
  const doc = await ownDocument(req.user.id, req.params.id);
  const analysis = await latestAnalysis(doc.id);
  if (analysis) await issuesRepo.resetDecisions(analysis.id);
  await documents.update(doc.id, { revised_text: null, status: 'analyzed' });
  res.json({ ok: true, revised_text: doc.original_text, issues: analysis ? visibleIssues(req.user, await issuesRepo.listByAnalysis(analysis.id)) : [] });
});

export const renameDocument = asyncHandler(async (req, res) => {
  const doc = await ownDocument(req.user.id, req.params.id);
  const title = String(req.body?.title || '').trim().slice(0, 255);
  if (!title) throw new HttpError(400, 'Judul tidak boleh kosong.');
  await documents.update(doc.id, { title });
  res.json({ ok: true, title });
});

// DELETE /api/documents - hapus satu atau beberapa dokumen setelah konfirmasi.
export const deleteDocuments = asyncHandler(async (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) {
    throw new HttpError(400, 'Kirim "ids" berisi 1-50 id dokumen.');
  }
  const deleted = await documents.deleteMany(req.user.id, ids);
  if (deleted.length === 0) throw new HttpError(404, 'Tidak ada dokumen milik Anda pada daftar itu.');
  res.json({ ok: true, deleted });
});

// GET /api/documents/:id/download?format=txt|docx - teks revisi pilihan pengguna.
export const downloadDocument = asyncHandler(async (req, res) => {
  const doc = await ownDocument(req.user.id, req.params.id);
  const analysis = await latestAnalysis(doc.id);
  const issues = analysis ? await issuesRepo.listByAnalysis(analysis.id) : [];
  const text = doc.revised_text ?? buildRevised(doc.original_text, issues) ?? doc.original_text;
  const safe = (doc.title || 'runut').replace(/[^\p{L}\p{N}\- ]+/gu, '').trim().slice(0, 80) || 'runut';
  const format = String(req.query.format || 'txt').toLowerCase();

  if (format === 'docx') {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
    const file = new Document({
      creator: 'Runut',
      title: doc.title,
      sections: [{
        children: [
          new Paragraph({ text: doc.title || 'Hasil revisi Runut', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun({ text: `Direvisi dengan Runut · ${countWords(text)} kata`, color: '666666', size: 20 })] }),
          ...String(text).split('\n').map((line) => new Paragraph({ children: [new TextRun(line || ' ')] })),
        ],
      }],
    });
    const buf = await Packer.toBuffer(file).catch(() => null);
    if (!buf) throw new HttpError(500, 'Konversi DOCX gagal. Coba unduh dalam format TXT.');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safe}-revisi.docx"`);
    return res.send(buf);
  }
  if (format !== 'txt') throw new HttpError(400, 'Format unduhan hanya "txt" atau "docx".');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}-revisi.txt"`);
  res.send(text);
});