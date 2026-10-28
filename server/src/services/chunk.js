// Memecah teks panjang menjadi bagian yang aman dikirim ke provider AI dan
// mengembalikan offset tiap bagian pada teks asli, supaya posisi sorotan tetap
// tepat setelah hasil digabung. Batas dihitung dari titik akhir kalimat/paragraf
// agar tidak memotong kata.
export const AI_CHUNK_CHARS = 6000;

export function splitForAi(text, maxChars = AI_CHUNK_CHARS) {
  const source = String(text ?? '');
  if (source.length <= maxChars) return [{ text: source, offset: 0 }];
  const parts = [];
  let start = 0;
  while (start < source.length) {
    let end = Math.min(start + maxChars, source.length);
    if (end < source.length) {
      const window = source.slice(start, end);
      const paragraph = window.lastIndexOf('\n\n');
      const sentence = Math.max(
        window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! '),
      );
      const cut = Math.max(paragraph, sentence);
      // Jangan memotong terlalu pendek: bagian lebih kecil dari 60% batas tidak
      // sepadan dengan biaya satu permintaan AI.
      if (cut > maxChars * 0.6) end = start + cut + 1;
    }
    parts.push({ text: source.slice(start, end), offset: start });
    start = end;
  }
  return parts;
}

// Jalankan fungsi async untuk tiap item dengan batas paralel, mempertahankan
// urutan hasil. Dipakai agar analisis teks panjang tidak menunggu satu per satu.
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
