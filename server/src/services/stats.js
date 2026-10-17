// Pemetaan kategori kanonis (backend = sumber kebenaran).
// Keputusan warna (docs/KEPUTUSAN_TEKNIS.md, D3): SRS menyebut enam warna
// (kuning, biru, hijau, ungu, oranye, abu-abu) untuk enam posisi kategori.
// Kategori analisis yang dipakai tetap enam kategori resmi SRS; slot "oranye /
// keterbacaan" dipakai `uniform_structure` karena kategori itu yang paling
// dekat dengan keluhan keterbacaan (ritme monoton). Tidak ada kategori ketujuh.
export const CATEGORIES = {
  repetition: { label: 'Pengulangan Kata', color: '#B58900' },
  sentence_pattern: { label: 'Pola Kalimat', color: '#0B57D0' },
  uniform_structure: { label: 'Struktur Seragam', color: '#C2410C' },
  transition: { label: 'Transisi', color: '#15803D' },
  formality: { label: 'Tingkat Formalitas', color: '#7E22CE' },
  style_consistency: { label: 'Konsistensi Gaya', color: '#4B5563' },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES);
export const isCategory = (c) => CATEGORY_KEYS.includes(c);

const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu;

// Kata umum/penghubung: berulang secara wajar, jadi tidak dihitung sebagai
// temuan pengulangan hanya karena frekuensinya tinggi.
export const COMMON_WORDS = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'dengan', 'untuk', 'pada', 'adalah', 'akan',
  'tidak', 'juga', 'dalam', 'atau', 'karena', 'oleh', 'sebagai', 'dapat', 'sudah', 'lebih',
  'agar', 'saat', 'telah', 'serta', 'para', 'oleh', 'namun', 'tetapi', 'jika', 'maka', 'saya',
  'kita', 'kami', 'mereka', 'dia', 'anda', 'nya', 'the', 'of', 'a', 'an',
]);

export function countWords(text) {
  const m = text.match(WORD_RE);
  return m ? m.length : 0;
}

export function splitSentences(text) {
  const out = [];
  const re = /[^.!?…]+[.!?…]*/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed) out.push({ text: trimmed, start: m.index + lead, end: m.index + lead + trimmed.length });
  }
  return out;
}

const paragraphSpans = (text) => {
  const spans = [];
  let pos = 0;
  for (const part of text.split(/\n\s*\n/)) {
    const at = text.indexOf(part, pos);
    if (part.trim()) spans.push([at, at + part.length]);
    pos = at + part.length;
  }
  return spans;
};

function wordFreq(text) {
  const freq = new Map();
  for (const m of text.toLowerCase().matchAll(WORD_RE)) {
    const w = m[0];
    if (w.length <= 2) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return [...freq.entries()]
    .map(([word, count]) => ({ word, count, common: COMMON_WORDS.has(word) }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

// Frekuensi frasa (2-3 kata) yang benar-benar berulang. Frasa yang seluruh
// katanya kata umum dilewati karena pengulangannya wajar.
function phraseFreq(text, n) {
  const words = [...text.toLowerCase().matchAll(WORD_RE)].map((m) => m[0]);
  const freq = new Map();
  for (let i = 0; i + n <= words.length; i++) {
    const gram = words.slice(i, i + n);
    if (gram.every((w) => COMMON_WORDS.has(w))) continue;
    const key = gram.join(' ');
    freq.set(key, (freq.get(key) || 0) + 1);
  }
  return [...freq.entries()]
    .filter(([, count]) => count > 1)
    .map(([phrase, count]) => ({ phrase, words: n, count }))
    .sort((a, b) => b.count - a.count || b.words - a.words);
}

// Pembukaan kalimat yang berulang - bahan bukti pola kalimat/struktur seragam.
function repeatedOpenings(sentences, size = 3) {
  const freq = new Map();
  for (const s of sentences) {
    const words = (s.text.toLowerCase().match(WORD_RE) || []).slice(0, size);
    if (words.length < size) continue;
    const key = words.join(' ');
    freq.set(key, (freq.get(key) || 0) + 1);
  }
  return [...freq.entries()]
    .filter(([, count]) => count > 1)
    .map(([opening, count]) => ({ opening, count }))
    .sort((a, b) => b.count - a.count || a.opening.localeCompare(b.opening))
    .slice(0, 5);
}

// Statistik deterministik - angka yang ditampilkan selalu dihitung program,
// bukan berasal dari perkiraan model. Normalisasi hanya untuk penghitungan;
// teks yang disunting pengguna tidak pernah diubah.
export function computeStats(text) {
  const sentences = splitSentences(text);
  const words = text.match(WORD_RE) || [];
  const lengths = sentences.map((s) => (s.text.match(WORD_RE) || []).length);
  const count = lengths.length;
  const avg = count ? lengths.reduce((a, b) => a + b, 0) / count : 0;
  const variance = count ? lengths.reduce((a, b) => a + (b - avg) ** 2, 0) / count : 0;
  const unique = new Set(words.map((w) => w.toLowerCase()));
  return {
    word_count: words.length,
    unique_word_count: unique.size,
    char_count: text.length,
    paragraph_count: paragraphSpans(text).length,
    sentence_count: count,
    avg_sentence_length: Math.round(avg * 10) / 10,
    sentence_length_variation: Math.round(Math.sqrt(variance) * 10) / 10,
    longest_sentence_words: count ? Math.max(...lengths) : 0,
    shortest_sentence_words: count ? Math.min(...lengths) : 0,
    top_words: wordFreq(text).slice(0, 10),
    top_phrases: [...phraseFreq(text, 2), ...phraseFreq(text, 3)].sort((a, b) => b.count - a.count).slice(0, 10),
    repeated_openings: repeatedOpenings(sentences),
  };
}

// Dua skor tambahan atas permintaan pemilik produk (di luar SRS awal): persen
// kemiripan internal dan persen perkiraan penggunaan AI. Keduanya tetap
// deterministik dan dihitung dari teks, bukan dari dugaan model.
//
// ponytail: kemiripan di sini HANYA internal (teks dibanding dirinya sendiri:
// kata/frasa/pembuka yang terulang). Kemiripan dengan korpus eksternal atau
// pemeriksaan plagiarisme butuh korpus pembanding yang belum ada; tambahkan
// adapter korpus bila nanti ada sumbernya.
// Sinyal disetel pada rentang prosa Indonesia biasa, jadi angka ini perkiraan
// kasar berskala 0-100 - dipakai sebagai penunjuk arah, bukan bukti.
const clamp01 = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const pct = (n) => Math.round(clamp01(n) * 100);

export function computeScores(text, stats = computeStats(text)) {
  const words = [...text.toLowerCase().matchAll(WORD_RE)].map((m) => m[0]);
  const total = words.length;
  const sentences = stats.sentence_count;
  const content = words.filter((w) => w.length > 2 && !COMMON_WORDS.has(w));
  const repeatContent = content.length ? 1 - new Set(content).size / content.length : 0;
  const phraseRepeats = stats.top_phrases.reduce((a, p) => a + (p.count - 1) * p.words, 0);
  const openingRepeats = stats.repeated_openings.reduce((a, o) => a + o.count - 1, 0);

  const s = {
    repeat_content: clamp01((repeatContent - 0.35) / 0.4),
    repeat_phrase: total ? clamp01(phraseRepeats / total / 0.15) : 0,
    repeat_opening: sentences > 1 ? clamp01(openingRepeats / (sentences - 1)) : 0,
  };
  const cv = stats.avg_sentence_length ? stats.sentence_length_variation / stats.avg_sentence_length : 1;
  const lens = splitSentences(text).map((x) => (x.text.match(WORD_RE) || []).length);
  const shortShare = lens.length ? lens.filter((n) => n > 0 && n < 6).length / lens.length : 0;
  const a = {
    sentence_uniformity: sentences ? clamp01((0.55 - cv) / 0.45) : 0,
    repeat_opening: s.repeat_opening,
    repeat_phrase: s.repeat_phrase,
    no_short_sentence: sentences ? clamp01((0.2 - shortShare) / 0.2) : 0,
  };

  const similarity = pct(0.5 * s.repeat_content + 0.3 * s.repeat_phrase + 0.2 * s.repeat_opening);
  const ai_usage = pct(0.35 * a.sentence_uniformity + 0.25 * a.repeat_opening + 0.2 * a.repeat_phrase + 0.2 * a.no_short_sentence);
  return {
    similarity: {
      percent: similarity,
      label: 'Similarity',
      note: 'Ukuran tingkat kesamaan antara teks dengan teks atau data lain di dalam basis data. Sering dikaitkan dengan alat deteksi plagiarisme seperti Turnitin Similarity.',
      signals: [
        { key: 'repeat_content', label: 'Kata isi yang berulang', percent: pct(s.repeat_content) },
        { key: 'repeat_phrase', label: 'Frasa yang berulang', percent: pct(s.repeat_phrase) },
        { key: 'repeat_opening', label: 'Pembuka kalimat yang berulang', percent: pct(s.repeat_opening) },
      ],
    },
    ai_usage: {
      percent: ai_usage,
      label: 'Penggunaan AI',
      note: 'Dihitung dari keseragaman panjang kalimat, pengulangan frasa, dan jumlah kalimat pendek.',
      signals: [
        { key: 'sentence_uniformity', label: 'Panjang kalimat seragam', percent: pct(a.sentence_uniformity) },
        { key: 'repeat_opening', label: 'Pembuka berulang', percent: pct(a.repeat_opening) },
        { key: 'repeat_phrase', label: 'Frasa berulang', percent: pct(a.repeat_phrase) },
        { key: 'no_short_sentence', label: 'Tanpa kalimat pendek', percent: pct(a.no_short_sentence) },
      ],
    },
  };
}

export { paragraphSpans };