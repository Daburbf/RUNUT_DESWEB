import { createMemoryRepositories } from './memory.js';

// Titik tukar penyimpanan. Ada dua adapter:
//   - memori   (bawaan, hilang saat restart)
//   - postgres (dipakai begitu DATABASE_URL diisi)
// Routes/services hanya melihat ekspor di bawah, jadi tidak ada yang berubah
// saat adapter ditukar.
const memory = createMemoryRepositories();

// Proxy membuat panggilan selalu menuju adapter yang sedang aktif tanpa
// mendaftar ulang setiap metode saat startup memilih PostgreSQL.
const active = {
  users: memory.users,
  refreshTokens: memory.refreshTokens,
  documents: memory.documents,
  analyses: memory.analyses,
  issues: memory.issues,
};
const delegate = (name) => new Proxy({}, {
  get: (_target, prop) => active[name][prop]?.bind(active[name]),
});

export const users = delegate('users');
export const refreshTokens = delegate('refreshTokens');
export const documents = delegate('documents');
export const analyses = delegate('analyses');
export const issues = delegate('issues');

export const storage = {
  driver: 'memori',
  detail: 'memori sementara (hilang saat server dimatikan)',
  note: 'Isi DATABASE_URL untuk memakai PostgreSQL.',
};

// Dipanggil sekali saat startup. Bila PostgreSQL tidak terjangkau, server tetap
// jalan dengan memori dan alasannya dilaporkan - bukan gagal senyap.
export async function initStorage(url = process.env.DATABASE_URL || '') {
  if (!url) return storage;
  try {
    const { createPostgresRepositories } = await import('./postgres.js');
    const pg = await createPostgresRepositories(url);
    for (const name of Object.keys(active)) active[name] = pg[name];
    storage.driver = 'postgresql';
    storage.detail = 'PostgreSQL (users, documents, analysis_results, issues, refresh_tokens)';
    storage.note = 'Seluruh data website tersimpan di PostgreSQL.';
  } catch (err) {
    storage.driver = 'memori';
    storage.error = err.message;
    // Alasan ikut masuk ke detail supaya health.storage tidak berbohong.
    storage.detail = `memori sementara (hilang saat server dimatikan) - PostgreSQL tidak terpakai: ${err.message}`;
    storage.note = 'Perbaiki DATABASE_URL lalu jalankan ulang server untuk memakai PostgreSQL.';
    console.warn(`[storage] DATABASE_URL diisi tetapi PostgreSQL tidak terpakai (${err.message}) - memakai memori sementara.`);
  }
  return storage;
}

export default { users, refreshTokens, documents, analyses, issues };
