// Kategori kanonis — cerminan CATEGORIES di backend (sumber kebenaran).
// Warna mengikuti SRS §9: kuning, biru, hijau, ungu, oranye, abu-abu.
// SDD tidak menyelaraskan "keterbacaan" dengan "struktur seragam"; slot oranye
// dipakai untuk struktur seragam agar keenam kategori tetap terwakili
// (lihat docs/KEPUTUSAN_TEKNIS.md, keputusan D3).
export const CATEGORIES = {
  repetition: { label: 'Pengulangan Kata', icon: 'fa-repeat', color: '#B58900', num: '01' },
  sentence_pattern: { label: 'Pola Kalimat', icon: 'fa-align-left', color: '#0B57D0', num: '02' },
  uniform_structure: { label: 'Struktur Seragam', icon: 'fa-clone', color: '#C2410C', num: '03' },
  transition: { label: 'Transisi', icon: 'fa-link', color: '#15803D', num: '04' },
  formality: { label: 'Tingkat Formalitas', icon: 'fa-user-tie', color: '#7E22CE', num: '05' },
  style_consistency: { label: 'Konsistensi Gaya', icon: 'fa-wand-magic-sparkles', color: '#4B5563', num: '06' },
};

// Status keputusan saran dipakai konsisten di backend dan frontend.
export const DECISIONS = ['active', 'applied', 'rejected'];

export const canon = (t) => (CATEGORIES[t] ? t : 'transition');

export const FREE_WORD_LIMIT = 500;
export const PREMIUM_WORD_LIMIT = 10000;
