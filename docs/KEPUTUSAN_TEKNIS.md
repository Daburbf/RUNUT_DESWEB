# Keputusan Teknis - Resolusi Ketidaksesuaian SRS / SDD Runut

Dokumen ini mencatat perbedaan antara SRS, SDD, dan implementasi, beserta
keputusan yang diambil dan alasannya. Tag `(D1)` ... `(D9)` dirujuk dari kode.

## D1 - Stack: Node.js + Express + Vue 3 + Vite

- **Temuan:** bagian definisi SRS menyebut Laravel/MySQL, tetapi spesifikasi
  antarmuka SRS dan seluruh SDD menetapkan Node.js + Express + PostgreSQL,
  dengan frontend Vue 3 + Vite.
- **Keputusan:** mengikuti SDD - **Vue 3 + Vite (frontend)** dan
  **Node.js + Express (backend `server/`)**, JavaScript konsisten, tanpa
  abstraksi berlebih. Tidak ada kode Laravel/PHP di repo.

## D2 - Penyimpanan sementara in-memory di balik antarmuka repository

- **Temuan:** SDD memuat skema SQL PostgreSQL, sementara tugas tahap ini
  melarang PostgreSQL/skema/migration/ORM.
- **Keputusan:** seluruh akses data lewat kontrak repository
  (`server/src/repositories/index.js`) dengan adapter memori
  (`repositories/memory.js`). Tabel: `users`, `refresh_tokens`, `documents`,
  `analyses`, `issues`, `payments`. Logika bisnis tidak menyentuh implementasi
  memori, sehingga adapter PostgreSQL ditambahkan nanti di satu titik tukar.
- **Batas jujur:** data **bukan persisten** - hilang saat server dimulai ulang.
  Tidak diklaim siap produksi. LocalStorage **tidak** dipakai sebagai basis data.

## D3 - Enam kategori & warna (struktur seragam mengambil slot oranye)

- **Temuan:** SDD tidak konsisten menyelaraskan kategori "struktur seragam"
  dengan label warna "keterbacaan".
- **Keputusan:** enam kategori kanonis dengan warna SRS (kuning, biru, hijau,
  ungu, oranye, abu-abu). Slot oranye dipakai untuk `uniform_structure`
  (ritme/monotoni) agar keenam kategori tetap terwakili; tidak ada kategori
  ketujuh dan tidak ada yang dihilangkan.

  | key | label | warna SRS | hex |
  |---|---|---|---|
  | `repetition` | Pengulangan Kata | kuning | `#B58900` |
  | `sentence_pattern` | Pola Kalimat | biru | `#0B57D0` |
  | `uniform_structure` | Struktur Seragam | oranye | `#C2410C` |
  | `transition` | Transisi | hijau | `#15803D` |
  | `formality` | Tingkat Formalitas | ungu | `#7E22CE` |
  | `style_consistency` | Konsistensi Gaya | abu-abu | `#4B5563` |

- Sumber kebenaran ada di `server/src/services/stats.js` (`CATEGORIES`);
  `src/utils/categories.js` menyalin hex tersebut persis.

## D4 - Batas kata: 500 gratis / 10.000 premium - **DIGANTI oleh D16**

- **Keputusan:** FR-03 ditegakkan **di server** (`routes/analysis.js`, HTTP 403
  `code: WORD_LIMIT`). Frontend hanya menampilkan penghitung kata real-time dan
  batas yang sama, bukan penentu.

## D5 - Tidak ada AI score, kemungkinan tulisan AI, atau similarity eksternal

- **Temuan:** fitur "Indikasi AI %" dan "Kemiripan Teks %" pernah ada.
- **Keputusan:** keduanya **dihapus** (backend, frontend, dan tes). Prompt AI
  melarang model menilai asal-usul teks atau orisinalitas; validator menolak
  `type` di luar enam kategori kanonis. Ukuran yang ditampilkan hanya berasal
  dari teks yang diperiksa: jumlah kata, jumlah kata unik, frekuensi kata,
  rata-rata & variasi panjang kalimat, jumlah temuan per kategori, dan kutipan.
- **Catatan istilah:** "similarity" hanya berarti kemiripan pola **di dalam**
  dokumen yang sedang diperiksa, bukan perbandingan dengan karya lain.

## D6 - Pemeringkatan masalah berbasis bukti, bukan skor model

- **Keputusan:** `rankIssues()` memilih masalah untuk hasil gratis memakai bukti
  yang dapat diverifikasi ulang dari teks:
  `3*(jumlah kemunculan-1) + 2*(jumlah paragraf-1) + (rentang >= 4 kata ? 1 : 0)`,
  dengan urutan cadangan: non-manual -> kutipan lebih panjang -> posisi lebih awal.
  Ini **bukan** persentase kualitas/keaslian dan tidak disajikan sebagai skor.

## D7 - Status saran `active` | `applied` | `rejected`

- **Keputusan:** tiga status ini dipakai konsisten di backend, API, dan
  frontend. Teks asli disimpan terpisah dari teks revisi; "terapkan semua" hanya
  menyentuh saran yang masih `active` dan tidak `needs_manual_review`. Kutipan
  diperiksa ulang terhadap teks pada posisinya sebelum diterapkan; bila posisi
  sudah basi, penerapan dibatalkan (HTTP 409 `STALE_POSITION`). Saran yang
  berpotensi mengubah nama/angka/istilah penting ditandai `needs_manual_review`
  dan tidak pernah diterapkan otomatis.

## D8 - Sesi: access token di memori, refresh token di cookie HttpOnly

- **Keputusan:** access token (JWT, masa berlaku <= 1 jam) hanya hidup di memori
  klien; refresh token disimpan server sebagai hash di repository dan dikirim
  sebagai cookie **HttpOnly** `runut_rt` (path `/api/auth`). Rotasi: token lama
  dicabut setiap refresh. **Tidak ada token apa pun di localStorage.** Saat
  halaman dimuat ulang, sesi dipulihkan dari cookie (`POST /api/auth/refresh`
  tanpa body).

## D9 - Pembayaran premium memakai QRIS Midtrans (Core API), bukan Snap

- **Temuan:** permintaan tambahan menetapkan QRIS lewat dokumentasi resmi
  Midtrans (`https://docs.midtrans.com/reference/qris`).
- **Keputusan:** `POST {api}/v2/charge` dengan `payment_type: "qris"` dan
  `qris.acquirer` dari konfigurasi. Yang ditampilkan ke pengguna adalah kode QR
  asli dari Midtrans: gambar diambil lewat proxy berautentikasi
  `GET /api/payments/:orderId/qr` (URL aksi `generate-qr-code` dari respons
  Midtrans butuh Basic auth, jadi tidak bisa dibuka langsung oleh browser).
  Tidak ada QR yang dibuat sendiri dan tidak ada QR statis.
- **Status:** `pending`, `success`, `failed`, `expired`, `cancelled` dipetakan
  dari `transaction_status` Midtrans (`pending`, `settlement`/`capture`,
  `deny`/`failure`, `expire`, `cancel`). Premium diperpanjang **hanya** pada
  transisi pertama ke `success` (notifikasi berulang tidak menggandakan hak).
- **Verifikasi:** signature `SHA512(order_id + status_code + gross_amount +
  serverKey)` diperiksa pada webhook; nominal notifikasi harus sama dengan
  nominal yang ditagih. Redirect/parameter URL dari browser tidak pernah
  dipercaya.
- **Harga:** SRS/SDD tidak menetapkan tarif, jadi **tidak ada harga bawaan**.
  Tanpa `PREMIUM_PRICE_IDR`, pembuatan transaksi menjawab 503
  `PRICE_NOT_CONFIGURED`. Nominal yang dikirim klien diabaikan.
- **Sandbox/production:** dipisah lewat `MIDTRANS_IS_PRODUCTION` (host
  `api.sandbox.midtrans.com` vs `api.midtrans.com`). `MIDTRANS_API_BASE` hanya
  untuk mengarahkan ke lingkungan uji.
- **Batas jujur:** transaksi disimpan di memori - hilang saat restart. Alur
  belum diklaim siap produksi sebelum penyimpanan persisten ada.

## D10 - Provider AI 9Router aktif; Qwen/Ollama ditunda

- **Keputusan:** satu jalur OpenAI-compatible (`POST {base}/chat/completions`,
  `Authorization: Bearer <key>`, tanpa `response_format`) lewat
  `services/aiProvider.js`. Model wajib dari akun 9Router pengguna; tidak ada ID
  model yang dikarang. Tanpa konfigurasi lengkap, analisis menjawab 503
  `AI_NOT_CONFIGURED`; model tidak ditemukan -> 404; timeout (`AI_TIMEOUT_MS`,
  bawaan 10.000 ms) -> 504. Kegagalan tidak pernah diganti hasil palsu dan tidak
  disimpan sebagai analisis sah.
- **Privasi:** teks hanya dikirim setelah pengguna mencentang persetujuan
  (`ai_consent: true`). Tanpa itu, server menolak dengan 400
  `AI_CONSENT_REQUIRED`.
- **Ditunda:** Ollama/Qwen3.5 adalah provider tambahan di balik antarmuka
  provider yang sama; belum diimplementasikan pada tahap ini.

## D11 - Retensi dokumen 30 hari

- **Keputusan:** `documents.expires_at` = analisis terakhir + 30 hari, dengan job
  berkala `cleanupExpiredDocuments()` tiap 6 jam (`services/retention.js`).
  Penghapusan otomatis ini tetap berjalan di atas adapter memori; validasi
  kepemilikan dokumen tetap berlaku untuk setiap operasi.

## D12 - Similarity dan Penggunaan AI (di luar SRS awal)

- **Konteks:** SRS/SDD awal melarang skor AI dan pemeriksaan kemiripan. Pemilik
  produk meminta keduanya ditambahkan dan menyatakan akan menyesuaikan dokumen
  SRS/SDD sendiri. Keputusan ini mencatat bentuk implementasinya, bukan sebagai
  fitur resmi SRS.
- **Keputusan:** `computeScores()` di `services/stats.js` menghitung dua angka
  0-100 secara deterministik dari teks (tidak ada panggilan model):
  - **Similarity** - seberapa sering teks mengulang kata isi, frasa, dan
    pembuka kalimatnya sendiri (bobot 0,5 / 0,3 / 0,2).
  - **Penggunaan AI** - keseragaman panjang kalimat
    (`sentence_length_variation / avg_sentence_length`), pembuka berulang, frasa
    berulang, dan tidak adanya kalimat pendek (bobot 0,35 / 0,25 / 0,2 / 0,2).
- **Label di UI (permintaan pemilik produk, di luar SRS):** kedua angka tampil
  apa adanya sebagai `Similarity %` dan `Penggunaan AI %`, tanpa kata
  "perkiraan". Teks penjelas di UI memakai definisi umum similarity (kesamaan
  teks dengan teks lain di basis data, seperti Turnitin Similarity). Perlu
  dicatat jujur di dokumen: yang benar-benar dihitung implementasi ini adalah
  pengulangan **di dalam teks itu sendiri** - tidak ada basis data pembanding,
  jadi angkanya bukan hasil pemeriksaan plagiarisme. Batas ini ada di komentar
  `computeScores()`.
- **Hasil disimpan** di `analysis.stats.scores` sehingga ikut terbaca ulang lewat
  `GET /api/documents/:id` dan ditampilkan panel "Skor kemiripan & AI" di
  `views/ResultView.vue`. Bukan kategori ketujuh (tidak menyentuh warna/kategori SRS).

## D9b - Mode simulasi pembayaran QRIS (permintaan lanjutan)

- **Temuan:** dengan kredensial Midtrans kosong, alur QRIS tidak bisa dilihat sama sekali:
  tombol bayar disembunyikan dan `POST /api/payments` menjawab 503.
- **Keputusan:** bila `MIDTRANS_SERVER_KEY` kosong (atau `MIDTRANS_SIMULATE=true`), pembayaran
  berjalan di **mode simulasi** - transaksi dibuat di memori, kode QR digambar server sebagai
  SVG lokal (bukan QRIS asli, tidak bisa dipindai), dan tombol "Periksa status" menandai lunas
  lewat `syncOutcome` yang sama sehingga premium tidak pernah digandakan.
- **Tarif:** `PREMIUM_PRICE_IDR` tetap prioritas; bila kosong, mode simulasi memakai
  `PREMIUM_DEMO_PRICE_IDR` (bawaan 25000) dan UI menandainya "tarif simulasi".
- **Batas jujur:** tidak ada uang berpindah, tidak ada panggilan Midtrans. Webhook
  `/api/payments/notify` tetap menjawab 503 tanpa server key, jadi tidak ada jalur verifikasi
  palsu. Jalur Midtrans asli (D9) tidak berubah saat kredensial diisi.
- **Status:** hanya untuk demo/pengembangan - bukan alur pembayaran produksi. Data tetap
  hilang saat server dimulai ulang.

## D13 - Pembayaran dinonaktifkan (menggantikan D9 dan D9b) - **DIGANTI oleh D15**

- **Konteks:** pemilik produk meminta pembayaran dan halaman Premium menjadi
  **tampilan saja** - fungsi internalnya dihapus dan tidak ada tombol yang bisa
  diklik untuk membeli.
- **Keputusan:** seluruh handler Midtrans (charge QRIS, proxy gambar QR,
  pemeriksaan status, webhook, penyusunan signature) dihapus. Semua endpoint
  `/api/payments*` kini dijaga `routes/payments.js` yang hanya menjawab **501
  `PAYMENTS_DISABLED`**. Repository `payments`, konfigurasi `MIDTRANS_*`,
  `MIDTRANS_SIMULATE`, dan tarif simulasi ikut dihapus.
- **Harga:** ditetapkan `PREMIUM_PRICE_IDR=49000` (30 hari) dan ditampilkan
  seragam di halaman Premium serta footer website. Karena tidak ada transaksi,
  nilai ini murni tampilan; `GET /api/health` melaporkan
  `premium.available = false`.
- **Batas jujur:** tidak ada jalur HTTP apa pun yang bisa mengaktifkan Premium.
  `users.extendPremium()` hanya bisa dipanggil langsung dari kode (operator atau
  pengujian), bukan dari permintaan klien.

## D14 - Akun & sesi bisa disimpan di PostgreSQL

- **Konteks:** permintaan agar daftar dan masuk memakai PostgreSQL lokal.
- **Keputusan:** `repositories/postgres.js` menyediakan adapter `users` dan
  `refresh_tokens` di atas `pg` (pool kecil, skema dibuat otomatis dengan
  `create table if not exists` saat startup). `repositories/index.js` mengekspor
  `initStorage()`: bila `DATABASE_URL` diisi dan database terjangkau, adapter
  PostgreSQL dipakai; bila tidak, server tetap jalan dengan adapter memori dan
  alasannya dilaporkan lewat log serta `health.storage` - bukan gagal senyap.
- **Yang belum dipindah:** dokumen, hasil analisis, dan saran masih di memori.
  Batas ini disebutkan pada `health.storage` dan README.
- **Catatan keamanan:** nilai kolom yang boleh diubah lewat `users.update()`
  dibatasi daftar putih (`USER_COLUMNS`) supaya nama kolom dari luar tidak pernah
  masuk ke SQL; seluruh nilai dikirim sebagai parameter, bukan disisipkan ke string.
## D15 - Payment gateway Midtrans penuh, satu jalur, tanpa AI (menggantikan D13)

- **Konteks:** pemilik produk meminta payment gateway "selengkap Shopee", logis, tidak
  memakai AI, dan tidak menyulitkan pengguna.
- **Keputusan:** satu jalur deterministik di `services/payments.js`. Katalog 10 metode
  (QRIS, VA BCA/BNI/BRI/Permata, GoPay, ShopeePay, kartu, Alfamart, Indomaret) dikirim
  server beserta harga. Klien hanya mengirim `method`; nomor pesanan dan nominal dibuat
  server. Metode non-kartu memakai Core API `/v2/charge`, kartu memakai Snap. Tidak ada
  model AI yang menyentuh nominal, status, atau keputusan pembayaran.
- **Tiga mode yang dilaporkan apa adanya** (`paymentMode()`): `midtrans` (kunci terisi),
  `simulator` (kunci kosong, bukan produksi - ada tombol uji "Simulasikan lunas"),
  `unavailable` (kunci kosong, produksi - `503 PAYMENTS_UNAVAILABLE`). Tidak ada kode QR
  palsu yang diklaim QRIS asli: `GET /:orderId/qr` menjawab `404 QR_UNAVAILABLE` bila
  transaksi bukan milik gateway asli.
- **Idempotensi:** `payments.markPaidIfPending()` hanya mengizinkan satu transisi ke
  `paid`; `users.extendPremium()` dipanggil setelah transisi itu berhasil. Webhook ganda
  atau tombol "periksa status" yang ditekan berkali-kali tidak menambah masa aktif dua kali.
- **Keamanan webhook:** tanda tangan `SHA512(order_id + status_code + gross_amount +
  serverKey)` wajib cocok; nominal notifikasi harus sama dengan tagihan; kepemilikan
  transaksi diperiksa pada setiap endpoint pengguna (403 untuk akun lain).
- **Batas jujur:** tanpa kredensial Midtrans, alur nyata tidak bisa diuji ke gateway.
  Pengujian menutup jalur simulasi, verifikasi tanda tangan, nominal, dan idempotensi.

## D16 - Premium tanpa batas kata (menggantikan D4)

- **Keputusan:** `PREMIUM_WORD_LIMIT = null` di server dan frontend; `null` berarti tanpa
  batas dan dilaporkan sebagai `limits.premium_words: null` pada `/api/health`. Batas yang
  tersisa hanya batas praktis satu dokumen: 200.000 karakter (`413 TEXT_TOO_LARGE`) dan
  unggahan 5 MB, keduanya divalidasi di server.
- **Alasan:** permintaan pemilik produk ("premium sepuasnya, jangan 10k aja") sekaligus
  menjaga biaya dan waktu tunggu tetap masuk akal.

## D17 - Analisis teks panjang dipecah per bagian

- **Keputusan:** `services/chunk.js` memotong teks pada batas paragraf/kalimat (maks 6.000
  karakter per bagian) dan mengembalikan offset. Bagian dijalankan maksimal 3 paralel
  (`mapLimit`), maksimal 12 saran per bagian dan 120 per dokumen. Posisi saran digeser
  dengan offset lalu **diperiksa ulang** terhadap teks asli; saran yang tidak cocok dibuang.
- **Kegagalan sebagian:** bagian yang gagal tidak menggagalkan semuanya - hasil bagian lain
  disimpan dan `ai_status` menjadi `partial` beserta peringatan. Bila semua bagian gagal,
  error asli provider diteruskan (tidak pernah diganti hasil buatan).
- **Bukti dari server:** prompt menerima ringkasan yang dihitung program (frasa, pembuka,
  dan kata yang benar-benar berulang) sehingga temuan berdasar pola nyata.

## D18 - Perbaikan otomatis sekali klik + unduhan PDF

- **Keputusan:** perbaikan otomatis memakai `PATCH /api/documents/:id/issues` dengan
  `{ accept_all: true }` yang sudah ada - tidak ada endpoint baru. Saran bertanda
  `needs_manual_review` tetap dilewati agar makna tulisan tidak berubah. Halaman hasil
  menjalankannya sekali secara otomatis untuk akun Premium setelah analisis.
- **Ekspor PDF:** `services/pdf.js` memakai `pdf-lib` (font Helvetica bawaan, banyak
  halaman, tanpa tabel/gambar). Percobaan menulis PDF sendiri gagal diverifikasi pembaca
  PDF, jadi pustaka nyata dipakai. Verifikasi pengujian: berkas dibuka ulang dengan
  `PDFDocument.load()` dan jumlah halaman diperiksa.
- **Batas jujur:** PDF hanya teks polos; tata letak kaya (tabel, gambar) belum ada.

## D19 - Job analisis di store global + penanda header

- **Konteks:** analisis berhenti dan formulir kembali kosong saat pengguna berpindah
  halaman karena seluruh state berada di `AnalyzeView.vue` yang di-unmount.
- **Keputusan:** `src/store/analysis.js` memegang status job (idle/running/done/error),
  penghitung detik, hasil terakhir, dan draf teks. `AppHeader` menampilkan penanda
  berjalan/selesai dengan tautan ke hasil. Navigasi ke halaman hasil hanya dilakukan bila
  komponen masih terpasang; bila tidak, pengguna membuka hasil dari penanda header.
- **Batas jujur:** job hidup di memori tab. Memuat ulang browser (F5) menghentikan job;
  melanjutkan setelah reload butuh penyimpanan job di server dan belum dibuat.