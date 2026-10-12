import { isCategory } from './stats.js';

// Validasi respons AI sebelum disimpan/ditampilkan.
// - struktur JSON & tipe data
// - kategori dari daftar yang diizinkan
// - rentang 0 <= start < end <= panjang teks
// - `text` cocok persis dengan potongan teks asli (anti-halusinasi koordinat)
// - heuristik perubahan makna: saran yang mengubah angka/nama atau berstatus
//   needs_review dari model, atau skor risiko heuristik tinggi, ditandai
//   needs_manual_review = true dan TIDAK boleh diterapkan otomatis.
const ALLOWED = new Set(['repetition', 'sentence_pattern', 'uniform_structure', 'transition', 'formality', 'style_consistency']);

const NUMBER_RE = /[\d.,/:%-]+/;
const PROPER_RE = /^[A-ZÀ-Þ][\p{L}]+/u;

function riskScore(original, suggestion) {
  let score = 0;
  const reasons = [];
  if (NUMBER_RE.test(original) && !suggestion.includes(original.match(NUMBER_RE)[0])) {
    score += 2; reasons.push('mengubah angka');
  }
  const origWords = original.split(/\s+/).filter(Boolean);
  const sugWords = new Set(suggestion.split(/\s+/).filter(Boolean));
  const droppedProper = origWords.filter((w) => PROPER_RE.test(w) && !sugWords.has(w));
  if (droppedProper.length) { score += 2; reasons.push('menghilangkan nama: ' + droppedProper.slice(0, 3).join(', ')); }
  if (!suggestion.trim()) { score += 3; reasons.push('saran kosong'); }
  if (suggestion.length > original.length * 3) { score += 1; reasons.push('saran jauh lebih panjang'); }
  if (suggestion.length < Math.max(1, original.length / 4) && original.length > 12) { score += 1; reasons.push('saran jauh lebih pendek'); }
  return { score, reasons };
}

export function validateAiIssues(parsed, originalText, { maxIssues = 20 } = {}) {
  const errors = [];
  const valid = [];
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.issues)) {
    return { valid: [], errors: ['Respons AI tidak memuat array "issues".'], dropped: 0 };
  }
  const seen = new Set();
  for (const [idx, raw] of parsed.issues.slice(0, maxIssues).entries()) {
    const where = `issues[${idx}]`;
    if (!raw || typeof raw !== 'object') { errors.push(`${where}: bukan objek.`); continue; }
    const { type, start, end, text, explanation, suggestion } = raw;
    if (!ALLOWED.has(type) || !isCategory(type)) { errors.push(`${where}: kategori "${type}" tidak diizinkan.`); continue; }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > originalText.length) {
      errors.push(`${where}: rentang [${start}, ${end}) di luar teks (panjang ${originalText.length}).`); continue;
    }
    if (typeof text !== 'string' || text.length === 0 || originalText.slice(start, end) !== text) {
      errors.push(`${where}: kutipan "text" tidak cocok dengan teks asli pada rentang itu.`); continue;
    }
    if (typeof explanation !== 'string' || !explanation.trim()) { errors.push(`${where}: explanation kosong.`); continue; }
    if (typeof suggestion !== 'string' || !suggestion.trim()) { errors.push(`${where}: suggestion kosong.`); continue; }
    const key = `${type}:${start}:${end}`;
    if (seen.has(key)) { errors.push(`${where}: duplikat.`); continue; }
    seen.add(key);
    const { score, reasons } = riskScore(text, suggestion);
    const needsManual = Boolean(raw.needs_review) || score >= 2;
    valid.push({
      category: type, start_pos: start, end_pos: end, snippet: text,
      explanation: explanation.trim().slice(0, 1000),
      suggestion: suggestion.trim().slice(0, 2000),
      needs_manual_review: needsManual,
      review_reasons: needsManual ? reasons : [],
    });
  }
  return { valid, errors, dropped: errors.length };
}

export function rankIssues(issues) {
  // Urutan deterministik: yang tidak perlu cek manual dulu, lalu span lebih panjang.
  return [...issues].sort((a, b) =>
    Number(a.needs_manual_review) - Number(b.needs_manual_review) ||
    (b.end_pos - b.start_pos) - (a.end_pos - a.start_pos) ||
    a.start_pos - b.start_pos,
  );
}
