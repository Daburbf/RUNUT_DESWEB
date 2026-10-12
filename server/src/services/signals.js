// Sinyal provisional: "kemiripan pola AI" + "kemiripan internal".
//
// JUJUR DENGAN BATASNYA (baca sebelum memakai):
// - `aiLikeness` versi heuristik-v0 BUKAN detektor AI dan BUKAN skor Turnitin.
//   Ia hanya mengukur kemiripan POLA (monoton, repetitif, variasi rendah) dari
//   teks yang diberikan. Jangan pernah menampilkannya sebagai "X% dibuat AI".
// - `internalSimilarity` HANYA membandingkan teks dengan dokumen MILIK PENGGUNA
//   YANG SAMA di database Runut (bukan internet/jurnal). Bukan cek plagiarisme.
// - Slot model (`fetchModelAiLikeness`) siap ditempel API Qwen: cukup isi
//   AI_PROVIDER=ollama, AI_BASE_URL=http://localhost:11434/v1, AI_MODEL=qwen3.5
//   di server/.env — tanpa ubah routes/frontend. Kalau provider tidak
//   dikonfigurasi, sistem otomatis memakai heuristik dan melabelinya apa adanya.
import { getProviderInfo } from './aiProvider.js';

const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu;

function wordsOf(text) {
  return (String(text || '').toLowerCase().match(WORD_RE) || []);
}

function splitSentencesLocal(text) {
  const out = [];
  const re = /[^.!?…]+[.!?…]*/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const t = m[0].trim();
    if (t) out.push(t);
  }
  return out;
}

// ---------- 1. Heuristik kemiripan pola (sementara, deterministik) ----------
export function heuristicAiLikeness(text) {
  const t = String(text || '');
  const words = wordsOf(t);
  const total = words.length;
  const sents = splitSentencesLocal(t);
  const lens = sents.map((s) => (s.match(WORD_RE) || []).length);
  const components = {};
  const reasons = [];

  // a. Rasio kata isi berulang (>=3x) — repetitif => pola monoton.
  const STOP = new Set('yang dan di ke dari ini itu untuk dengan pada adalah dalam tidak akan juga atau oleh karena sebagai ada bisa telah sudah lebih saat agar para kami kita mereka ia dia'.split(' '));
  const freq = new Map();
  for (const w of words) {
    if (w.length < 4 || STOP.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  const repTokens = [...freq.values()].filter((c) => c >= 3).reduce((a, b) => a + b, 0);
  const contentTokens = [...freq.values()].reduce((a, b) => a + b, 0);
  const fRep = contentTokens ? Math.min(1, repTokens / contentTokens) : 0;
  components.repetition = round1(fRep * 100);
  const topRep = [...freq.entries()].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (topRep.length) reasons.push(`Kata berulang: ${topRep.map(([w, c]) => `"${w}" ${c}x`).join(', ')}.`);

  // b. Variasi panjang kalimat rendah => monoton (skor = 1 - cv ternormalisasi).
  let fVar = 0.5;
  if (lens.length >= 2) {
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
    const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length);
    const cv = mean ? sd / mean : 0;
    fVar = 1 - Math.min(1, cv / 0.8);
    components.length_variance_cv = round1(cv * 100) / 100;
    if (fVar > 0.6) reasons.push(`Panjang kalimat seragam (rata-rata ${round1(mean)} kata, variasi rendah).`);
  } else {
    components.length_variance_cv = null;
  }

  // c. Proporsi kalimat sangat panjang (>30 kata).
  const longCount = lens.filter((n) => n > 30).length;
  const fLong = lens.length ? longCount / lens.length : 0;
  components.long_sentence_ratio = round1(fLong * 100);
  if (longCount) reasons.push(`${longCount} kalimat sangat panjang (>30 kata).`);

  // d. Transisi dipakai berulang.
  const transHits = [...t.matchAll(/\b(selain itu|akan tetapi|dengan demikian|oleh karena itu|selanjutnya|selain daripada)\b/gi)];
  const fTrans = transHits.length >= 3 ? 0.8 : transHits.length === 2 ? 0.5 : transHits.length === 1 ? 0.2 : 0.1;
  components.transition_reuse = transHits.length;
  if (transHits.length >= 2) reasons.push(`Transisi dipakai berulang (${transHits.length}x).`);

  // e. Keberagaman kosakata rendah (type-token ratio).
  const uniq = new Set(words).size;
  const ttr = total ? uniq / total : 1;
  const fTtr = 1 - Math.min(1, ttr / 0.6);
  components.vocab_diversity_ttr = round1(ttr * 100) / 100;
  if (fTtr > 0.6) reasons.push('Kosakata kurang beragam (banyak kata sama diulang).');

  const score = clamp01(0.30 * fRep + 0.25 * fVar + 0.15 * fLong + 0.15 * fTrans + 0.15 * fTtr) * 100;
  return {
    score: round1(score),
    band: bandOf(score),
    method: 'heuristic-v0',
    is_estimate: true,
    disclaimer: 'Skor sementara dari pola teks (bukan deteksi AI, bukan vonis asal-usul tulisan).',
    components,
    reasons: reasons.slice(0, 5),
  };
}

function bandOf(s) {
  if (s < 30) return 'rendah';
  if (s <= 60) return 'sedang';
  return 'tinggi';
}

// ---------- 2. Kemiripan internal (shingle Jaccard, antar-dokumen sendiri) ----------
export function shingleSet(text, k = 5) {
  const w = wordsOf(text);
  const set = new Set();
  if (w.length < k) {
    if (w.length) set.add(w.join(' '));
    return set;
  }
  for (let i = 0; i + k <= w.length; i++) set.add(w.slice(i, i + k).join(' '));
  return set;
}

// Persen kemiripan 0-100 ala pencocokan sidik teks (shingle Jaccard),
// dipakai HANYA antar dokumen milik pengguna yang sama. Deterministik.
export function similarityPercent(a, b, k = 5) {
  const A = shingleSet(a, k);
  const B = shingleSet(b, k);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const s of A) if (B.has(s)) inter++;
  const union = A.size + B.size - inter;
  return round1((inter / union) * 100);
}

// candidates: [{ id, title, text }]
export function internalSimilarity(text, candidates = [], { topN = 3, k = 5 } = {}) {
  const matches = [];
  for (const c of candidates) {
    if (!c || typeof c.text !== 'string' || !c.text.trim()) continue;
    const score = similarityPercent(text, c.text, k);
    if (score > 0) matches.push({ document_id: c.id || null, title: c.title || '(tanpa judul)', score });
  }
  matches.sort((a, b) => b.score - a.score);
  const top = matches.slice(0, topN);
  return {
    max_score: top.length ? top[0].score : 0,
    scope: 'internal-only',
    is_estimate: false,
    method: `shingle-jaccard-k${k}`,
    disclaimer: 'Hanya dibandingkan dengan dokumen milikmu sendiri di Runut — bukan cek plagiarisme internet/jurnal.',
    matches: top,
    compared: candidates.length,
  };
}

// ---------- 3. Slot model Qwen (tinggal tempel config, tanpa ubah routes) ----------
// Meminta model menilai kemiripan pola dalam JSON {"ai_likeness":0-100,"reasons":[]}.
// Berhasil -> dipakai sebagai skor utama (method "qwen:<model>"). Gagal/tidak
// dikonfigurasi -> return { available:false } dan pemanggil memakai heuristik.
export async function fetchModelAiLikeness(text, env = process.env) {
  const info = getProviderInfo(env);
  if (!info.configured || (info.provider !== '9router' && info.provider !== 'ollama')) {
    return { available: false, reason: 'AI provider belum dikonfigurasi.' };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new Error('timeout')), info.timeoutMs);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (info.provider !== 'ollama' && env.AI_API_KEY) headers.Authorization = `Bearer ${env.AI_API_KEY}`;
    const res = await fetch(`${info.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      signal: ctrl.signal,
      body: JSON.stringify({
        model: info.model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: [
              'Anda menilai KEMIRIPAN POLA sebuah teks Indonesia dengan pola tulisan yang monoton/repetitif.',
              'Ini BUKAN vonis bahwa teks dibuat AI dan BUKAN cek plagiarisme.',
              'Jawab HANYA JSON valid: {"ai_likeness": <0-100>, "reasons": ["<alasan singkat>", ...maks 3]}.',
            ].join('\n'),
          },
          { role: 'user', content: `Nilai kemiripan pola teks berikut (0=bervariasi alami, 100=sangat monoton):\n<<<\n${String(text).slice(0, 6000)}\n>>>` },
        ],
      }),
    });
    if (!res.ok) return { available: false, reason: `Provider HTTP ${res.status}.` };
    const data = await res.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return { available: false, reason: 'Respons model kosong.' };
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start === -1 || end <= start) return { available: false, reason: 'Respons model bukan JSON.' };
    let parsed;
    try { parsed = JSON.parse(content.slice(start, end + 1)); } catch { return { available: false, reason: 'Respons model bukan JSON valid.' }; }
    const score = Number(parsed.ai_likeness);
    if (!Number.isFinite(score)) return { available: false, reason: 'Skor model tidak valid.' };
    const reasons = Array.isArray(parsed.reasons) ? parsed.reasons.filter((r) => typeof r === 'string').slice(0, 3) : [];
    return {
      available: true,
      score: round1(Math.min(100, Math.max(0, score))),
      band: bandOf(Math.min(100, Math.max(0, score))),
      method: `${info.provider}:${info.model}`,
      is_estimate: true,
      disclaimer: 'Penilaian model atas kemiripan pola (bukan vonis asal-usul tulisan).',
      reasons,
    };
  } catch (err) {
    return { available: false, reason: String(err?.message || err) };
  } finally {
    clearTimeout(t);
  }
}

// Orkestrasi satu pintu dipakai routes/analysis.js:
// - heuristik selalu dihitung (murah, deterministik),
// - model dicoba bila diminta dan terkonfigurasi (slot Qwen),
// - similarity dihitung terhadap kandidat dokumen sendiri.
export async function buildSignals(text, candidates = [], { tryModel = true, env = process.env } = {}) {
  const heuristic = heuristicAiLikeness(text);
  const similarity = internalSimilarity(text, candidates);
  let model = { available: false };
  if (tryModel) {
    try { model = await fetchModelAiLikeness(text, env); } catch { model = { available: false }; }
  }
  const primary = model.available
    ? { score: model.score, band: model.band, method: model.method, is_estimate: true, disclaimer: model.disclaimer, reasons: model.reasons, fallback: heuristic }
    : { ...heuristic };
  return {
    ai_likeness: primary,
    similarity,
    // Info jujur untuk UI: dari mana angka berasal.
    meta: {
      ai_source: model.available ? 'model' : 'heuristic-v0',
      model: model.available ? model.method : null,
      qwen_ready: true,
      qwen_hint: 'Isi AI_PROVIDER=ollama, AI_BASE_URL=http://localhost:11434/v1, AI_MODEL=qwen3.5 di server/.env untuk menilai via Qwen.',
    },
  };
}

function round1(n) { return Math.round(n * 10) / 10; }
function clamp01(n) { return Math.min(1, Math.max(0, n)); }
