import { documents } from '../repositories/index.js';

// Retensi SRS (FR-11): dokumen kedaluwarsa 30 hari setelah analisis terakhir
// kecuali dihapus lebih awal oleh pengguna. Dijalankan berkala oleh server dan
// tersedia sebagai fungsi terpisah untuk pengujian.
export async function cleanupExpiredDocuments() {
  const deleted = await documents.deleteExpired();
  if (deleted > 0) console.log(JSON.stringify({ event: 'retention_cleanup', deleted }));
  return deleted;
}

export function startRetentionJob(intervalMs = 6 * 3600 * 1000) {
  const run = () => cleanupExpiredDocuments().catch((e) => console.error('[retention]', e.message));
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  return timer;
}
