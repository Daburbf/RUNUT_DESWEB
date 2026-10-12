# Keputusan Teknis — Resolusi Ketidaksesuaian SRS / SDD Runut

Dokumen ini mencatat setiap perbedaan antara SRS, SDD, dan implementasi,
beserta keputusan yang diambil dan alasannya. Dirujuk dari kode dengan tag `(D1)` … `(D7)`.

## D1 — Stack: Node.js/Express/PostgreSQL menang atas Laravel/MySQL

- **Temuan:** Bagian definisi SRS menyebut Laravel dan MySQL, tetapi spesifikasi
  antarmuka perangkat lunak SRS + seluruh SDD menetapkan Node.js + Express +
  PostgreSQL 14+.
- **Keputusan:** Menggunakan **Node.js + Express + PostgreSQL** sebagai arsitektur utama,
  sesuai instruksi tugas (“Gunakan stack pada SDD sebagai keputusan arsitektur utama”).
- **Dampak:** Seluruh backend (`server/`), migrasi SQL, dan README mengikuti stack ini.
  Tidak ada kode Laravel/PHP di repo.

## D2 — Nama tabel pembayaran: `payments` (bukan `TRANSACTIONS`)

- **Temuan:** Diagram ERD SDD melabeli entitas `TRANSACTIONS`, sedangkan penjelasan
  skema SDD memakai nama `payments`.
- **Keputusan:** Tabel bernama **`payments`** secara konsisten (migrasi
  `001_init.sql`, `routes/payments.js`, pengujian). Tidak ada tabel `transactions`.
- **Alasan:** Penjelasan skema lebih operasional (kolom, tipe, relasi) dibanding label
  diagram; satu nama menghindari kebingungan di kode, API, dan dokumen.

## D3 — Kategori “struktur seragam” vs label “keterbacaan”

- **Temuan:** SDD tidak konsisten antara kategori “struktur seragam” dan label
  “keterbacaan” pada rancangan warna.
- **Keputusan:** Satu pemetaan kanonis enam kategori (dipakai identik di backend
  `services/stats.js` dan frontend `utils/categories.js`):
  | key | label | warna |
  |---|---|---|
  | `repetition` | Pengulangan Kata | `#B3261E` |
  | `sentence_pattern` | Pola Kalimat | `#0B57D0` |
  | `uniform_structure` | Struktur Seragam | `#7C4D00` |
  | `transition` | Transisi | `#00696B` |
  | `formality` | Tingkat Formalitas | `#6A1B9A` |
  | `style_consistency` | Konsistensi Gaya | `#37474F` |
- **Alasan:** “Struktur Seragam” sesuai FR-05 (enam kategori masalah) dan dapat
  dideteksi dari pola (kalimat berstruktur sama); “Keterbacaan” adalah skor
  turunan, bukan kategori temuan. Tidak ada kategori yang dihilangkan — frontend
  mock lama yang memakai `similarity`/`ai`/`sentence`/`consistency` dipetakan via
  `LEGACY_MAP` agar riwayat lama tetap tampil.

## D4 — Batas kata: 500 gratis / 10.000 premium (bukan 5.000)

- **Temuan:** Frontend mock lama memakai batas 5.000 kata untuk semua pengguna.
- **Keputusan:** Mengikuti FR-03: **500 kata gratis, 10.000 kata premium**,
  ditegakkan di server (`routes/analysis.js`, 403 + `code: WORD_LIMIT`).
- **Alasan:** Batas server adalah yang mengikat; frontend hanya menampilkan
  penghitung real-time dan pesan yang sama.

## D5 — Tanpa deteksi AI sebagai kategori temuan

- **Temuan:** Mock lama menampilkan “Indikasi AI %” dan “Kemiripan Teks %”.
- **Keputusan:** Kedua metrik dihapus. Prompt AI secara eksplisit melarang model
  mengklaim teks dibuat AI / memeriksa orisinalitas; validator menolak kategori
  di luar enam kunci kanonis (termasuk `plagiarism`, diuji di `test/app.test.js`).
- **Alasan:** FR-05 + larangan out-of-scope (“Jangan menambahkan deteksi AI,
  plagiarisme…”). Skor % rekaan diganti statistik deterministik (jumlah kata,
  kalimat, rata-rata, frekuensi kata).

## D6 — Retensi 30 hari via job backend, bukan fitur DB otomatis

- **Temuan:** SRS mensyaratkan dokumen kedaluwarsa 30 hari setelah analisis terakhir.
- **Keputusan:** Kolom `documents.expires_at` (= analisis terakhir + 30 hari) +
  job berkala `cleanupExpiredDocuments()` tiap 6 jam (`services/retention.js`,
  dijalankan saat server start). Tidak mengandalkan “penghapusan otomatis
  PostgreSQL” (yang memang tidak ada sebagai fitur bawaan untuk ini).
- **Alasan:** Eksplisit, teruji, dan terdokumentasi; indeks `expires_at` menjaga
  performa hapus.

## D7 — Provider AI: 9Router aktif pertama, Ollama via konfigurasi


- **Temuan:** SDD meminta 9Router aktif pertama dengan opsi Qwen3.5 via Ollama.
- **Keputusan:** Satu path kode OpenAI-compatible (`POST {base}/chat/completions`)
  untuk kedua provider; pilihan via `AI_PROVIDER`/`AI_BASE_URL`/`AI_API_KEY`/
  `AI_MODEL` saja. Nilai model tidak dikarang — wajib diisi dari akun 9Router
  pengguna; tanpa konfigurasi lengkap, `/api/analysis` menjawab **503 eksplisit**
  (tidak memalsukan hasil). Timeout default 10.000 ms (`AI_TIMEOUT_MS`).
- **Alasan:** Menghindari penulisan ulang saat ganti provider; kegagalan
  konfigurasi terlihat jelas di UI, bukan disembunyikan.

## D8 — Sinyal provisional kemiripan pola + kemiripan internal (bukan % AI / Turnitin)

- **Permintaan:** skor "AI berapa persen" dan "similarity" ala Turnitin, dibuat
  seadanya dulu agar nanti tinggal ditempel API Qwen.
- **Keputusan:** dibuat sebagai **sinyal provisional berlabel jujur**, bukan skor
  vonis (`server/src/services/signals.js`, diuji `server/test/signals.test.js`):
  - `ai_likeness` heuristik-v0 (0–100 + band rendah/sedang/tinggi): mengukur
    kemiripan POLA — repetisi kata isi, variasi panjang kalimat, kalimat sangat
    panjang, transisi berulang, keberagaman kosakata. Deterministik, selalu
    berlabel `is_estimate: true` + disclaimer "bukan deteksi AI".
  - `similarity` internal-only (shingle Jaccard k=5, 0–100%): HANYA
    membandingkan teks dengan dokumen MILIK PENGGUNA YANG SAMA (maks 20
    dokumen terakhir). Bukan cek plagiarisme internet/jurnal.
  - Slot model `fetchModelAiLikeness`: meminta JSON `{"ai_likeness":0-100,
    "reasons":[]}` via path OpenAI-compatible yang sama; tanpa konfigurasi
    lengkap ia mengembalikan `available:false` dan sistem memakai heuristik.
    Nyalakan Qwen cukup via config — tanpa ubah routes/frontend:
    `AI_PROVIDER=ollama`, `AI_BASE_URL=http://localhost:11434/v1`,
    `AI_MODEL=qwen3.5` (lihat `server/.env.example`, baris Alternatif lokal).
  - Respons `POST /api/analysis` menyertakan `analysis.signals`; sinyal ikut
    tersimpan di `analysis_results.stats->signals` dan dibaca kembali oleh
    `GET /api/documents/:id`. UI menampilkannya di kartu "Sinyal tambahan
    (provisional)" pada halaman hasil + detail dokumen
    (`src/components/SignalsCard.vue`) dengan teks eksplisit "bukan vonis AI
    dan bukan skor Turnitin".
- **Alasan:** angka % AI / similarity internet tidak bisa dihitung jujur tanpa
  database pembanding dan model terlatih — mengarangnya melanggar larangan
  statistik palsu. Struktur ini memberi nilai sementara yang berguna sambil
  menyiapkan titik tempel Qwen yang bersih.
