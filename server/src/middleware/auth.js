import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';
import { HttpError } from './errors.js';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, premium: Boolean(user.is_premium) },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessTtl },
  );
}

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Token akses tidak ditemukan. Silakan masuk kembali.', { code: 'NO_TOKEN' });
    let payload;
    try {
      payload = jwt.verify(token, config.jwt.accessSecret);
    } catch {
      throw new HttpError(401, 'Sesi kedaluwarsa atau tidak valid. Silakan masuk kembali.', { code: 'INVALID_TOKEN' });
    }
    const { rows } = await query('SELECT id, name, email, is_premium, premium_until FROM users WHERE id = $1', [payload.sub]);
    if (rows.length === 0) throw new HttpError(401, 'Akun tidak ditemukan.', { code: 'NO_USER' });
    const u = rows[0];
    // Premium kedaluwarsa: turunkan status secara malas (lazy) saat dibaca.
    if (u.is_premium && u.premium_until && new Date(u.premium_until) < new Date()) {
      await query('UPDATE users SET is_premium = FALSE WHERE id = $1', [u.id]);
      u.is_premium = false;
    }
    req.user = u;
    next();
  } catch (err) {
    next(err);
  }
}
