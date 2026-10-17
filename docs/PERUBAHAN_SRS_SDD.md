# Perubahan SRS & SDD untuk fitur skor (Similarity + Penggunaan AI)

Nomor baris mengacu ke `.tmp/SRS.txt` dan `.tmp/SDD.txt` (hasil ekstraksi PDF).
Cara pakai: Ctrl+F kalimat **SEBELUM**, ganti dengan **SESUDAH**. Jangan ubah nomor bab.

Label yang tampil di aplikasi: **Similarity %** dan **Penggunaan AI %**.
Tidak ada kata "perkiraan" di antarmuka.

Catatan istilah: teks penjelas di UI memakai definisi umum similarity (tingkat
kesamaan teks dengan teks/data lain di basis data, seperti Turnitin Similarity).
Yang benar-benar dihitung aplikasi saat ini adalah pengulangan **di dalam teks
pengguna itu sendiri** - belum ada basis data pembanding. Tulis apa adanya di
SRS/SDD supaya dokumen tidak mengklaim pemeriksaan basis data luar.

---

## A. SRS.txt

### A1. Bagian 1.3 Batasan Produk, poin 1 (baris 70-71)

**SEBELUM**
> 1. Tidak mendeteksi AI atau plagiarisme. Sistem tidak mengklaim dapat menentukan apakah tulisan
> dibuat oleh AI atau menilai orisinalitas teks.

**SESUDAH**
> 1. Sistem menampilkan indikator Similarity dan Penggunaan AI yang dihitung dari pola teks
> pengguna. Sistem tidak melakukan pemeriksaan plagiarisme dan tidak membandingkan teks pengguna
> dengan sumber atau korpus luar.

### A2. Bagian 2.1 Deskripsi Produk (baris 135-136)

**SEBELUM**
> Sistem ini tidak menilai benar-salah tata bahasa secara menyeluruh, tidak mendeteksi
> AI, dan tidak mengubah makna.

**SESUDAH**
> Sistem ini tidak menilai benar-salah tata bahasa secara menyeluruh dan tidak mengubah makna.
> Sistem juga tidak melakukan pemeriksaan plagiarisme; indikator Similarity dan Penggunaan AI
> dihitung dari pola teks yang tersedia di aplikasi.

### A3. Bagian 2.2 Fungsi Produk - tambah satu butir setelah butir 11 (baris 152)

**SISIPKAN (jadi butir 12)**
> 12. Menampilkan indikator Similarity dan Penggunaan AI dalam bentuk persentase.

### A4. Bagian 3.1 User Interfaces - tambah satu butir setelah poin 6 (baris 227 dst)

**SISIPKAN (jadi poin 7)**
> 7. Panel Similarity & Penggunaan AI - Pada halaman hasil, sistem menampilkan dua angka persentase:
> Similarity (dihitung dari pengulangan kata isi, frasa, dan pembuka kalimat di dalam teks) dan
> Penggunaan AI (dihitung dari keseragaman panjang kalimat, pengulangan frasa, dan jumlah kalimat
> pendek). Keduanya dihitung server dari teks, bukan keluaran model AI, dan ditampilkan beserta
> perincian sinyalnya.

### A5. Tabel Functional Requirement - FR-08 dan FR-09 (baris 341-348)

**SEBELUM (FR-08)**
> Sistem memproses teks dan menghasilkan ringkasan terbatas berupa
> statistik dasar dan beberapa masalah paling mencolok.

**SESUDAH (FR-08)**
> Sistem memproses teks dan menghasilkan ringkasan terbatas berupa
> statistik dasar, skor Similarity dan Penggunaan AI, serta beberapa masalah
> paling mencolok.

**SEBELUM (FR-09)**
> Sistem menampilkan hasil analisis awal secara gratis, dengan saran
> perbaikan dikunci.

**SESUDAH (FR-09)**
> Sistem menampilkan hasil analisis awal secara gratis beserta panel skor
> Similarity dan Penggunaan AI, dengan saran perbaikan dikunci.

### A6. UC-08 Analisis Awal - Flow of Activities (baris 769-770)

**SEBELUM**
> 2.2 Menghitung statistik dasar: jumlah kata, rata-rata panjang kalimat, kata
> yang sering muncul.

**SESUDAH**
> 2.2 Menghitung statistik dasar: jumlah kata, rata-rata panjang kalimat, kata
> yang sering muncul.
> 2.2a Menghitung skor Similarity dari pengulangan kata isi, frasa, dan pembuka
> kalimat di dalam teks beserta perinciannya.
> 2.2b Menghitung skor Penggunaan AI dari keseragaman panjang kalimat, pengulangan
> frasa, dan jumlah kalimat pendek.

### A7. UC-09 Menampilkan Hasil Awal - Flow of Activities (baris 823-827)

**SEBELUM**
> 2.2 Menampilkan ringkasan: jumlah kata, kata yang sering diulang, variasi
> panjang kalimat.
> 2.3 Menyorot maksimal tiga masalah paling signifikan pada teks.

**SESUDAH**
> 2.2 Menampilkan ringkasan: jumlah kata, kata yang sering diulang, variasi
> panjang kalimat.
> 2.2a Menampilkan panel Skor Kemiripan & AI berisi persentase Similarity dan
> Penggunaan AI beserta perincian sinyalnya.
> 2.3 Menyorot maksimal tiga masalah paling signifikan pada teks.

---

## B. SDD.txt

### B1. Bagian 2.1 Deskripsi Umum (baris 84)

**SEBELUM**
> Sistem tidak mendeteksi AI maupun plagiarisme; ia hanya membantu penulis
> menemukan bagian yang terasa generik, kaku, atau berulang sehingga tulisan menjadi lebih alami dan enak
> dibaca.

**SESUDAH**
> Sistem tidak melakukan pemeriksaan plagiarisme; ia membantu penulis menemukan bagian yang terasa
> generik, kaku, atau berulang sehingga tulisan menjadi lebih alami dan enak dibaca. Sistem juga
> menampilkan indikator Similarity dan Penggunaan AI dari pola teks pengguna.

### B2. Bagian 2.1 paragraf keterbatasan (baris 135)

**SEBELUM**
> Sistem tidak menilai benar-salah tata bahasa secara menyeluruh, tidak mendeteksi AI,
> dan tidak mengubah makna.

**SESUDAH**
> Sistem tidak menilai benar-salah tata bahasa secara menyeluruh dan tidak mengubah makna.
> Sistem tidak memeriksa plagiarisme dan tidak membandingkan teks dengan sumber luar.

### B3. Daftar fungsi - sisipkan setelah "Menampilkan Hasil Awal" (baris 173)

**SISIPKAN**
> ● Menampilkan Similarity & Penggunaan AI: Sistem menampilkan dua angka persentase pada halaman hasil,
> yaitu Similarity dan Penggunaan AI. Keduanya dihitung secara deterministik oleh backend dari
> teks pengguna (bukan keluaran model AI), memakai sinyal pengulangan kata isi, frasa, pembuka
> kalimat, keseragaman panjang kalimat, dan jumlah kalimat pendek.

### B4. Struktur Basis Data - tabel analysis_results (baris 303-304)

**SEBELUM**
> ● Tabel analysis_results: Menyimpan hasil analisis per dokumen: id, document_id (FK),
> stats_json, issues_json, created_at.

**SESUDAH**
> ● Tabel analysis_results: Menyimpan hasil analisis per dokumen: id, document_id (FK),
> stats_json, issues_json, created_at. Kolom stats_json memuat statistik dasar dan objek `scores`
> berisi `similarity` (persen Similarity + perincian sinyal) dan `ai_usage` (persen Penggunaan AI +
> perincian sinyal).

### B5. Bagian 3.4 User Interface - sisipkan bullet baru (setelah baris 341)

**SISIPKAN**
> ● Panel Similarity & Penggunaan AI: Pada halaman hasil tampil dua kartu persentase, yaitu Similarity
> dan Penggunaan AI. Setiap kartu memuat meter pengukur berskala 0-100%, perincian sinyal (kata isi
> yang berulang, frasa berulang, pembuka kalimat berulang, panjang kalimat seragam, tanpa kalimat
> pendek) dengan bar indikator, dan penjelasan singkat cara angkanya dihitung.

---

## C. Perubahan lain yang perlu kamu samakan (di luar skor)

Implementasi sekarang berbeda dari teks SRS/SDD. Samakan supaya dokumen tidak salah isi:

1. **Basis data.** SRS/SDD menyebut PostgreSQL, tabel, JSONB, ERD. Implementasi: **akun dan sesi
   (daftar/masuk) disimpan di PostgreSQL lokal** lewat adapter `server/src/repositories/postgres.js`
   (aktif bila `DATABASE_URL` diisi; skema dibuat otomatis saat server pertama terhubung). Dokumen,
   hasil analisis, dan saran masih memakai adapter memori lewat kontrak repository yang sama. Tulis
   "penyimpanan akun/sesi di PostgreSQL; dokumen dan hasil analisis memakai adapter repository
   (memori pada tahap pengembangan); skema tabel di dokumen tetap dipakai sebagai rancangan".
2. **Layanan AI.** SRS §2.3 (baris 263-267) dan SDD baris 141 menyebut Qwen3.5 via Ollama.
   Implementasi memakai satu provider 9Router (OpenAI-compatible) dengan `AI_BASE_URL`,
   `AI_API_KEY`, `AI_MODEL`, `AI_TIMEOUT_MS`. Sebutkan bahwa ID model berasal dari akun pengguna
   (tidak dihardcode).
3. **Timeout.** SRS UC-08 exception menulis "AI Service timeout (>10 detik)". Kode memakai
   `AI_TIMEOUT_MS` (bawaan 10.000 ms; `.env` lokal diisi 90.000 ms karena model lambat).
   Tulis "timeout dikonfigurasi lewat AI_TIMEOUT_MS (bawaan 10 detik)".
4. **Pembayaran.** SRS/SDD hanya menyebut "payment gateway". Implementasi saat ini **belum membuka
   pembayaran**: halaman Premium menampilkan paket (Rp49.000 / 30 hari) dan daftar metode
   (QRIS, BCA Virtual Account, GoPay, OVO, DANA, ShopeePay, kartu kredit/debit, Alfamart/Indomaret)
   sebagai gambaran saja, dan semua endpoint `/api/payments*` menjawab 501 `PAYMENTS_DISABLED`.
   Tulis "integrasi payment gateway belum diimplementasikan pada versi ini" (menggantikan padanan
   Midtrans QRIS pada versi sebelumnya).
5. **Persetujuan AI.** Permintaan analisis mengirim `ai_consent: true` saat tombol Periksa ditekan;
   tanpa itu server menolak 400 `AI_CONSENT_REQUIRED`. Tambahkan langkah itu di UC-08.
6. **Unduh & status saran.** Status saran: `active`, `applied`, `rejected` (SDD baris 306 menulis
   "active, rejected, applied" - samakan). Unduh tersedia `.txt` dan `.docx`.

4b. **(Dihapus) Mode simulasi pembayaran.** Alur simulasi QRIS sudah tidak ada. Pembayaran
   dinonaktifkan seluruhnya: tidak ada kode QR, transaksi, maupun webhook yang diproses.