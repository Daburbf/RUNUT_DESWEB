// Lapisan provider AI - terpisah dari aturan bisnis analisis.
// Satu-satunya provider yang diimplementasikan pada tahap ini: 9Router
// (endpoint kompatibel OpenAI: POST {baseUrl}/chat/completions).
// Menambah provider lain (mis. Qwen via Ollama) cukup menambah entri di
// PROVIDERS tanpa mengubah routes, penyimpanan, atau frontend.
export class AiError extends Error {
  constructor(message, { code = 'AI_ERROR', status = 502, retryable = true } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

const PROVIDERS = {
  '9router': {
    label: '9Router',
    requiresApiKey: true,
    endpoint: (baseUrl) => `${baseUrl}/chat/completions`,
  },
};

export function getProviderInfo(env = process.env) {
  const provider = String(env.AI_PROVIDER || '9router').toLowerCase();
  const baseUrl = String(env.AI_BASE_URL || '').replace(/\/$/, '');
  const impl = PROVIDERS[provider];
  return {
    provider,
    baseUrl,
    model: env.AI_MODEL || '',
    timeoutMs: Number(env.AI_TIMEOUT_MS || 10000),
    configured: Boolean(impl && baseUrl && env.AI_MODEL && (!impl.requiresApiKey || env.AI_API_KEY)),
  };
}

function buildSystemPrompt() {
  return [
    'Anda adalah pemeriksa pola tulisan berbahasa Indonesia bernama Runut.',
    'Temukan HANYA masalah yang benar-benar ada pada teks yang diberikan.',
    'Aturan ketat:',
    '1. Jangan menilai orisinalitas, plagiarisme, atau apakah teks dibuat AI. Jangan mengeluarkan skor apa pun.',
    '2. Jangan mengarang temuan. Jika bukti tidak cukup, kembalikan issues kosong.',
    '3. Jangan mengubah fakta, angka, nama, definisi, atau maksud penulis.',
    '4. Gunakan kategori HANYA dari daftar: repetition, sentence_pattern, uniform_structure, transition, formality, style_consistency.',
    '5. Setiap issue memakai indeks karakter 0-based pada teks asli: start inklusif, end eksklusif, dan "text" HARUS identik dengan substring teks asli pada rentang itu. Jangan menandai teks yang sama lebih dari sekali.',
    '6. "explanation" menyebut bukti yang bisa ditunjukkan dari teks (mis. berapa kali muncul, di bagian mana), maksimal 2 kalimat, dan berbeda untuk setiap issue. Hindari kalimat umum seperti "kalimat ini kurang efektif".',
    '7. "suggestion" adalah perbaikan minimal di sekitar kutipan; isi "needs_review": true bila saran berpotensi mengubah nama, angka, istilah penting, definisi, atau inti kalimat.',
    '8. Kata umum, kata hubung, istilah teknis, dan nama yang berulang secara wajar bukan masalah.',
    '9. Jawab HANYA dengan JSON valid berbentuk {"issues":[{...}]} tanpa teks tambahan dan tanpa markdown.',
  ].join('\n');
}

function buildUserPrompt(text, maxIssues) {
  return [
    `Analisis teks berikut. Kembalikan maksimal ${maxIssues} masalah paling kuat buktinya.`,
    'Skema tiap issue: {"type":"<kategori>","start":<int>,"end":<int>,"text":"<kutipan persis>","explanation":"<penjelasan>","suggestion":"<saran>","needs_review":<bool>}.',
    'Bila tidak ada masalah yang terbukti, kembalikan {"issues":[]}.',
    'Teks yang dianalisis:',
    '<<<',
    text,
    '>>>',
  ].join('\n');
}

function extractJson(raw) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new AiError('Respons model tidak memuat JSON.', { code: 'AI_BAD_JSON', retryable: false });
  }
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new AiError('Respons model bukan JSON valid.', { code: 'AI_BAD_JSON', retryable: false });
  }
}

async function postJson(url, { headers, body, timeoutMs }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function explainHttpStatus(status, body) {
  if (status === 401 || status === 403) {
    return new AiError('Provider AI menolak kredensial (HTTP ' + status + '). Periksa AI_API_KEY pada server/.env.', { code: 'AI_AUTH_' + status, status: 503, retryable: false });
  }
  if (status === 404) {
    return new AiError('Model atau endpoint tidak ditemukan di provider AI (HTTP 404). Periksa AI_MODEL dan AI_BASE_URL - gunakan ID model yang benar-benar tersedia di dashboard 9Router.', { code: 'AI_MODEL_NOT_FOUND', status: 503, retryable: false });
  }
  if (status === 429) {
    return new AiError('Provider AI membatasi permintaan (HTTP 429). Coba lagi beberapa saat.', { code: 'AI_RATE_LIMIT', status: 429, retryable: true });
  }
  return new AiError(`Provider AI menjawab HTTP ${status}. ${String(body).slice(0, 200)}`, { code: 'AI_HTTP_' + status, status: 502, retryable: true });
}

// Parameter permintaan sengaja minimal (model, messages, temperature) karena
// tidak semua model mendukung parameter tambahan seperti response_format.
export async function analyzeWithProvider(text, { maxIssues = 30 } = {}, env = process.env) {
  const info = getProviderInfo(env);
  const impl = PROVIDERS[info.provider];
  if (!impl) {
    throw new AiError(`Provider AI "${info.provider}" belum diimplementasikan. Tambahkan entri di services/aiProvider.js.`, { code: 'AI_BAD_PROVIDER', status: 503, retryable: false });
  }
  if (!info.configured) {
    throw new AiError('Konfigurasi AI belum lengkap. Isi AI_BASE_URL, AI_API_KEY, dan AI_MODEL di server/.env lalu coba lagi.', { code: 'AI_NOT_CONFIGURED', status: 503, retryable: false });
  }
  const started = Date.now();
  let res;
  try {
    res = await postJson(impl.endpoint(info.baseUrl), {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.AI_API_KEY}` },
      body: {
        model: info.model,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(text, maxIssues) },
        ],
        temperature: 0.2,
      },
      timeoutMs: info.timeoutMs,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new AiError(`Permintaan AI melewati batas waktu ${info.timeoutMs} ms.`, { code: 'AI_TIMEOUT', status: 504, retryable: true });
    }
    throw new AiError(`Tidak dapat menghubungi provider AI di ${info.baseUrl}: ${err.message}`, { code: 'AI_UNREACHABLE', status: 503, retryable: true });
  }
  if (!res.ok) throw explainHttpStatus(res.status, await res.text().catch(() => ''));
  const data = await res.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new AiError('Respons model kosong.', { code: 'AI_EMPTY', retryable: false });
  }
  return {
    parsed: extractJson(content),
    latencyMs: Date.now() - started,
    provider: info.provider,
    model: info.model,
  };
}
