<script setup>
import BaseButton from '../components/BaseButton.vue'
import SectionLabel from '../components/SectionLabel.vue'
import FeatureCard from '../components/FeatureCard.vue'
import { CATEGORIES } from '../utils/categories'
import { auth } from '../store/auth'
const desc = {
  repetition: 'Kata yang sama muncul berkali-kali? Ditandai beserta alternatifnya.',
  sentence_pattern: 'Kalimat yang terlalu panjang atau berpola sama dipecah agar enak dibaca.',
  uniform_structure: 'Rangkaian kalimat berstruktur seragam ditandai agar ritmenya bervariasi.',
  transition: 'Kata transisi yang hilang atau dipakai berulang ditinjau ulang.',
  formality: 'Kata tidak baku seperti "gak" atau "banget" disarankan bentuk bakunya.',
  style_consistency: 'Campuran kata ganti atau gaya (mis. "saya" vs "aku") diingatkan.',
}
const steps = [
  { n: '01', t: 'Tempel tulisan', d: 'Tempel teks atau unggah TXT/DOCX/PDF (maks 5 MB). Gratis sampai 500 kata, Premium sampai 10.000 kata.' },
  { n: '02', t: 'Lihat yang ditandai', d: 'Bagian bermasalah digarisbawahi sesuai kategorinya. Klik untuk melihat penjelasan dan saran.' },
  { n: '03', t: 'Selesaikan satu per satu', d: 'Terima, tolak, terima semua yang aman, atau pulihkan teks asli. Premium membuka semua saran.' },
]
const keys = Object.keys(CATEGORIES)
</script>

<template>
  <div>
    <section class="border-b-4 border-black">
      <div class="mx-auto grid max-w-6xl md:grid-cols-[8fr_4fr]">
        <div class="px-4 py-14 sm:px-6 md:py-24">
          <SectionLabel>01 / Sistem - Analisis pola tulisan</SectionLabel>
          <h1 class="mt-6 text-6xl font-black uppercase leading-[0.9] tracking-tighter sm:text-7xl md:text-8xl">
            Tulisanmu,<br />lebih <span class="bg-[#FF3000] px-2 text-white">runut</span>.
          </h1>
          <p class="mt-6 max-w-xl text-base leading-relaxed text-black/70">
            Untuk tugas, esai, atau laporan berbahasa Indonesia yang terasa monoton.
            Tempel ke sini, nanti kelihatan bagian mana yang perlu dibenahi - dengan penjelasan spesifik, bukan skor rekaan.
          </p>
          <div class="mt-8 flex flex-col gap-3 sm:flex-row">
            <BaseButton :to="auth.user ? '/analisis' : '/daftar'" size="lg">Coba sekarang <i class="fa-solid fa-arrow-right text-xs"></i></BaseButton>
            <BaseButton to="/tentang" variant="secondary" size="lg">Tentang website</BaseButton>
          </div>
          <div class="mt-10 flex flex-wrap gap-6 border-t-2 border-black pt-6">
            <p class="font-mono text-xs uppercase tracking-widest"><span class="text-2xl font-black">6</span><br />Kategori diperiksa</p>
            <p class="font-mono text-xs uppercase tracking-widest"><span class="text-2xl font-black">500</span><br />Kata gratis</p>
            <p class="font-mono text-xs uppercase tracking-widest"><span class="text-2xl font-black">ID</span><br />Bhs. Indonesia</p>
          </div>
        </div>
        <div class="relative hidden min-h-[480px] overflow-hidden border-l-4 border-black bg-[#F2F2F2] md:flex" aria-hidden="true">
          <div class="swiss-diagonal absolute inset-0"></div>
          <p class="absolute bottom-8 left-8 right-8 border-2 border-black bg-white p-4 font-mono text-xs uppercase tracking-widest">Tempel -> tandai -> perbaiki -> unduh</p>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <SectionLabel>02 / Yang diperiksa - Enam hal</SectionLabel>
      <div class="mt-6 grid gap-8 md:grid-cols-[5fr_7fr] md:items-end">
        <h2 class="text-4xl font-black uppercase leading-[0.95] tracking-tighter md:text-6xl">Bukan cek typo. Cek kebiasaan.</h2>
        <p class="text-black/70 md:pb-1">Enam kategori analisis sesuai rancangan: pengulangan kata, pola kalimat, struktur seragam, transisi, formalitas, dan konsistensi gaya.</p>
      </div>
      <div class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard v-for="(k, i) in keys" :key="k" :icon="CATEGORIES[k].icon" :title="CATEGORIES[k].label" :desc="desc[k]" :num="CATEGORIES[k].num || `0${i + 1}`" />
      </div>
    </section>

    <section class="border-y-4 border-black bg-[#F2F2F2]">
      <div class="swiss-diagonal mx-auto grid max-w-6xl md:grid-cols-[5fr_7fr]">
        <div class="border-b-4 border-black p-8 md:border-b-0 md:border-r-4 md:p-12">
          <SectionLabel>03 / Caranya</SectionLabel>
          <h2 class="mt-6 text-4xl font-black uppercase leading-[0.95] tracking-tighter md:text-5xl">Gampang, tiga langkah doang.</h2>
        </div>
        <div>
          <div v-for="s in steps" :key="s.n" class="swiss-snap group flex gap-6 border-b-4 border-black bg-white p-8 last:border-b-0 hover:bg-black hover:text-white md:p-10">
            <p class="font-mono text-4xl font-black text-[#FF3000]">{{ s.n }}</p>
            <div>
              <h3 class="text-xl font-black uppercase tracking-tight">{{ s.t }}</h3>
              <p class="mt-2 text-sm opacity-70">{{ s.d }}</p>
            </div>
            <i class="fa-solid fa-plus ml-auto self-start text-xl transition-transform duration-200 group-hover:rotate-90 group-hover:text-[#FF3000]"></i>
          </div>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <div class="border-4 border-black bg-black p-8 text-white md:p-16">
        <SectionLabel>04 / Mulai</SectionLabel>
        <h2 class="mt-6 max-w-3xl text-4xl font-black uppercase leading-[0.95] tracking-tighter md:text-7xl">Sudah siap? Langsung mulai.</h2>
        <p class="mt-4 max-w-xl text-white/60">Daftar dulu, gratis. Akun gratis bisa menganalisis sampai 500 kata; butuh lebih? Lihat paket Premium.</p>
        <div class="mt-8 flex flex-col gap-3 sm:flex-row">
          <BaseButton :to="auth.user ? '/analisis' : '/daftar'" variant="accent" size="lg">Mulai nulis</BaseButton>
          <BaseButton to="/premium" variant="ghost" size="lg" class="!border-white !text-white hover:!bg-white hover:!text-black">Lihat Premium</BaseButton>
        </div>
      </div>
    </section>
  </div>
</template>