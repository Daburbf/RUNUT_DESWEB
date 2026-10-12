// Analisis heuristik lokal deterministik (server-side) — HANYA untuk demo/dev
// tanpa kredensial AI. Bukan AI dan tidak berpura-pura jadi AI: respons analysis
// mencantumkan provider "local-heuristic" apa adanya.
// Memakai 6 kategori kanonis dengan offset yang benar, lalu tetap lewat
// validateAiIssues seperti respons AI asli.
export function analyzeLocal(text, maxIssues = 30) {
  const issues = [];
  const push = (type, start, end, explanation, suggestion, needs_review = false) => {
    if (issues.length >= maxIssues) return;
    issues.push({ type, start, end, text: text.slice(start, end), explanation, suggestion, needs_review });
  };

  // 1. repetition: kata isi (>=4 huruf) yang muncul >=3x
  const STOP = new Set('yang dan di ke dari ini itu untuk dengan pada adalah dalam tidak akan juga atau oleh karena sebagai ada bisa telah sudah lebih saat agar para kami kita mereka ia dia'.split(' '));
  const occ = new Map();
  for (const m of text.toLowerCase().matchAll(/[\p{L}]+/gu)) {
    const w = m[0];
    if (w.length < 4 || STOP.has(w)) continue;
    if (!occ.has(w)) occ.set(w, []);
    occ.get(w).push(m.index);
  }
  for (const [w, idxs] of occ) {
    if (idxs.length < 3) continue;
    for (const i of idxs.slice(1, 4)) {
      push('repetition', i, i + w.length,
        `Kata "${w}" muncul ${idxs.length} kali dalam teks ini. Variasikan dengan sinonim agar tidak monoton.`,
        w);
    }
  }

  // 2. sentence_pattern: kalimat > 30 kata
  const sentRe = /[^.!?…]+[.!?…]*/g;
  let m;
  while ((m = sentRe.exec(text)) !== null) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const s = raw.trim();
    if (!s) continue;
    const n = s.split(/\s+/).length;
    if (n > 30) {
      push('sentence_pattern', m.index + lead, m.index + lead + s.length,
        `Kalimat ini sangat panjang (${n} kata). Pecah menjadi dua kalimat agar mudah diikuti.`,
        s, true);
    }
  }

  // 3. uniform_structure: >=3 kalimat berurutan panjangnya mirip (selisih <=2 kata)
  const sents = [];
  {
    const re = /[^.!?…]+[.!?…]*/g;
    let x;
    while ((x = re.exec(text)) !== null) {
      const t = x[0].trim();
      if (t) sents.push({ t, start: x.index + (x[0].length - x[0].trimStart().length), len: t.split(/\s+/).length });
    }
  }
  for (let i = 0; i + 2 < sents.length; i++) {
    const lens = [sents[i].len, sents[i + 1].len, sents[i + 2].len];
    if (Math.max(...lens) - Math.min(...lens) <= 2 && lens[0] >= 5) {
      const s = sents[i + 1];
      push('uniform_structure', s.start, s.start + s.t.length,
        'Tiga kalimat berurutan memiliki panjang yang hampir sama, sehingga ritmenya monoton. Variasikan panjang kalimat.',
        s.t, true);
      break;
    }
  }

  // 4. transition: kalimat yang diawali "Selain itu"/"Akan tetapi" berulang
  const transRe = /\b(selain itu|akan tetapi|dengan demikian|oleh karena itu)\b/gi;
  const hits = [...text.matchAll(transRe)];
  if (hits.length >= 2) {
    for (const h of hits.slice(1)) {
      push('transition', h.index, h.index + h[0].length,
        `Transisi "${h[0]}" dipakai berulang (${hits.length} kali). Ganti sebagian dengan variasi lain.`,
        h[0]);
    }
  }

  // 5. formality: kata tidak baku
  const INFORMAL = {
    gak: 'tidak', nggak: 'tidak', banget: 'sekali', aja: 'saja', udah: 'sudah',
    gimana: 'bagaimana', kayak: 'seperti', bikin: 'membuat', pake: 'memakai',
    emang: 'memang', cuma: 'hanya', kalo: 'kalau', gitu: 'begitu', gini: 'begini',
  };
  for (const [w, formal] of Object.entries(INFORMAL)) {
    for (const h of text.matchAll(new RegExp(`\\b${w}\\b`, 'gi'))) {
      push('formality', h.index, h.index + h[0].length,
        `Kata "${h[0]}" tidak baku untuk tulisan formal. Gunakan "${formal}".`,
        formal);
      if (issues.length >= maxIssues) break;
    }
  }

  // 6. style_consistency: campuran saya/aku
  if (/\bsaya\b/i.test(text)) {
    for (const h of text.matchAll(/\baku\b/gi)) {
      push('style_consistency', h.index, h.index + h[0].length,
        'Teks memakai "saya" di bagian lain tetapi "aku" di sini. Pilih satu kata ganti yang konsisten.',
        'saya');
    }
  }

  return { issues };
}
