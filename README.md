<a id="readme-top"></a>

<br />
<div align="center">
  <img src="public/images/logo.svg" alt="Runut" width="72" height="72" />

  <h1 align="center">Runut</h1>

  <p align="center">
    Website untuk menganalisis dan memperbaiki pola tulisan berbahasa Indonesia:
    tempel teks, lihat bagian yang janggal beserta sebabnya, lalu bereskan satu per satu.
    <br />
    <br />
    <a href="docs/KEPUTUSAN_TEKNIS.md">Keputusan teknis</a>
    ·
    <a href="docs/PERUBAHAN_SRS_SDD.md">Perubahan SRS &amp; SDD</a>
    ·
    <a href="PANDUAN_JALANKAN_LOKAL.txt">Panduan menjalankan lokal</a>
  </p>
</div>

<details>
  <summary>Daftar isi</summary>
  <ol>
    <li><a href="#tentang-proyek">Tentang proyek</a></li>
    <li><a href="#dibangun-dengan">Dibangun dengan</a></li>
    <li><a href="#memulai">Memulai</a></li>
    <li><a href="#penggunaan">Penggunaan</a></li>
    <li><a href="#pengujian">Pengujian</a></li>
    <li><a href="#struktur-proyek">Struktur proyek</a></li>
    <li><a href="#batasan-jujur">Batasan jujur</a></li>
    <li><a href="#yang-ditunda">Yang ditunda</a></li>
    <li><a href="#pemecahan-masalah">Pemecahan masalah</a></li>
    <li><a href="#keamanan--privasi">Keamanan &amp; privasi</a></li>
  </ol>
</details>

## Tentang proyek

Runut menandai **kebiasaan menulis** yang membuat tulisan terasa kaku atau generik -
bukan salah ketik. Enam kategori diperiksa: pengulangan kata, pola kalimat seragam,
struktur paragraf monoton, kata transisi berulang, kata tidak baku, dan gaya yang
tidak konsisten. Setiap temuan disertai kutipan, penjelasan sebab, dan saran perbaikan
yang bisa diterima atau ditolak **satu per satu** - tidak ada perubahan otomatis.

Halaman hasil juga menampilkan **Similarity %** dan **Penggunaan AI %**. Keduanya
dihitung server secara deterministik dari teks itu sendiri (bukan keluaran model AI),
dan **bukan** hasil pemeriksaan plagiarisme: tidak ada korpus pembanding.

<p align="right">(<a href="#readme-top">kembali ke atas</a>)</p>

## Dibangun dengan

| Lapisan | Teknologi |
|---|---|
| Frontend | Vue 3, Vite, Vue Router (hash history), Tailwind CSS, Font Awesome |
| Backend | Node.js 20+, Express 4, multer, helmet, express-rate-limit |
| Autentikasi | bcryptjs, JWT access token (di memori browser), refresh cookie HttpOnly + rotasi |
| Analisis AI | 9Router (endpoint kompatibel OpenAI) melalui `server/src/services/aiProvider.js` |
| Penyimpanan | Kontrak repository dengan dua adapter: **memori** (bawaan) dan **PostgreSQL** (`pg`) untuk akun & sesi |
| Dokumen | mammoth (DOCX), pdf-parse (PDF), docx (ekspor DOCX) |

<p align="right">(<a href="#readme-top">kembali ke atas</a>)</p>

## Memulai

### Prasyarat

| Kebutuhan | Keterangan |
|---|---|
| Node.js 20+ | teruji pada Node 24 |
| 9Router | `AI_API_KEY` + **ID model persis dari akun Anda** (`AI_MODEL` wajib diisi, tidak ada bawaan) |
| PostgreSQL | opsional. Dipakai hanya untuk menyimpan akun & sesi |
| SMTP | opsional. Tanpa ini, fitur lupa sandi menjawab 503 eksplisit |

### Instalasi

```powershell
# Backend
cd server
npm.cmd install
Copy-Item .env.example .env
notepad .env          # isi AI_API_KEY dan AI_MODEL minimal

# Frontend (terminal lain, dari root repo)
npm.cmd install
```

Di PowerShell, `npm` bisa diblokir ExecutionPolicy. Pakai `npm.cmd`; bila masih gagal
panggil langsung `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" install`.

### Konfigurasi `server/.env`

Minimum agar bisa daftar, masuk, dan menganalisis:

```env
JWT_ACCESS_SECRET=<acak min 32 karakter>   # kosong = kunci sementara, sesi batal saat restart
AI_PROVIDER=9router
AI_BASE_URL=http://localhost:20128/v1
AI_API_KEY=<dari dashboard 9Router>
AI_MODEL=<ID model persis dari akun 9Router - jangan dikarang>
```

Opsional:

```env
DATABASE_URL=postgres://postgres:rahasia@localhost:5432/runut   # kosong = memori sementara
PREMIUM_PRICE_IDR=49000        # tampilan harga di halaman Premium & footer
PREMIUM_DURATION_DAYS=30
MAIL_HOST=smtp.mailtrap.io     # + MAIL_PORT/MAIL_USER/MAIL_PASS untuk lupa sandi
FRONTEND_URL=http://localhost:5173
```

Generate secret acak:
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Frontend (opsional, `.env` di root repo): `VITE_API_URL=http://localhost:3000`

### PostgreSQL untuk akun & sesi

1. Buat database, misal `runut`.
2. Isi `DATABASE_URL` di `server/.env`.
3. Jalankan server. Tabel `users` dan `refresh_tokens` **dibuat otomatis** saat koneksi
   pertama berhasil (`create table if not exists`).

Bila `DATABASE_URL` diisi tetapi database tidak terjangkau, server **tetap hidup** dengan
adapter memori dan alasan kegagalannya dicatat di log serta `GET /api/health` (`storage`).

<p align="right">(<a href="#readme-top">kembali ke atas</a>)</p>

## Penggunaan

```powershell
# Terminal 1 - backend (http://localhost:3000)
cd server
node src/index.js

# Terminal 2 - frontend (http://localhost:5173)
npm.cmd run dev
```

Periksa `http://localhost:3000/api/health`. Nilai yang dilaporkan apa adanya:
`storage` (adapter aktif), `ai.configured`, `premium.available` (selalu `false`),
`mail_configured`.

Alur utama:

1. **Daftar → Masuk** (akun disimpan di PostgreSQL bila `DATABASE_URL` diisi).
2. **Analisis**: tempel teks (≥20 kata) atau unggah TXT/DOCX/PDF ≤5 MB. Teks dikirim ke
   layanan AI yang dikonfigurasi server saat tombol analisis ditekan.
3. **Hasil**: statistik tulisan, panel **Similarity & penggunaan AI**, teks bersorotan.
   Akun gratis melihat maksimal 3 masalah; saran perbaikan terkunci.
4. **Perbaiki**: terima/tolak per saran, terapkan semua yang aman, pulihkan teks asli,
   lalu **Bandingkan** sebelum/sesudah dan unduh `.txt`/`.docx`.
5. **Riwayat**: cari, buka detail, ganti judul, hapus satu atau banyak (dengan konfirmasi).
6. **Lupa sandi**: minta tautan lewat email (berlaku ≤30 menit) - butuh SMTP.

### Premium & pembayaran

Halaman Premium **hanya menampilkan** paket Rp49.000 / 30 hari beserta daftar metode
pembayaran (QRIS, BCA Virtual Account, GoPay, OVO, DANA, ShopeePay, kartu kredit/debit,
Alfamart/Indomaret). Belum ada integrasi payment gateway: semua endpoint `/api/payments*`
menjawab `501 PAYMENTS_DISABLED`, dan tidak ada tombol pembelian yang bisa diklik.

<p align="right">(<a href="#readme-top">kembali ke atas</a>)</p>

## Pengujian

```powershell
cd server
npm.cmd test          # 26 tes lulus + 1 dilewati, tanpa DB dan tanpa jaringan nyata
cd ..
npm.cmd run build     # build Vite
```

Tes adapter PostgreSQL ikut berjalan (dan tidak lagi dilewati) kalau ada database uji:

```powershell
$env:RUNUT_TEST_DATABASE_URL='postgres://postgres:sandi@localhost:5432/runut'; npm.cmd test
```

Tes backend memakai stub HTTP untuk 9Router, jadi jalur permintaan provider ikut diuji.
Cakupan: statistik & skor deterministik · validasi keluaran AI (menolak koordinat palsu,
saran berisiko, kategori liar) · register/login/me/refresh/logout + rotasi cookie ·
isolasi dokumen antar-pengguna (403) · 503 AI eksplisit · persetujuan AI wajib ·
batas kata 500 / 10.000 · unduh TXT & DOCX · keputusan saran + stale position (409) ·
endpoint pembayaran nonaktif (501).

<p align="right">(<a href="#readme-top">kembali ke atas</a>)</p>

## Struktur proyek

```
src/                      # Frontend Vue 3
  views/                  # 14 halaman (landing, tentang, analisis, hasil, bandingkan, riwayat, premium, akun, auth)
  components/             # AppHeader, AppFooter, BaseButton, BaseCard, HighlightedText, …
  store/                  # auth, documents (draf analisis aktif)
  utils/api.js            # klien HTTP terpusat + rotasi token
public/images/            # logo.svg, ikon ilustrasi
server/
  src/
    app.js                # mount route, CORS, rate limit, /api/health
    config.js             # semua pembacaan environment
    repositories/         # index.js (titik tukar) · memory.js · postgres.js
    middleware/           # auth (JWT) + error terpusat
    routes/               # auth, analysis, documents, payments (nonaktif)
    services/             # stats, aiProvider, aiValidate, retention, mailer
  test/                   # app.test.js, units.test.js, payments.test.js, payments-notify.test.js, postgres.test.js
docs/
  KEPUTUSAN_TEKNIS.md     # catatan keputusan D1–D14
  PERUBAHAN_SRS_SDD.md    # penyesuaian terhadap dokumen SRS/SDD
```

<p align="right">(<a href="#readme-top">kembali ke atas</a>)</p>

## Batasan jujur

- **Dokumen & hasil analisis masih di memori** - hilang saat server dimatikan. Hanya
  akun dan sesi yang bisa disimpan ke PostgreSQL.
- **Similarity & Penggunaan AI bukan cek plagiarisme.** Tidak ada basis data pembanding.
- **Pembayaran belum dibuka.** Harga dan metode di halaman Premium hanya tampilan.
- **Retensi dokumen 30 hari** sejak analisis terakhir, atau sampai dihapus manual.
- **Akun Premium hanya bisa diaktifkan dari kode** (operator/pengujian), bukan lewat HTTP.
- Kegagalan provider AI **tidak pernah** diganti hasil buatan: server menjawab error nyata.

<p align="right">(<a href="#readme-top">kembali ke atas</a>)</p>

## Yang ditunda

- Adapter PostgreSQL untuk dokumen, analisis, dan saran (kini masih di memori).
- Integrasi payment gateway sungguhan setelah harga dan metode ditetapkan.
- Provider AI tambahan (mis. Ollama/Qwen) di balik antarmuka provider yang sama.

<p align="right">(<a href="#readme-top">kembali ke atas</a>)</p>

## Pemecahan masalah

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| `npm` error ExecutionPolicy | PowerShell memblokir `.ps1` | pakai `npm.cmd`, atau `node "...npm\bin\npm-cli.js"` |
| Analisis `503 AI_NOT_CONFIGURED` | `.env` AI belum lengkap | isi `AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL`, lalu restart server |
| Analisis `502/504` | model lambat atau keluaran tidak valid | naikkan `AI_TIMEOUT_MS`; hasil gagal memang tidak disimpan |
| Login 401 setelah restart | `JWT_ACCESS_SECRET` kosong (kunci acak) | isi secret tetap, lalu masuk ulang |
| Data hilang tiap restart | dokumen masih di memori | perilaku saat ini; akun tetap aman bila `DATABASE_URL` diisi |
| `storage` di health tidak berubah ke postgresql | `DATABASE_URL` salah / DB mati | cek pesan `[storage]` di log server; uji koneksi `psql` |
| Lupa sandi `503 MAIL_NOT_CONFIGURED` | SMTP kosong | isi `MAIL_*` (dev bisa pakai Mailtrap) |
| Frontend `Network Error` / CORS | API mati atau origin berbeda | pastikan API hidup; di mode dev semua origin `localhost`/`127.0.0.1` diizinkan |
| Vite pindah ke 5174 | proses lama masih memegang 5173 | tetap jalan; hentikan proses lama bila ingin 5173 |
| Port 3000/5173 terpakai | proses lama | hentikan proses atau ubah `PORT` |

<p align="right">(<a href="#readme-top">kembali ke atas</a>)</p>

## Keamanan & privasi

- Kata sandi di-hash dengan bcrypt; access token disimpan **di memori browser**, refresh
  token di cookie HttpOnly (`runut_rt`, path `/api/auth`) dengan rotasi - bukan localStorage.
- Token reset sandi disimpan sebagai SHA-256 dan berlaku ≤30 menit.
- Kredensial AI hanya di server (`.env`, di-`.gitignore`); tidak pernah masuk ke frontend,
  log, atau respons. Jangan pernah menulis kredensial asli ke repo.
- Dokumen terisolasi per pemilik (403 bila milik akun lain).
- Nilai kolom yang boleh diubah lewat `users.update()` dibatasi daftar putih, dan seluruh
  nilai dikirim sebagai parameter SQL - tidak ada penggabungan string.
- Rate limit pada endpoint auth dan analisis; unggahan dibatasi 5 MB (TXT/DOCX/PDF).
- Teks hanya dikirim ke provider AI setelah persetujuan eksplisit (`ai_consent: true`).

<p align="right">(<a href="#readme-top">kembali ke atas</a>)</p>
