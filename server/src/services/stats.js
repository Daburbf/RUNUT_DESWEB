// Pemetaan kategori kanonis (backend = sumber kebenaran).
// Keputusan warna (D3): `uniform_structure` memakai label "Struktur Seragam"
// (bukan "Keterbacaan"); konsistensi gaya tetap kategori tersendiri.
export const CATEGORIES = {
  repetition: { label: 'Pengulangan Kata', color: '#B3261E' },
  sentence_pattern: { label: 'Pola Kalimat', color: '#0B57D0' },
  uniform_structure: { label: 'Struktur Seragam', color: '#7C4D00' },
  transition: { label: 'Transisi', color: '#00696B' },
  formality: { label: 'Tingkat Formalitas', color: '#6A1B9A' },
  style_consistency: { label: 'Konsistensi Gaya', color: '#37474F' },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES);
export const isCategory = (c) => CATEGORY_KEYS.includes(c);

const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu;

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

function wordFreq(text) {
  const freq = new Map();
  for (const m of text.toLowerCase().matchAll(WORD_RE)) {
    const w = m[0];
    if (w.length <= 2) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return [...freq.entries()].map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count);
}

// Statistik deterministik di backend — model AI TIDAK boleh menjadi sumber
// kebenaran untuk angka-angka ini.
export function computeStats(text) {
  const sentences = splitSentences(text);
  const words = text.match(WORD_RE) || [];
  const chars = text.length;
  const wordCount = words.length;
  const sentenceCount = sentences.length;
  const wordsPerSentence = sentences.map((s) => (s.text.match(WORD_RE) || []).length);
  const avg = sentenceCount ? wordsPerSentence.reduce((a, b) => a + b, 0) / sentenceCount : 0;
  const longest = wordsPerSentence.length ? Math.max(...wordsPerSentence) : 0;
  const shortest = wordsPerSentence.length ? Math.min(...wordsPerSentence) : 0;
  const topWords = wordFreq(text).slice(0, 10);
  return {
    word_count: wordCount,
    char_count: chars,
    sentence_count: sentenceCount,
    avg_sentence_length: Math.round(avg * 10) / 10,
    longest_sentence_words: longest,
    shortest_sentence_words: shortest,
    top_words: topWords,
  };
}
