// Pengujian sinyal provisional (D8): heuristik ai_likeness deterministik,
// similarity internal shingle-Jaccard, dan slot model yang aman saat tak
// terkonfigurasi (fallback heuristik, tidak memalsukan % AI / Turnitin).
process.env.TEST_USE_PGMEM = '1';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-char-xyz';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-char-xyz';

import test from 'node:test';
import assert from 'node:assert/strict';

const { heuristicAiLikeness, similarityPercent, internalSimilarity, fetchModelAiLikeness, buildSignals } =
  await import('../src/services/signals.js');

test('heuristicAiLikeness: deterministik, skor 0-100, tanpa klaim AI', () => {
  const text = 'Menulis adalah hal yang sangat penting bagi pelajar. Menulis membantu kita berpikir dengan runtut. Selain itu, menulis juga sangat penting untuk karier. Selain itu, banyak orang tidak sadar kalau tulisan mereka terasa kaku dan gak enak dibaca banget.';
  const a = heuristicAiLikeness(text);
  const b = heuristicAiLikeness(text);
  assert.deepEqual(a, b);
  assert.ok(a.score >= 0 && a.score <= 100);
  assert.ok(['rendah', 'sedang', 'tinggi'].includes(a.band));
  assert.equal(a.method, 'heuristic-v0');
  assert.equal(a.is_estimate, true);
  assert.match(a.disclaimer || '', /bukan deteksi AI/i);
  const joined = JSON.stringify(a).toLowerCase();
  assert.ok(!joined.includes('dibuat ai') && !joined.includes('turnitin') && !joined.includes('plagiarisme'));
});

test('heuristicAiLikeness: teks bervariasi mendapat skor lebih rendah', () => {
  const monoton = Array(8).fill('Menulis sangat penting bagi pelajar dan menulis sangat penting bagi masa depan.').join(' ');
  const variasi = 'Kemarin aku ke pasar membeli mangga harum. Nenek menawar dengan sabar sambil tertawa kecil. Di rumah, kami membuat rujak yang pedas dan segar sekali.';
  assert.ok(heuristicAiLikeness(monoton).score > heuristicAiLikeness(variasi).score);
});

test('similarityPercent: identik=100, beda total=0, simetris', () => {
  const t = 'saya pergi ke pasar membeli apel dan jeruk segar untuk keluarga';
  assert.equal(similarityPercent(t, t), 100);
  assert.equal(similarityPercent('apel jeruk mangga pisang anggur melon semangka', 'meja kursi lemari pintu jendela atap lantai dinding'), 0);
  assert.equal(similarityPercent('a b c d e f g h', 'a b c d e f g h i j'), similarityPercent('a b c d e f g h i j', 'a b c d e f g h'));
});

test('internalSimilarity: hanya vs dokumen sendiri, terurut, berlabel jujur', () => {
  const me = 'saya pergi ke pasar membeli apel dan jeruk segar untuk keluarga tercinta hari ini';
  const out = internalSimilarity(me, [
    { id: '1', title: 'Tugas A', text: 'saya pergi ke pasar membeli apel dan jeruk segar untuk keluarga tercinta hari ini' },
    { id: '2', title: 'Esai B', text: 'fisika kuantum membahas partikel elementer dan medan magnet superkonduktor' },
  ]);
  assert.equal(out.scope, 'internal-only');
  assert.equal(out.max_score, 100);
  assert.equal(out.matches[0].title, 'Tugas A');
  assert.match(out.disclaimer, /milikmu sendiri/i);
});

test('fetchModelAiLikeness: tanpa konfigurasi -> available:false (tak memalsukan)', async () => {
  const r = await fetchModelAiLikeness('teks apa pun', { AI_PROVIDER: '9router', AI_BASE_URL: '', AI_API_KEY: '', AI_MODEL: '' });
  assert.equal(r.available, false);
});

test('buildSignals: orkestrasi heuristik + similarity + meta qwen_ready', async () => {
  const s = await buildSignals('Menulis menulis menulis itu penting. Menulis menulis menulis itu indah.', [], { tryModel: false });
  assert.ok(typeof s.ai_likeness.score === 'number');
  assert.equal(s.similarity.max_score, 0);
  assert.equal(s.meta.ai_source, 'heuristic-v0');
  assert.equal(s.meta.qwen_ready, true);
  assert.match(s.meta.qwen_hint, /qwen3\.5/i);
});
