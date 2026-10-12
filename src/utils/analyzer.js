// Mesin analisis pola tulisan Runut (6 kategori).
// Berjalan di sisi klien sebagai simulasi "AI Service".

export const CATEGORIES = {
  repetition: { label: 'Pengulangan Kata', icon: 'fa-repeat', color: '#000000', num: '01' },
  sentence: { label: 'Pola Kalimat', icon: 'fa-align-left', color: '#000000', num: '02' },
  similarity: { label: 'Kemiripan Teks', icon: 'fa-clone', color: '#000000', num: '03' },
  ai: { label: 'Indikasi AI', icon: 'fa-robot', color: '#000000', num: '04' },
  formality: { label: 'Tingkat Formalitas', icon: 'fa-user-tie', color: '#000000', num: '05' },
  consistency: { label: 'Konsistensi Gaya', icon: 'fa-wand-magic-sparkles', color: '#000000', num: '06' },
}

const STOPWORDS = new Set('yang dan di ke dari ini itu untuk dengan pada adalah dalam tidak akan juga atau oleh karena sebagai ada bisa telah sudah lebih saat agar para kami kita mereka ia dia'.split(' '))

const SYNONYMS = {
  sangat: ['amat', 'begitu', 'sungguh'], penting: ['krusial', 'utama', 'esensial'],
  membuat: ['menciptakan', 'menyusun', 'menghasilkan'], banyak: ['beragam', 'sejumlah', 'berbagai'],
  baik: ['bagus', 'positif', 'layak'], menggunakan: ['memakai', 'memanfaatkan'],
  hal: ['aspek', 'perkara'], masalah: ['persoalan', 'kendala'], cara: ['metode', 'langkah'],
}

// Frasa generik yang khas tulisan AI + padanannya yang lebih spesifik
const AI_CLICHES = {
  'selain itu': 'Di samping itu', 'dengan demikian': 'Dengan begitu',
  'oleh karena itu': 'Karena itu', 'lebih lanjut': 'Selanjutnya',
  'akan tetapi': 'Namun', 'penting untuk': 'krusial bagi',
  'dalam era': 'di tengah', 'memainkan peran': 'berperan',
  'secara umum': 'umumnya',
}

const BUZZWORDS = new Set(['sangat', 'penting', 'berbagai', 'banyak'])

let uid = 0
const issue = (type, start, end, text, message, suggestion) =>
  ({ id: `i${++uid}`, type, start, end, text, message, suggestion, status: 'pending' })

function sentencesOf(text) {
  const out = []; const re = /[^.!?]+[.!?]*/g; let m
  while ((m = re.exec(text))) { const s = m[0]; const lead = s.length - s.trimStart().length; if (s.trim()) out.push({ text: s.trim(), start: m.index + lead }) }
  return out
}

// Kata isi kalimat (tanpa stopwords) untuk mengukur kemiripan
const contentSet = (s) => new Set((s.toLowerCase().match(/[a-zà-ÿ]+/gi) || []).filter((w) => w.length > 2 && !STOPWORDS.has(w)))
const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0
  let inter = 0; a.forEach((w) => { if (b.has(w)) inter++ })
  return inter / (a.size + b.size - inter)
}

export const similarityVerdict = (p) => (p >= 40 ? 'TINGGI' : p >= 20 ? 'SEDANG' : 'RENDAH')
export const aiLevel = (p) => (p >= 60 ? 'TINGGI' : p >= 30 ? 'SEDANG' : 'RENDAH')

export function analyze(text) {
  const issues = []
  const lower = text.toLowerCase()
  const sentences = sentencesOf(text)

  // 1. Pengulangan kata
  const words = [...text.matchAll(/[A-Za-zÀ-ÿ]+/g)].map((m) => ({ w: m[0].toLowerCase(), i: m.index, raw: m[0] }))
  const freq = {}
  words.forEach((x) => { if (x.w.length > 3 && !STOPWORDS.has(x.w)) (freq[x.w] ||= []).push(x) })
  Object.entries(freq).forEach(([w, occ]) => {
    if (occ.length >= 3) occ.slice(1).forEach((o) => {
      const syn = SYNONYMS[w]?.[0]
      issues.push(issue('repetition', o.i, o.i + o.raw.length, o.raw, `Kata "${w}" udah muncul ${occ.length} kali, coba diganti variasinya.`, syn ?? o.raw))
    })
  })

  // 2. Pola kalimat: kalimat terlalu panjang
  sentences.forEach((s) => {
    const n = s.text.split(/\s+/).length
    if (n > 30) {
      const mid = s.text.indexOf(',', Math.floor(s.text.length / 3))
      const sug = mid > 0 ? s.text.slice(0, mid) + '. ' + s.text.slice(mid + 1).trim().replace(/^./, (c) => c.toUpperCase()) : s.text
      issues.push(issue('sentence', s.start, s.start + s.text.length, s.text, `Kalimatnya panjang banget (${n} kata), mending dipecah jadi dua.`, sug))
    }
  })

  // 3. Kemiripan teks: pasangan kalimat dengan kosakata isi yang mirip (Jaccard >= 0.35)
  const sets = sentences.map((s) => contentSet(s.text))
  let maxSim = 0, simPairs = 0
  for (let i = 0; i < sentences.length; i++) {
    for (let j = i + 1; j < sentences.length; j++) {
      const sim = jaccard(sets[i], sets[j])
      if (sim > maxSim) maxSim = sim
      if (sim >= 0.35) {
        simPairs++
        const s = sentences[j], pct = Math.round(sim * 100)
        issues.push(issue('similarity', s.start, s.start + s.text.length, s.text, `Ini mirip ${pct}% sama kalimat ke-${i + 1}, coba dibedain atau digabung aja.`, s.text))
      }
    }
  }
  const similarity_pct = Math.round(maxSim * 100)

  // 4. Indikasi AI: frasa generik khas AI + keseragaman ritme + kepadatan buzzword
  const clicheHits = []
  Object.entries(AI_CLICHES).forEach(([w, alt]) => {
    for (const m of text.matchAll(new RegExp(`\\b${w}\\b`, 'gi'))) clicheHits.push({ m, alt, w })
  })
  clicheHits.forEach(({ m, alt, w }) =>
    issues.push(issue('ai', m.index, m.index + m[0].length, m[0], `Frasa "${w}" ini keseringan muncul di tulisan AI, ganti yang lebih spesifik aja.`, alt)))

  const lens = sentences.map((s) => s.text.split(/\s+/).length)
  const mean = lens.reduce((a, b) => a + b, 0) / Math.max(1, lens.length)
  const std = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, lens.length))
  const cv = mean ? std / mean : 0
  const scoreU = sentences.length >= 3 ? Math.max(0, Math.min(1, (0.55 - cv) / 0.55)) * 40 : 0
  const scoreC = Math.min(35, (clicheHits.length / Math.max(1, words.length)) * 100 * 12)
  const buzzCount = words.filter((x) => BUZZWORDS.has(x.w)).length
  const scoreB = Math.min(25, (buzzCount / Math.max(1, words.length)) * 100 * 6)
  const ai_pct = Math.min(97, Math.round(scoreU + scoreC + scoreB))
  const ai_signals = []
  if (clicheHits.length) ai_signals.push(`${clicheHits.length} frasa yang biasa dipakai AI`)
  if (sentences.length >= 3 && cv < 0.35) ai_signals.push('panjang kalimatnya mirip-mirip semua')
  if (buzzCount >= 3) ai_signals.push(`${buzzCount} kata yang itu-itu aja`)
  if (!ai_signals.length) ai_signals.push('sejauh ini aman, nggak ada yang aneh')

  // 5. Tingkat formalitas
  const INFORMAL = {
    gak: 'tidak', nggak: 'tidak', enggak: 'tidak', banget: 'sekali', aja: 'saja', udah: 'sudah',
    gimana: 'bagaimana', kayak: 'seperti', bikin: 'membuat', pake: 'memakai', tapi: 'tetapi',
    emang: 'memang', cuma: 'hanya', kalo: 'kalau', dapet: 'mendapat', gini: 'begini', gitu: 'begitu',
  }
  Object.entries(INFORMAL).forEach(([w, formal]) => {
    for (const m of text.matchAll(new RegExp(`\\b${w}\\b`, 'gi')))
      issues.push(issue('formality', m.index, m.index + m[0].length, m[0], `"${m[0]}" terlalu santai buat tulisan formal.`, formal))
  })

  // 6. Konsistensi gaya: campuran kata ganti
  const hasSaya = /\bsaya\b/i.test(lower), aku = [...text.matchAll(/\baku\b/gi)]
  if (hasSaya && aku.length) aku.forEach((m) =>
    issues.push(issue('consistency', m.index, m.index + m[0].length, m[0], 'Udah pakai "saya" terus ganti "aku", pilih salah satu aja.', 'saya')))

  // Hapus tumpang tindih
  issues.sort((a, b) => a.start - b.start)
  const clean = []; let last = -1
  for (const it of issues) if (it.start >= last) { clean.push(it); last = it.end }

  const words_count = words.length
  const score = Math.max(0, Math.round(100 - (clean.length / Math.max(1, sentences.length)) * 25))
  const summary = Object.keys(CATEGORIES).map((k) => ({
    type: k,
    count: clean.filter((i) => i.type === k).length,
    pct: k === 'similarity' ? similarity_pct : k === 'ai' ? ai_pct : null,
  }))
  return {
    issues: clean, score, summary, words_count, sentences_count: sentences.length,
    metrics: { similarity_pct, similarity_pairs: simPairs, ai_pct, ai_level: aiLevel(ai_pct), ai_signals },
  }
}

// Bangun teks revisi dari saran yang diterima
export function applySuggestions(text, issues) {
  let out = '', pos = 0
  issues.filter((i) => i.status === 'accepted').sort((a, b) => a.start - b.start).forEach((i) => {
    out += text.slice(pos, i.start) + i.suggestion; pos = i.end
  })
  return out + text.slice(pos)
}
