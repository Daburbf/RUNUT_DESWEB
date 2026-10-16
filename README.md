# RUNUT — Analisis & Perbaikan Pola Tulisan Berbahasa Indonesia

Full-stack: **Vue 3 + Vite** (frontend `src/`) · **Node.js + Express** (backend `server/`) ·
AI via **9Router** (endpoint kompatibel OpenAI) · pembayaran **Midtrans QRIS (Core API)** ·
auth **bcrypt + JWT access (memori) + refresh cookie HttpOnly**.

> **Status kredensial (penting):** repo ini TIDAK menyertakan API key / server key /
> kredensial SMTP asli. Tanpa `AI_*` yang valid, endpoint analisis menjawab **503
> eksplisit** (tidak memalsukan hasil). Tanpa `MIDTRANS_SERVER_KEY`, pembuatan
> transaksi menjawab **503 eksplisit**. Tanpa `PREMIUM_PRICE_IDR`, tarif belum ada →
> **503 eksplisit** (tidak ada harga rekaan). Tanpa SMTP, forgot-password menjawab
> **503 eksplisit**. Semua kegagalan konfigurasi tampil jelas di UI — bukan sukses palsu.
>
> **Belum persisten:** penyimpanan sekarang **di memori** (hilang saat server mati).
> Desain repository sudah disiapkan untuk menambah adapter PostgreSQL pada tahap
> berikutnya, tanpa mengubah route. Lihat `docs/KEPUTUSAN_TEKNIS.md` (D2).

## 1. Prasyarat & instalasi (Windows + VS Code)

| Kebutuhan | Versi |
|---|---|
| Node.js | 20+ (teruji 24) |
| Akun 9Router | API key + ID model |
| Akun Midtrans (sandbox dulu) | Server key + Client key (QRIS) |
| SMTP (mis. Mailtrap) | host/user/pass — opsional |

```powershell
# Backend
cd server
npm.cmd install
Copy-Item .env.example .env
notepad .env

# Frontend (terminal lain, dari root repo)
npm.cmd install
```

Di PowerShell, `npm` bisa diblokir ExecutionPolicy. Pakai `npm.cmd`; bila masih gagal,
panggil langsung: `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" install`

## 2. Struktur repo

```
src/                      # Frontend Vue 3 (views, components, store, utils/api.js)
server/
  src/
    index.js / app.js / config.js
    repositories/         # index.js (interface) + memory.js (adapter memori)
    middleware/           # auth JWT, error terpusat
    routes/               # auth, analysis, documents, payments
    services/             # stats, aiProvider, aiValidate, retention, mailer
  test/                   # app.test.js, units.test.js, payments.test.js  (28 tes)
  .env.example
docs/KEPUTUSAN_TEKNIS.md  # D1–D11
```

## 3. Isi `server/.env`

Minimum agar bisa login + analisis:

```env
JWT_ACCESS_SECRET=<acak min 32 char>   # kosong = kunci sementara, sesi batal saat restart
AI_PROVIDER=9router
AI_BASE_URL=http://localhost:20128/v1
AI_API_KEY=<dari dashboard 9Router>
AI_MODEL=<ID model persis dari akun 9Router — JANGAN dikarang>
```

Opsional:

```env
MIDTRANS_SERVER_KEY=<sandbox server key>
MIDTRANS_CLIENT_KEY=<sandbox client key>
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_QRIS_ACQUIRER=gopay
PREMIUM_PRICE_IDR=<isi tarif yang Anda tetapkan; kosong = transaksi 503>
MAIL_HOST=smtp.mailtrap.io   # + MAIL_PORT/USER/PASS untuk reset sandi
FRONTEND_URL=http://localhost:5173
```

Generate secret acak:
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Frontend (opsional, `.env` root): `VITE_API_URL=http://localhost:3000`

## 4. Menjalankan

```powershell
# Terminal 1 — backend (http://localhost:3000)
cd server
node src/index.js

# Terminal 2 — frontend (http://localhost:5173)
npm.cmd run dev
```

Cek `http://localhost:3000/api/health`. Field `ai.configured`, `midtrans.configured`,
`premium.price`, `mail.configured` melaporkan keadaan apa adanya (null/`false` bila kosong).

## 5. Pengujian

```powershell
cd server
$env:NODE_ENV='test'; node --test test\*.test.js   # 29/29 lolos, tanpa DB & tanpa jaringan nyata
cd ..
npm.cmd run build                                   # build Vite lolos
```

Tes backend memakai stub HTTP untuk 9Router dan Midtrans (tanpa panggilan luar).
Cakupan: stats deterministik + skor kemiripan AI/penggunaan AI · validasi AI (tolak koordinat palsu, saran berisiko,
kategori liar) · register/login/me/refresh/logout + rotasi cookie · isolasi dokumen
antar-pengguna (403) · 503 AI eksplisit · consent AI wajib · batas kata 500/10.000 ·
unduh TXT · putuskan saran (applied/rejected) + stale position (409) · QRIS charge,
proxy QR, status, webhook signature + nominal, idempotensi aktivasi premium.

## 6. Alur utama (verifikasi manual)

1. Daftar → Masuk → Analisis (tempel teks ≥20 kata atau unggah TXT/DOCX/PDF ≤5 MB). Teks dikirim ke layanan AI yang dikonfigurasi server saat tombol analisis ditekan.
2. Panel **Similarity & penggunaan AI** di halaman hasil menampilkan **Similarity %** dan **Penggunaan AI %** (dua-duanya dihitung server dari teks, bukan dari model).
3. Gratis: statistik + ≤3 masalah; saran lain terkunci → halaman **Premium**.
4. Premium: bayar QRIS (scan QR) → webhook terverifikasi → status aktif → semua saran terbuka.
5. Terapkan/tolak per saran, terapkan semua yang aman, pulihkan asli, **Bandingkan** sebelum/sesudah.
6. Unduh `.txt`/`.docx`; riwayat: cari, buka, hapus 1/banyak (konfirmasi).
7. Lupa sandi: minta tautan (email) → atur ulang ≤30 menit.

## 7. Troubleshooting (Windows + VS Code)

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| `npm` error ExecutionPolicy | PowerShell memblokir `.ps1` | pakai `npm.cmd` atau `node "...npm\bin\npm-cli.js"` |
| Analisis `503 AI_NOT_CONFIGURED` | `.env` AI kosong | isi `AI_BASE_URL/AI_API_KEY/AI_MODEL`; restart server |
| Analisis `502/504` timeout | 9Router/model lambat | naikkan `AI_TIMEOUT_MS`; hasil gagal tidak disimpan palsu |
| Bayar `503 MIDTRANS_NOT_CONFIGURED` | server key kosong | isi `MIDTRANS_SERVER_KEY`; sandbox dulu |
| Bayar `503 PRICE_NOT_CONFIGURED` | tarif belum ditetapkan | isi `PREMIUM_PRICE_IDR` (sesuai keputusan Anda) |
| Webhook 403 signature | server key beda env | samakan key dengan dashboard; cek `MIDTRANS_IS_PRODUCTION` |
| Forgot-password `503 MAIL_NOT_CONFIGURED` | SMTP kosong | isi `MAIL_*`; dev bisa pakai Mailtrap |
| Frontend `Network Error`/CORS | API mati / origin beda | pastikan API jalan; di mode dev origin `localhost`/`127.0.0.1` port apa pun sudah diizinkan, produksi pakai `FRONTEND_URL` |
| Vite pindah ke 5174 | proses lama masih memegang 5173 | tetap jalan (origin dev diizinkan); bila mau 5173, hentikan proses lama |
| Login 401 setelah restart server | JWT secret sementara berubah | isi `JWT_ACCESS_SECRET` tetap, lalu masuk ulang |
| Data hilang tiap restart | penyimpanan memori | memang belum persisten (tahap berikutnya) |
| Port 3000/5173 dipakai | proses lama | hentikan proses atau ganti `PORT` |

## 8. Keamanan & privasi

- Kata sandi bcrypt; access token **di memori browser**, refresh token cookie HttpOnly
  (`runut_rt`, path `/api/auth`) dengan rotasi; token tidak di localStorage.
- Token reset sandi SHA-256, berlaku ≤30 menit.
- API key AI hanya di server (`.env`, di-`.gitignore`); tidak ke frontend/log/respons.
- Dokumen terisolasi per-pemilik (403 bila milik orang lain).
- Premium hanya aktif via webhook terverifikasi (signature SHA512 + cek nominal);
  klaim status dari browser diabaikan.
- Rate limit: auth & analisis; upload ≤5 MB (TXT/DOCX/PDF).
- Teks dokumen hanya dikirim ke provider AI terkonfigurasi (butuh persetujuan eksplisit);
  retensi 30 hari + hapus manual.

## 9. Yang ditunda (bukan bug)

- **PostgreSQL**: saat ini adapter memori. Tambahkan adapter di `server/src/repositories/`.
- **Ollama/Qwen**: hanya 9Router yang didukung pada tahap ini.
