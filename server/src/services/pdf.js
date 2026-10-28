import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// PDF sederhana untuk unduhan revisi dan invoice: teks polos multi-halaman,
// font Helvetica bawaan PDF. Tidak menyimpan gambar, tabel, atau gaya lain -
// ponytail: cukup untuk laporan; ganti pemanggil bila butuh tata letak kaya.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const BOTTOM = 64;

const clean = (s) => String(s ?? '')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/\u2026/g, '...')
  .replace(/[^\x09\x0A\x20-\xFF]/g, '?');

function wrap(text, font, size, width) {
  const lines = [];
  for (const raw of String(text ?? '').split('\n')) {
    const words = raw.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let line = '';
    for (let word of words) {
      while (font.widthOfTextAtSize(word, size) > width) {
        if (line) { lines.push(line); line = ''; }
        let cut = word.length;
        while (cut > 1 && font.widthOfTextAtSize(word.slice(0, cut), size) > width) cut -= 1;
        lines.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      if (!line) line = word;
      else if (font.widthOfTextAtSize(`${line} ${word}`, size) <= width) line += ` ${word}`;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export async function buildPdf({ title = 'Runut', meta = '', body = '' }) {
  const doc = await PDFDocument.create();
  doc.setTitle(clean(title));
  doc.setCreator('Runut');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const width = PAGE_W - 2 * MARGIN;

  const blocks = [
    { text: clean(title), font: bold, size: 17, lead: 24 },
    ...(meta ? [{ text: clean(meta), font, size: 9, lead: 14, gap: 8 }] : []),
    { text: clean(body), font, size: 11, lead: 17, gap: 18 },
  ];

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  let pageNo = 1;

  const newPage = () => {
    page.drawText(`Runut - ${pageNo}`, { x: MARGIN, y: MARGIN - 20, size: 8, font, color: rgb(0.45, 0.45, 0.45) });
    page = doc.addPage([PAGE_W, PAGE_H]);
    pageNo += 1;
    y = PAGE_H - MARGIN;
  };

  for (const block of blocks) {
    if (block.gap) y -= block.gap;
    for (const line of wrap(block.text, block.font, block.size, width)) {
      if (y < BOTTOM) newPage();
      page.drawText(line, { x: MARGIN, y, size: block.size, font: block.font, color: rgb(0.05, 0.05, 0.05) });
      y -= block.lead;
    }
  }
  page.drawText(`Runut - ${pageNo}`, { x: MARGIN, y: MARGIN - 20, size: 8, font, color: rgb(0.45, 0.45, 0.45) });
  // Objek tidak dipadatkan ke object stream agar tetap terbaca pembaca PDF lama.
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}
