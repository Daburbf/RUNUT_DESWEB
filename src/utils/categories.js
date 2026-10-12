// Kategori kanonis — cerminan CATEGORIES backend (sumber kebenaran).
// Keputusan warna (D3): uniform_structure = "Struktur Seragam" (bukan
// "Keterbacaan"); tidak ada kategori yang dihilangkan.
export const CATEGORIES = {
  repetition: { label: 'Pengulangan Kata', icon: 'fa-repeat', color: '#B3261E', num: '01' },
  sentence_pattern: { label: 'Pola Kalimat', icon: 'fa-align-left', color: '#0B57D0', num: '02' },
  uniform_structure: { label: 'Struktur Seragam', icon: 'fa-clone', color: '#7C4D00', num: '03' },
  transition: { label: 'Transisi', icon: 'fa-link', color: '#00696B', num: '04' },
  formality: { label: 'Tingkat Formalitas', icon: 'fa-user-tie', color: '#6A1B9A', num: '05' },
  style_consistency: { label: 'Konsistensi Gaya', icon: 'fa-wand-magic-sparkles', color: '#37474F', num: '06' },
};

// Kompatibilitas: backend tidak lagi memakai label lama frontend mock.
// Dipetakan ke kategori kanonis agar riwayat lokal lama tetap tampil.
export const LEGACY_MAP = {
  sentence: 'sentence_pattern',
  similarity: 'uniform_structure',
  ai: 'transition',
  consistency: 'style_consistency',
};

export const canon = (t) => CATEGORIES[t] ? t : (LEGACY_MAP[t] || 'transition');

export const FREE_WORD_LIMIT = 500;
export const PREMIUM_WORD_LIMIT = 10000;
