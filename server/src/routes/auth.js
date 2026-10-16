import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { users, refreshTokens } from '../repositories/index.js';
import { HttpError, asyncHandler } from '../middleware/errors.js';
import { signAccessToken, setRefreshCookie, clearRefreshCookie, readRefreshToken } from '../middleware/auth.js';
import { sendMail } from '../services/mailer.js';

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const RESET_TTL_MS = 30 * 60 * 1000;

export function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    is_premium: Boolean(u.is_premium),
    premium_until: u.premium_until || null,
  };
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

async function issueSession(res, user, userAgent) {
  const accessToken = signAccessToken(user);
  const refreshToken = crypto.randomBytes(48).toString('hex');
  await refreshTokens.create({
    user_id: user.id,
    token_hash: sha256(refreshToken),
    expires_at: new Date(Date.now() + config.jwt.refreshDays * 24 * 3600 * 1000).toISOString(),
    user_agent: userAgent ? String(userAgent).slice(0, 300) : null,
  });
  setRefreshCookie(res, refreshToken);
  return { user: publicUser(user), accessToken };
}

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || String(name).trim().length < 2) throw new HttpError(400, 'Nama minimal 2 karakter.');
  if (!email || !EMAIL_RE.test(String(email))) throw new HttpError(400, 'Format email tidak valid.');
  if (!password || String(password).length < 8) throw new HttpError(400, 'Kata sandi minimal 8 karakter.');
  if (await users.findByEmail(email)) throw new HttpError(409, 'Email sudah terdaftar. Silakan masuk atau gunakan email lain.');
  const created = await users.create({
    name: String(name).trim(),
    email: String(email).trim(),
    password_hash: await bcrypt.hash(String(password), 10),
  });
  res.status(201).json(await issueSession(res, created, req.headers['user-agent']));
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw new HttpError(400, 'Email dan kata sandi wajib diisi.');
  const user = await users.findByEmail(email);
  if (!user || !(await bcrypt.compare(String(password), user.password_hash))) {
    throw new HttpError(401, 'Email atau kata sandi salah.');
  }
  res.json(await issueSession(res, user, req.headers['user-agent']));
});

export const refresh = asyncHandler(async (req, res) => {
  const token = readRefreshToken(req);
  if (!token) throw new HttpError(401, 'Sesi tidak ditemukan. Silakan masuk kembali.', { code: 'NO_REFRESH' });
  const row = await refreshTokens.findByHash(sha256(token));
  if (!row || row.revoked_at || new Date(row.expires_at) < new Date()) {
    clearRefreshCookie(res);
    throw new HttpError(401, 'Sesi sudah berakhir. Silakan masuk kembali.', { code: 'REFRESH_INVALID' });
  }
  const user = await users.findById(row.user_id);
  if (!user) throw new HttpError(401, 'Akun tidak ditemukan.', { code: 'NO_USER' });
  // Rotasi: token lama dicabut, pasangan token baru diterbitkan.
  await refreshTokens.revokeById(row.id);
  res.json(await issueSession(res, user, req.headers['user-agent']));
});

export const logout = asyncHandler(async (req, res) => {
  const token = readRefreshToken(req);
  if (token) await refreshTokens.revokeByHash(sha256(token));
  clearRefreshCookie(res);
  res.json({ ok: true });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// Selalu balas generik 200 agar akun mana yang terdaftar tidak bisa ditebak.
// Token sekali pakai, berlaku 30 menit, disimpan sebagai hash.
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (!config.mail.configured) {
    throw new HttpError(503, 'Layanan email belum dikonfigurasi di server (MAIL_HOST/MAIL_USER/MAIL_PASS). Reset password via email belum bisa dipakai.', { code: 'MAIL_NOT_CONFIGURED' });
  }
  if (email && EMAIL_RE.test(String(email))) {
    const user = await users.findByEmail(email);
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await users.update(user.id, {
        reset_token_hash: sha256(token),
        reset_token_expires_at: new Date(Date.now() + RESET_TTL_MS).toISOString(),
      });
      const link = `${config.frontendUrl}/#/atur-ulang?token=${token}`;
      try {
        await sendMail({
          to: user.email,
          subject: 'Reset kata sandi Runut (berlaku 30 menit)',
          text: `Halo ${user.name},\n\nTautan reset kata sandi Anda (berlaku 30 menit):\n${link}\n\nJika Anda tidak memintanya, abaikan email ini.`,
          html: `<p>Halo ${user.name},</p><p>Tautan reset kata sandi Anda (berlaku 30 menit):</p><p><a href="${link}">${link}</a></p><p>Jika Anda tidak memintanya, abaikan email ini.</p>`,
        });
      } catch (err) {
        // Pengiriman gagal tidak boleh dilaporkan sebagai berhasil.
        console.error(JSON.stringify({ event: 'mail_failed', reason: err.message }));
        throw new HttpError(502, 'Tautan reset gagal dikirim oleh server email. Coba lagi nanti atau hubungi administrator.', { code: 'MAIL_FAILED' });
      }
    }
  }
  res.json({ ok: true, message: 'Jika email terdaftar, tautan reset telah dikirim (berlaku 30 menit).' });
});

// Token sekali pakai: setelah dipakai dihapus, dan semua sesi refresh dicabut.
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body || {};
  if (!token) throw new HttpError(400, 'Token reset wajib diisi.');
  if (!password || String(password).length < 8) throw new HttpError(400, 'Kata sandi baru minimal 8 karakter.');
  const user = await users.findByResetTokenHash(sha256(String(token)));
  if (!user || !user.reset_token_expires_at || new Date(user.reset_token_expires_at) < new Date()) {
    throw new HttpError(400, 'Token reset tidak valid atau sudah kedaluwarsa (maksimal 30 menit). Silakan minta tautan baru.');
  }
  await users.update(user.id, {
    password_hash: await bcrypt.hash(String(password), 10),
    reset_token_hash: null,
    reset_token_expires_at: null,
  });
  await refreshTokens.revokeAllForUser(user.id);
  clearRefreshCookie(res);
  res.json({ ok: true, message: 'Kata sandi berhasil diubah. Silakan masuk kembali.' });
});
