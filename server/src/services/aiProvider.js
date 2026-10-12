// Lapisan provider AI — terpisah dari logika bisnis analisis.
// Ganti provider cukup via konfigurasi (AI_PROVIDER/AI_BASE_URL/AI_API_KEY/AI_MODEL),
// tanpa menyentuh routes, database, atau frontend.
//
// Provider aktif pertama: 9Router (protokol chat-completions yang kompatibel
// OpenAI: POST {baseUrl}/chat/completions). Jangan mengarang ID model: nilai
// AI_MODEL harus diisi dari model yang tersedia di akun 9Router pengguna.

export class AiError extends Error {
  constructor(message, { code = 'AI_ERROR', status = 502, retryable = true } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function timeoutFetch(url, options, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new Error('timeout')), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

export function getProviderInfo(env = process.env) {
  const provider = String(env.AI_PROVIDER || '9router').toLowerCase();
  const baseUrl = String(env.AI_BASE_URL || '').replace(/\/$/, '');
  return {
    provider,
    baseUrl,
    model: env.AI_MODEL || '',
    timeoutMs: Number(env.AI_TIMEOUT_MS || 10000),
    configured: Boolean(baseUrl && (env.AI_MODEL || '') && (provider === 'ollama' || (env.AI_API_KEY || ''))),
  };
}

function buildSystemPrompt() {
  return [
    'Anda adalah pemeriksa pola tulisan berbahasa Indonesia bernama Runut.',
    'Temukan HANYA masalah berdasarkan teks yang diberikan pengguna.',
    'Aturan ketat:',
    '1. Jangan mengklaim teks dibuat oleh AI dan jangan memeriksa orisinalitas/plagiarisme.',
    '2. Jangan mengarang kesalahan yang tidak ada di teks.',
    '3. Jangan mengubah fakta, angka, nama, definisi, atau maksud penulis.',
    '4. Gunakan kategori HANYA dari daftar: repetition, sentence_pattern, uniform_structure, transition, formality, style_consistency.',
    '5. Setiap issue memakai indeks karakter 0-based terhadap teks asli persis: start inklusif, end eksklusif, dan "text" HARUS sama persis dengan potongan teks asli pada rentang itu.',
    '6. "suggestion" adalah perbaikan minimal yang mempertahankan makna; jika ragu, tetap isi suggestion terbaik lalu tandai "needs_review": true.',
    '7. "explanation" berbahasa Indonesia, spesifik, maksimal 2 kalimat, tanpa pola berulang yang sama untuk semua issue.',
    '8. Jawab HANYA dengan JSON valid berbentuk {"issues":[{...}]} tanpa teks lain, tanpa markdown.',
  ].join('\n');
}

function buildUserPrompt(text, maxIssues) {
  return [
    `Analisis teks berikut dan kembalikan maksimal ${maxIssues} masalah paling signifikan.`,
    'Skema tiap issue: {"type":"<kategori>","start":<int>,"end":<int>,"text":"<kutipan persis>","explanation":"<id>","suggestion":"<id>","needs_review":<bool>}.',
    'Teks yang dianalisis:',
    '<<<',
    text,
    '>>>',
  ].join('\n');
}

function extractJson(raw) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new AiError('Respons model tidak memuat JSON.', { code: 'AI_BAD_JSON', retryable: false });
  const slice = raw.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    throw new AiError('Respons model bukan JSON valid.', { code: 'AI_BAD_JSON', retryable: false });
  }
}

// OpenAI-compatible chat completions — dipakai 9Router maupun Ollama
// (Ollama juga melayani /api/chat; tetapi endpoint /v1/chat/completions
// tersedia dan dipilih agar satu path kode untuk kedua provider).
async function chatCompletions({ baseUrl, apiKey, model, system, user, timeoutMs }) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  let res;
  try {
    res = await timeoutFetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    }, timeoutMs);
  } catch (err) {
    if (String(err?.message).includes('timeout') || err?.name === 'AbortError') {
      throw new AiError(`Permintaan AI melewati batas waktu ${timeoutMs} ms.`, { code: 'AI_TIMEOUT' });
    }
    throw new AiError(`Tidak dapat menghubungi provider AI: ${err.message}`, { code: 'AI_UNREACHABLE' });
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new AiError(`Provider AI menjawab HTTP ${res.status}. ${body.slice(0, 200)}`, {
      code: 'AI_HTTP_' + res.status,
      status: res.status === 401 || res.status === 403 ? 503 : 502,
      retryable: res.status >= 500,
    });
  }
  const data = await res.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new AiError('Respons model kosong.', { code: 'AI_EMPTY', retryable: false });
  }
  return content;
}

export async function analyzeWithProvider(text, { maxIssues = 20 } = {}, env = process.env) {
  const info = getProviderInfo(env);
  if (!info.configured) {
    throw new AiError(
      'Konfigurasi AI belum lengkap (AI_BASE_URL/AI_API_KEY/AI_MODEL). Lengkapi file server/.env lalu ulangi.',
      { code: 'AI_NOT_CONFIGURED', status: 503, retryable: false },
    );
  }
  if (info.provider !== '9router' && info.provider !== 'ollama') {
    throw new AiError(`AI_PROVIDER "${info.provider}" tidak didukung. Gunakan "9router" atau "ollama".`, {
      code: 'AI_BAD_PROVIDER', status: 503, retryable: false,
    });
  }
  const started = Date.now();
  const raw = await chatCompletions({
    baseUrl: info.baseUrl,
    apiKey: info.provider === 'ollama' ? '' : env.AI_API_KEY,
    model: info.model,
    system: buildSystemPrompt(),
    user: buildUserPrompt(text, maxIssues),
    timeoutMs: info.timeoutMs,
  });
  const parsed = extractJson(raw);
  return { parsed, latencyMs: Date.now() - started, provider: info.provider, model: info.model };
}
