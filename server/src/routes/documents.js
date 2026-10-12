import { query, withTransaction } from '../db.js';
import { HttpError, asyncHandler } from '../middleware/errors.js';
import { countWords } from '../services/stats.js';

async function ownDocument(userId, id) {
  const { rows } = await query('SELECT * FROM documents WHERE id = $1', [id]);
  const doc = rows[0];
  if (!doc) throw new HttpError(404, 'Dokumen tidak ditemukan.');
  if (doc.user_id !== userId) throw new HttpError(403, 'Anda tidak berhak mengakses dokumen ini.');
  return doc;
}

async function latestAnalysis(documentId) {
  const { rows } = await query(
    'SELECT * FROM analysis_results WHERE document_id = $1 ORDER BY created_at DESC LIMIT 1',
    [documentId],
  );
  return rows[0] || null;
}

async function issuesOf(analysisId) {
  const { rows } = await query('SELECT * FROM issues WHERE analysis_id = $1 ORDER BY start_pos ASC', [analysisId]);
  return rows.map((r) => ({
    id: r.id, category: r.category, start_pos: r.start_pos, end_pos: r.end_pos,
    snippet: r.snippet, explanation: r.explanation, suggestion: r.suggestion,
    needs_manual_review: r.needs_manual_review, decision: r.decision,
  }));
}

function applyDecisions(original, issues) {
  const accepted = issues
    .filter((i) => i.decision === 'accepted' && !i.needs_manual_review)
    .sort((a, b) => a.start_pos - b.start_pos);
  let out = '';
  let pos = 0;
  for (const it of accepted) {
    if (it.start_pos < pos) continue; // lewati yang tumpang tindih
    out += original.slice(pos, it.start_pos) + it.suggestion;
    pos = it.end_pos;
  }
  return out + original.slice(pos);
}

// GET /api/documents — riwayat milik sendiri (pencarian judul sederhana).
export const listDocuments = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const { rows } = await query(
    `SELECT d.id, d.title, d.status, d.word_count, d.updated_at, d.created_at, d.expires_at,
            (SELECT count(*)::int FROM issues i JOIN analysis_results ar ON ar.id = i.analysis_id
              WHERE ar.document_id = d.id AND i.decision = 'pending') AS pending_count
     FROM documents d WHERE d.user_id = $1 ${q ? 'AND d.title ILIKE $2' : ''}
     ORDER BY d.updated_at DESC LIMIT 100`,
    q ? [req.user.id, `%${q}%`] : [req.user.id],
  );
  res.json({ documents: rows });
});

// GET /api/documents/:id — buka dokumen milik sendiri + analisis terbaru.
export const getDocument = asyncHandler(async (req, res) => {
  const doc = await ownDocument(req.user.id, req.params.id);
  const analysis = await latestAnalysis(doc.id);
  const issues = analysis ? await issuesOf(analysis.id) : [];
  res.json({
    document: {
      id: doc.id, title: doc.title, original_text: doc.original_text,
      revised_text: doc.revised_text || applyDecisions(doc.original_text, issues),
      status: doc.status, word_count: doc.word_count,
      created_at: doc.created_at, updated_at: doc.updated_at, expires_at: doc.expires_at,
    },
    analysis: analysis ? {
      id: analysis.id, stats: analysis.stats, locked: analysis.locked,
      signals: analysis.stats?.signals || null,
      ai: { provider: analysis.ai_provider, model: analysis.ai_model, latencyMs: analysis.ai_latency_ms, status: analysis.ai_status },
    } : null,
    issues,
  });
});

// PATCH /api/documents/:id/issues — terapkan/tolak saran per bagian atau sekaligus.
// Body: { decisions: [{ id, decision: 'accepted'|'rejected', suggestion? }] | { acceptAll: true } }
export const decideIssues = asyncHandler(async (req, res) => {
  const doc = await ownDocument(req.user.id, req.params.id);
  const analysis = await latestAnalysis(doc.id);
  if (!analysis) throw new HttpError(404, 'Dokumen ini belum memiliki hasil analisis.');
  if (analysis.locked && !req.user.is_premium) {
    throw new HttpError(403, 'Saran perbaikan terkunci untuk akun gratis. Tingkatkan ke Premium untuk menerapkan saran.', { code: 'LOCKED' });
  }
  const issues = await issuesOf(analysis.id);
  const byId = new Map(issues.map((i) => [i.id, i]));
  let targets = [];
  if (req.body?.acceptAll) {
    targets = issues.filter((i) => i.decision === 'pending' && !i.needs_manual_review);
  } else if (Array.isArray(req.body?.decisions)) {
    for (const d of req.body.decisions) {
      const it = byId.get(d.id);
      if (!it) throw new HttpError(404, `Saran ${d.id} tidak ditemukan pada dokumen ini.`);
      if (!['accepted', 'rejected'].includes(d.decision)) throw new HttpError(400, 'decision harus "accepted" atau "rejected".');
      if (d.decision === 'accepted' && it.needs_manual_review && !d.confirmManual) {
        throw new HttpError(409, 'Saran ini ditandai perlu cek manual. Tinjau maknanya dulu, lalu kirim ulang dengan confirmManual: true.', { code: 'NEEDS_MANUAL' });
      }
      targets.push({ ...it, decision: d.decision, suggestion: typeof d.suggestion === 'string' && d.suggestion.trim() ? d.suggestion.trim().slice(0, 2000) : it.suggestion });
    }
  } else {
    throw new HttpError(400, 'Kirim "decisions" atau "acceptAll: true".');
  }

  await withTransaction(async (client) => {
    for (const t of targets) {
      await client.query('UPDATE issues SET decision = $1, suggestion = $2 WHERE id = $3', [t.decision, t.suggestion, t.id]);
    }
    const merged = issues.map((i) => {
      const t = targets.find((x) => x.id === i.id);
      return t || i;
    });
    const revised = applyDecisions(doc.original_text, merged);
    await client.query("UPDATE documents SET revised_text = $1, status = 'revising', updated_at = now() WHERE id = $2", [revised, doc.id]);
  });
  const fresh = await issuesOf(analysis.id);
  const { rows } = await query('SELECT revised_text FROM documents WHERE id = $1', [doc.id]);
  res.json({ ok: true, issues: fresh, revised_text: rows[0].revised_text });
});

// POST /api/documents/:id/restore — pulihkan teks asli (reset semua keputusan + revisi).
export const restoreOriginal = asyncHandler(async (req, res) => {
  const doc = await ownDocument(req.user.id, req.params.id);
  const analysis = await latestAnalysis(doc.id);
  await withTransaction(async (client) => {
    if (analysis) await client.query("UPDATE issues SET decision = 'pending' WHERE analysis_id = $1", [analysis.id]);
    await client.query("UPDATE documents SET revised_text = NULL, status = 'analyzed', updated_at = now() WHERE id = $1", [doc.id]);
  });
  res.json({ ok: true, revised_text: doc.original_text });
});

// PATCH /api/documents/:id/title
export const renameDocument = asyncHandler(async (req, res) => {
  const doc = await ownDocument(req.user.id, req.params.id);
  const title = String(req.body?.title || '').trim().slice(0, 255);
  if (!title) throw new HttpError(400, 'Judul tidak boleh kosong.');
  await query('UPDATE documents SET title = $1, updated_at = now() WHERE id = $2', [title, doc.id]);
  res.json({ ok: true, title });
});

// DELETE /api/documents — hapus satu/beberapa riwayat setelah konfirmasi frontend.
// Body: { ids: [uuid...] }
export const deleteDocuments = asyncHandler(async (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) {
    throw new HttpError(400, 'Kirim "ids" berisi 1–50 id dokumen.');
  }
  const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ');
  const { rows } = await query(`SELECT id FROM documents WHERE user_id = $1 AND id IN (${placeholders})`, [req.user.id, ...ids]);
  if (rows.length === 0) throw new HttpError(404, 'Tidak ada dokumen milik Anda pada daftar itu.');
  await query(`DELETE FROM documents WHERE user_id = $1 AND id IN (${placeholders})`, [req.user.id, ...ids]);
  res.json({ ok: true, deleted: rows.map((r) => r.id) });
});

// GET /api/documents/:id/download?format=txt|docx — unduh revisi milik sendiri.
export const downloadDocument = asyncHandler(async (req, res) => {
  const doc = await ownDocument(req.user.id, req.params.id);
  const analysis = await latestAnalysis(doc.id);
  const issues = analysis ? await issuesOf(analysis.id) : [];
  const text = doc.revised_text || applyDecisions(doc.original_text, issues) || doc.original_text;
  const safe = (doc.title || 'runut').replace(/[^\p{L}\p{N}\- ]+/gu, '').trim().slice(0, 80) || 'runut';
  const format = String(req.query.format || 'txt').toLowerCase();
  if (format === 'docx') {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
    const paragraphs = String(text).split('\n').map((line) => new Paragraph({ children: [new TextRun(line || ' ')] }));
    const file = new Document({
      creator: 'Runut',
      title: doc.title,
      sections: [{
        children: [
          new Paragraph({ text: doc.title || 'Hasil revisi Runut', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun({ text: `Direvisi dengan Runut · ${countWords(text)} kata`, color: '666666', size: 20 })] }),
          ...paragraphs,
        ],
      }],
    });
    const buf = await Packer.toBuffer(file);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safe}-revisi.docx"`);
    return res.send(buf);
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}-revisi.txt"`);
  res.send(text);
});
