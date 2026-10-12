# Runut — Buat ngecek pola tulisan berbahasa Indonesia

Vue 3 (Composition API) · Vue Router · Tailwind CSS (npm) · Font Awesome

Web ini buat ngecek tulisan: pengulangan kata, kalimat kepanjangan,
kalimat yang mirip-mirip, bau-bau AI, kata nggak baku, sama gaya yang nggak konsisten.
Tempel teks, lihat yang ditandain, beresin satu-satu.

## Cara jalanin

```bash
npm install
npm run dev
```

Buka http://localhost:5173

## Halaman (routes)

| Path | Halaman | Keterangan |
|---|---|---|
| `/` | Beranda | Hero, 6 hal yang dicek, langkah-langkah, tombol mulai |
| `/tentang` | Tentang | Cerita kenapa dibikin + prinsipnya |
| `/daftar` | Daftar | Bikin akun baru |
| `/masuk` | Masuk | Masuk ke akun (keluarnya dari navbar) |
| `/analisis` | Analisis | Tempel teks / upload .txt / coba contoh, terus dicek |
| `/hasil` | Hasil | Nilai, sorotan yang bisa diklik, terima/tolak/ubah saran, bandingin sebelum-sesudah, unduh, simpen |
| `/dokumen/:id` | Detail dokumen | Lihat satu dokumen lewat alamatnya sendiri |
| `/riwayat` | Riwayat | Cari, buka lagi, sama hapus dokumen yang kesimpen |

## Komponen (src/components)

AppHeader, AppFooter, BaseButton, BaseCard, BaseModal, FormInput, AuthCard,
SectionLabel, FeatureCard, ScoreRing, CategorySummary, HighlightedText, SuggestionCard,
HistoryItem.

Total 14 komponen, udah lewat syarat minimal 8 (termasuk header + footer).

## Fitur interaktif

Form daftar/masuk/analisis pakai validasi, modal konfirmasi simpen sama hapus,
sorotan teks yang bisa diklik, saran bisa diterima/ditolak/diubah sendiri,
terima semua sekaligus, nyaring saran per kategori, pencarian di riwayat,
salin hasil revisi, unduh .txt.

## Catatan

Nggak ada backend beneran. Data akun sama riwayat disimpen di browser
(localStorage), analisisnya jalan di `src/utils/analyzer.js`.
Jadi kalau ganti browser atau hapus data web, ilang semua. Maklum.

File use case ada di `usecase-runut.txt`.
