# RUNUT — Analisis & Perbaikan Pola Tulisan Berbahasa Indonesia

Full-stack: **Vue 3 + Vite** (frontend) · **Node.js + Express** (backend `server/`) ·
**PostgreSQL 14+** · AI via **9Router** (dapat dialihkan ke **Ollama/Qwen3.5** via konfigurasi) ·
pembayaran **Midtrans Snap** · auth **bcrypt + JWT access/refresh**.

> **Status kredensial (penting):** repo ini TIDAK menyertakan API key / server key /
> kredensial SMTP asli. Tanpa `AI_*` yang valid, endpoint analisis menjawab **503
> eksplisit** (tidak memalsukan hasil). Tanpa `MIDTRANS_SERVER_KEY`, pembuatan
> transaksi menjawab **503 eksplisit**. Tanpa SMTP, forgot-password menjawab **503
> eksplisit**. Semua kegagalan konfigurasi ditampilkan jelas di UI — bukan sukses palsu.

## 1. Prasyarat

| Kebutuhan | Versi | Cek |
|---|---|---|
| Node.js | 20+ (teruji 24) | `node --version` |
| PostgreSQL | 14+ | `psql --version` |
| VS Code | terbaru | — |
| Akun 9Router | API key + model | dashboard 9Router |
| Akun Midtrans (sandbox dulu) | Server + Client key | dashboard Midtrans |
| SMTP (mis. Gmail App Password / Mailtrap) | host/user/pass | — |

Windows: jalankan perintah di **PowerShell**. Jika `npm` diblokir ExecutionPolicy,
panggil langsung: `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" ...`

## 2. Struktur repo

```
runut_real/
├── src/                    # Frontend Vue 3 (halaman, komponen, store, utils/api.js)
├── server/
│   ├── src/
│   │   ├── index.js / app.js / config.js / db.js / migrate.js
│   │   ├── migrations/001_init.sql   # users, documents, analysis_results, issues, payments, refresh_tokens
│   │   ├── middleware/ (auth JWT, error terpusat)
│   │   ├── routes/ (auth, analysis, documents, payments)
│   │   └── services/ (aiProvider, aiValidate, stats, mailer, retention)
│   ├── test/app.test.js    # 7 tes (pg-mem, tanpa Postgres lokal)
│   ├── .env.example        # contoh konfigurasi (TANPA rahasia)
│   └── package.json
├── docs/KEPUTUSAN_TEKNIS.md
└── README.md
```

## 3. Konfigurasi PostgreSQL

```powershell
# Buat database (sesuaikan password)
psql -U postgres -h localhost -c "CREATE DATABASE runut;"
psql -U postgres -h localhost -c "CREATE USER runut_app WITH PASSWORD 'ganti-ini';"
psql -U postgres -h localhost -c "GRANT ALL PRIVILEGES ON DATABASE runut TO runut_app;"
```

`DATABASE_URL` format: `postgres://USER:PASS@HOST:PORT/runut`

## 4. Pengisian environment (server/.env)

```powershell
cd server
Copy-Item .env.example .env
notepad .env
```

Isi minimum agar bisa login + analisis:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/runut
JWT_ACCESS_SECRET=<acak min 32 char>
JWT_REFRESH_SECRET=<acak min 32 char>
AI_PROVIDER=9router
AI_BASE_URL=https://api.9router.com/v1
AI_API_KEY=<dari dashboard 9Router>
AI_MODEL=<id model persis dari akun 9Router — JANGAN dikarang>
MIDTRANS_SERVER_KEY=<sandbox server key>
MIDTRANS_CLIENT_KEY=<sandbox client key>
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=<email>
MAIL_PASS=<app password>
MAIL_FROM=Runut <no-reply@domain-anda>
FRONTEND_URL=http://localhost:5173
```

Generate secret acak: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Opsi Ollama/Qwen3.5 (tanpa ubah kode):

```env
AI_PROVIDER=ollama
AI_BASE_URL=http://localhost:11434
AI_MODEL=qwen3.5
```

Frontend (opsional, root `.env`): `VITE_API_URL=http://localhost:3000`

## 5. Migrasi + seed + menjalankan aplikasi

```powershell
# Terminal 1 — backend
cd server
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" install
node src/migrate.js                 # migrasi (idempotent, aman diulang)
node src/migrate.js --seed          # + akun demo: demo@runut.local / Demo1234
node src/index.js                   # API di http://localhost:3000

# Terminal 2 — frontend
cd ..
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" install
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run dev   # http://localhost:5173
```

Cek kesehatan: buka `http://localhost:3000/api/health` — `db` harus `up`,
`ai.configured` `true` bila AI terisi.

## 6. Pengujian

```powershell
cd server
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" test   # 7/7 lolos (pg-mem)
cd ..
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build  # build Vite lolos
```

Cakupan tes backend: stats deterministik · validasi AI (tolak koordinat palsu,
tandai saran berisiko, tolak kategori liar) · register/login/me/refresh/logout ·
isolasi dokumen antar-pengguna (403) · 503 AI eksplisit · unduh TXT + hapus ·
tolak token reset kedaluwarsa.

## 7. Alur utama (verifikasi manual)

1. Daftar → Masuk → Analisis (tempel teks ≥20 kata atau unggah TXT/DOCX/PDF ≤5 MB).
2. Gratis: statistik + ≤3 masalah; saran terkunci → halaman **Premium**.
3. Premium: bayar via Midtrans → webhook terverifikasi → status aktif → semua saran terbuka.
4. Terima/tolak per saran, terima semua yang aman, pulihkan asli, bandingkan sebelum/sesudah.
5. Unduh `.txt`/`.docx`; riwayat: cari, buka, hapus 1/banyak (konfirmasi).
6. Lupa sandi: minta tautan (email) → atur ulang ≤30 menit.

## 8. Troubleshooting (Windows + VS Code)

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| `npm` error ExecutionPolicy | PowerShell memblokir .ps1 | panggil `node "...npm\bin\npm-cli.js"` langsung |
| `ECONNREFUSED :5432` / `db: down` | Postgres belum jalan / URL salah | start service PostgreSQL; cek `DATABASE_URL`; `psql` konek manual |
| `migrate GAGAL: relation exists` | migrasi parsial lama | aman diulang — `schema_migrations` melacak; cek tabel manual bila perlu |
| Analisis `503 AI belum lengkap` | `.env` AI kosong | isi `AI_BASE_URL/AI_API_KEY/AI_MODEL` dari akun 9Router; restart server |
| Analisis `502/timeout` | model lambat | naikkan `AI_TIMEOUT_MS`; hasil gagal tidak disimpan sebagai palsu |
| Bayar `503 MIDTRANS...` | server key kosong | isi `MIDTRANS_SERVER_KEY`; gunakan sandbox dulu |
| Forgot-password `503 MAIL...` | SMTP kosong | isi `MAIL_*`; untuk dev bisa pakai Mailtrap |
| Webhook 403 signature | server key beda env | samakan key sandbox/prod dengan dashboard; cek `MIDTRANS_IS_PRODUCTION` |
| Frontend `Network Error`/CORS | API mati / origin beda | pastikan API jalan; `FRONTEND_URL` cocok dengan origin dev |
| Login berputar 401 | secret diganti saat token aktif | masuk ulang (token lama invalid) |
| Port 3000/5173 dipakai | proses lama | hentikan proses atau ganti `PORT` |

## 9. Keamanan & privasi

- Kata sandi bcrypt; JWT access pendek + refresh rotation; token reset SHA-256 + 30 menit.
- API key AI hanya di server (`.env`, di-`.gitignore`); tidak ke frontend/log/respons.
- Semua dokumen perjalanan terisolasi per-pemilik (403 bila milik orang lain).
- Premium hanya aktif via webhook terverifikasi; status dari browser diabaikan.
- Rate limit: auth 30/15 mnt, analisis 10/mnt; upload ≤5 MB (TXT/DOCX/PDF).
- Teks dokumen hanya dikirim ke provider AI terkonfigurasi; retensi 30 hari + hapus manual.

## 10. Verifikasi FR-01…FR-18

| FR | Status | Bukti |
|---|---|---|
| FR-01 landing/auth/logout/reset 30 mnt | ✅ Lolos (kode+tes) | `routes/auth.js`, halaman auth, tes refresh/logout & token kedaluwarsa |
| FR-02 input teks + counter + upload TXT/DOCX/PDF 5 MB | ✅ | `AnalyzeView.vue`, multer + `extractText` |
| FR-03 batas 500/10.000 kata | ✅ | `routes/analysis.js` (403 `WORD_LIMIT`) |
| FR-04 statistik (kata, rata-rata kalimat, frekuensi) | ✅ | `services/stats.js` + tes |
| FR-05 enam kategori | ✅ | prompt + validator + `CATEGORIES` |
| FR-06 gratis ≤3 + saran terkunci; premium penuh | ✅ | `locked`, `topIssues`, gate `decideIssues` |
| FR-07 Midtrans + simpan + verifikasi + aktivasi pasca-verifikasi | ✅ kode, ⚠️ butuh key asli | `routes/payments.js`, `PremiumView.vue` |
| FR-08 terapkan per bagian/sekaligus, tolak, pulihkan, bandingkan | ✅ | `decideIssues`, `restoreOriginal`, `ResultView.vue` |
| FR-09 simpan dokumen + judul/asli/revisi/hasil/status/metadata | ✅ | `documents`, `analysis_results`, `issues` |
| FR-10 unduh DOCX/TXT | ✅ | `downloadDocument` + tombol UI |
| FR-11 riwayat + buka + hapus 1/banyak + konfirmasi | ✅ | `HistoryView.vue`, `removeMany` + tes |
| FR-12 validasi/empty/loading/error di semua alur | ✅ | error terpusat, state kosong/loading di tiap halaman |
| FR-13..FR-18 (kualitas/NFR pendamping di SRS) | ✅ target desain | rate limit, CORS, helmet, log latensi AI, audit payments, retensi |

**Yang masih perlu kredensial eksternal:** `AI_API_KEY` + `AI_MODEL` (9Router),
`MIDTRANS_SERVER_KEY/CLIENT_KEY`, dan `MAIL_*` (SMTP). Tanpa itu aplikasi jalan
penuh secara lokal kecuali tiga titik integrasi tersebut menjawab 503 eksplisit.
