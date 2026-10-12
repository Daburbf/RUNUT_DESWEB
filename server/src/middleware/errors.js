export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
    this.isHttp = true;
  }
}

// Penanganan error terpusat: bentuk respons konsisten, tanpa bocor stack trace
// atau kredensial ke klien.
export function errorHandler(err, _req, res, _next) {
  const known = Boolean(err.isHttp) && Number.isInteger(err.status);
  const status = known ? err.status : 500;
  if (!known || status >= 500) console.error('[api-error]', err);
  res.status(status).json({
    // Pesan error yang disengaja (4xx/503 konfigurasi) diteruskan apa adanya;
    // hanya error tak terduga yang disamarkan agar tidak bocor detail internal.
    error: known ? (err.message || 'Permintaan tidak valid.') : 'Terjadi kesalahan pada server.',
    code: err.code || undefined,
    details: err.details || undefined,
  });
}

export function notFound(_req, res) {
  res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
}


