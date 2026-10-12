import { query } from '../db.js';

// Retensi SRS: dokumen kedaluwarsa 30 hari setelah analisis terakhir,
// kecuali dihapus lebih awal oleh pengguna. Dijalankan berkala oleh server
// (setInterval) + tersedia sebagai fungsi untuk pengujian.
export async function cleanupExpiredDocuments(limit = 500) {
  // Catatan: PostgreSQL tidak mendukung LIMIT langsung pada DELETE,
  // sehingga dipakai subselect id.
  const { rows } = await query(
    `DELETE FROM documents WHERE id IN (
       SELECT id FROM documents WHERE expires_at < now() ORDER BY expires_at ASC LIMIT $1
     ) RETURNING id`,
    [limit],
  );
  if (rows.length > 0) console.log(JSON.stringify({ event: 'retention_cleanup', deleted: rows.length }));
  return rows.length;
}

export function startRetentionJob(intervalMs = 6 * 3600 * 1000) {
  const run = () => cleanupExpiredDocuments().catch((e) => console.error('[retention]', e.message));
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  return timer;
}
