import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { query, withTransaction } from '../db.js';
import { HttpError, asyncHandler } from '../middleware/errors.js';
import { signAccessToken } from '../middleware/auth.js';
import { sendMail } from '../services/mailer.js';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function publicUser(u) {
  return {
    id: u.id, name: u.name, email: u.email,
    is_premium: Boolean(u.is_premium), premium_until: u.premium_until || null,
  };
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || String(name).trim().length < 2) throw new HttpError(400, 'Nama minimal 2 karakter.');
  if (!email || !EMAIL_RE.test(String(email))) throw new HttpError(400, 'Format email tidak valid.');
  if (!password || String(password).length < 8) throw new HttpError(400, 'Kata sandi minimal 8 karakter.');
  const normalized = String(email).trim().toLowerCase();
  const exists = await query('SELECT id FROM users WHERE lower(email) = $1', [normalized]);
  if (exists.rowCount > 0) throw new HttpError(409, 'Email sudah terdaftar. Silakan masuk atau gunakan email lain.');
  const hash = await bcrypt.hash(String(password), 10);
  const { rows } = await query(
    'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, is_premium, premium_until',
    [String(name).trim(), String(email).trim(), hash],
  );
  const user = rows[0];
  const { accessToken, refreshToken } = await issueSession(user.id, req.headers['user-agent']);
  res.status(201).json({ user: publicUser(user), accessToken, refreshToken });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw new HttpError(400, 'Email dan kata sandi wajib diisi.');
  const { rows } = await query('SELECT * FROM users WHERE lower(email) = lower($1)', [String(email).trim()]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(String(password), user.password_hash))) {
    throw new HttpError(401, 'Email atau kata sandi salah.');
  }
  const { accessToken, refreshToken } = await issueSession(user.id, req.headers['user-agent']);
  res.json({ user: publicUser(user), accessToken, refreshToken });
});

async function issueSession(userId, userAgent) {
  const { rows } = await query('SELECT id, name, email, is_premium, premium_until FROM users WHERE id = $1', [userId]);
  const user = rows[0];
  const accessToken = signAccessToken(user);
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + config.jwt.refreshDays * 24 * 3600 * 1000);
  await query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent) VALUES ($1, $2, $3, $4)',
    [userId, sha256(refreshToken), expiresAt.toISOString(), userAgent ? String(userAgent).slice(0, 300) : null],
  );
  return { accessToken, refreshToken, user };
}

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) throw new HttpError(400, 'Refresh token wajib diisi.');
  const { rows } = await query(
    'SELECT rt.*, u.name, u.email, u.is_premium, u.premium_until FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = $1',
    [sha256(String(refreshToken))],
  );
  const row = rows[0];
  if (!row || row.revoked_at || new Date(row.expires_at) < new Date()) {
    throw new HttpError(401, 'Refresh token tidak valid atau kedaluwarsa. Silakan masuk kembali.');
  }
  // Rotasi: cabut token lama, terbitkan pasangan baru.
  await withTransaction(async (client) => {
    await client.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [row.id]);
  });
  const { accessToken, refreshToken: next } = await issueSession(row.user_id, req.headers['user-agent']);
  res.json({
    user: publicUser({ id: row.user_id, name: row.name, email: row.email, is_premium: row.is_premium, premium_until: row.premium_until }),
    accessToken, refreshToken: next,
  });
});

export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) {
    await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1', [sha256(String(refreshToken))]);
  }
  res.json({ ok: true });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// POST /auth/forgot-password — selalu balas generik 200 agar tidak membocorkan
// akun mana yang terdaftar (anti-enumerasi). Token kedaluwarsa 30 menit (FR-01).
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (!config.mail.configured) {
    throw new HttpError(503, 'Layanan email belum dikonfigurasi di server. Hubungi administrator agar SMTP diisi (MAIL_*), lalu coba lagi.', { code: 'MAIL_NOT_CONFIGURED' });
  }
  if (email && EMAIL_RE.test(String(email))) {
    const { rows } = await query('SELECT id, name FROM users WHERE lower(email) = lower($1)', [String(email).trim()]);
    if (rows.length > 0) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 30 * 60 * 1000);
      await query('UPDATE users SET reset_token_hash = $1, reset_token_expires_at = $2 WHERE id = $3',
        [sha256(token), expires.toISOString(), rows[0].id]);
      const link = `${config.frontendUrl}/#/atur-ulang?token=${token}`;
      await sendMail({
        to: String(email).trim(),
        subject: 'Reset kata sandi Runut (berlaku 30 menit)',
        text: `Halo ${rows[0].name},\n\nTautan reset kata sandi Anda (berlaku 30 menit):\n${link}\n\nJika Anda tidak memintanya, abaikan email ini.`,
        html: `<p>Halo ${rows[0].name},</p><p>Tautan reset kata sandi Anda (berlaku 30 menit):</p><p><a href="${link}">${link}</a></p><p>Jika Anda tidak memintanya, abaikan email ini.</p>`,
      }).catch((e) => console.error('[mail] gagal kirim reset:', e.message));
    }
  }
  res.json({ ok: true, message: 'Jika email terdaftar, tautan reset telah dikirim (berlaku 30 menit).' });
});

// POST /auth/reset-password { token, password }
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body || {};
  if (!token) throw new HttpError(400, 'Token reset wajib diisi.');
  if (!password || String(password).length < 8) throw new HttpError(400, 'Kata sandi baru minimal 8 karakter.');
  const { rows } = await query('SELECT id, reset_token_expires_at FROM users WHERE reset_token_hash = $1', [sha256(String(token))]);
  const user = rows[0];
  if (!user || !user.reset_token_expires_at || new Date(user.reset_token_expires_at) < new Date()) {
    throw new HttpError(400, 'Token reset tidak valid atau sudah kedaluwarsa (maksimal 30 menit). Silakan minta tautan baru.');
  }
  const hash = await bcrypt.hash(String(password), 10);
  await withTransaction(async (client) => {
    await client.query(
      'UPDATE users SET password_hash = $1, reset_token_hash = NULL, reset_token_expires_at = NULL, updated_at = now() WHERE id = $2',
      [hash, user.id],
    );
    // Cabut semua sesi refresh agar perangkat lain harus masuk ulang.
    await client.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [user.id]);
  });
  res.json({ ok: true, message: 'Kata sandi berhasil diubah. Silakan masuk kembali.' });
});

