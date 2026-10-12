<script setup>
import BaseButton from '../components/BaseButton.vue'
import SectionLabel from '../components/SectionLabel.vue'
import FeatureCard from '../components/FeatureCard.vue'
import { CATEGORIES } from '../utils/analyzer'
import { auth } from '../store/auth'
const desc = {
  repetition: 'Kata yang sama nongol berkali-kali? Nanti ditandain, sekalian dikasih alternatifnya.',
  sentence: 'Kalimat yang kepanjangan dipecah biar enak dibaca, nggak ngos-ngosan.',
  similarity: 'Dua kalimat yang isinya mirip bakal ketahuan, lengkap sama persennya.',
  ai: 'Ngecek tulisanmu berasa kayak tulisan AI atau tulisan orang beneran.',
  formality: 'Kata kayak "gak" atau "banget" dibenerin jadi bentuk yang lebih pas.',
  consistency: 'Misal awalnya pakai "saya" terus tiba-tiba "aku", itu diingetin.',
}
const steps = [
  { n: '01', t: 'Tempel tulisan', d: 'Copy-paste teks kamu, atau upload file .txt. Bisa juga pencet "pakai contoh" kalau cuma mau nyoba-nyoba dulu.' },
  { n: '02', t: 'Lihat yang ditandain', d: 'Bagian yang pengulangan, kaku, atau generik bakal dikasih garis bawah. Klik aja tandanya buat lihat sarannya.' },
  { n: '03', t: 'Beresiin satu-satu', d: 'Setiap saran bisa diterima, ditolak, atau diubah manual. Bebas, nggak ada paksaan.' },
]
const keys = Object.keys(CATEGORIES)
</script>

<template>
  <div>
    <!-- 01 / HERO — tipografi raksasa + komposisi geometri Bauhaus -->
    <section class="border-b-4 border-black">
      <div class="mx-auto grid max-w-6xl md:grid-cols-[8fr_4fr]">
        <div class="px-4 py-14 sm:px-6 md:py-24">
          <SectionLabel>01 / Sistem — Analisis pola tulisan</SectionLabel>
          <h1 class="mt-6 text-6xl font-black uppercase leading-[0.9] tracking-tighter sm:text-7xl md:text-8xl">
            Tulisanmu,<br />lebih <span class="bg-[#FF3000] px-2 text-white">runut</span>.
          </h1>
          <p class="mt-6 max-w-xl text-base leading-relaxed text-black/70">
            Buat kamu yang sering nulis tugas, esai, atau laporan terus ngerasa tulisannya
            gitu-gitu aja. Tempel ke sini, nanti kelihatan bagian mana yang perlu dibenerin.
          </p>
          <div class="mt-8 flex flex-col gap-3 sm:flex-row">
            <BaseButton :to="auth.user ? '/analisis' : '/daftar'" size="lg">Coba sekarang <i class="fa-solid fa-arrow-right text-xs"></i></BaseButton>
            <BaseButton to="/tentang" variant="secondary" size="lg">Kenapa bikin ini?</BaseButton>
          </div>
          <div class="mt-10 flex flex-wrap gap-6 border-t-2 border-black pt-6">
            <p class="font-mono text-xs uppercase tracking-widest"><span class="text-2xl font-black">6</span><br />Yang dicek</p>
            <p class="font-mono text-xs uppercase tracking-widest"><span class="text-2xl font-black">5K</span><br />Kata maks.</p>
            <p class="font-mono text-xs uppercase tracking-widest"><span class="text-2xl font-black">ID</span><br />Bhs. Indonesia</p>
          </div>
        </div>
        <!-- Panel visual: patung Yunani full -->
        <div class="relative min-h-[480px] overflow-hidden border-l-4 border-black bg-[#F2F2F2] md:flex" aria-hidden="true">
          <img src="/images/yunani.png" alt="" class="absolute inset-0 h-full w-full object-cover" />
        </div>
      </div>
    </section>

    <!-- 02 / KATEGORI -->
    <section class="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <SectionLabel>02 / Yang dicek — Enam hal</SectionLabel>
      <div class="mt-6 grid gap-8 md:grid-cols-[5fr_7fr] md:items-end">
        <h2 class="text-4xl font-black uppercase leading-[0.95] tracking-tighter md:text-6xl">Bukan cek typo. Cek kebiasaan.</h2>
        <p class="text-black/70 md:pb-1">Fokusnya ke hal-hal kecil yang bikin tulisan berasa monoton, tapi sering nggak sadar pas nulis.</p>
      </div>
      <div class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard v-for="(k, i) in keys" :key="k" :icon="CATEGORIES[k].icon" :title="CATEGORIES[k].label" :desc="desc[k]" :num="CATEGORIES[k].num || `0${i + 1}`" />
      </div>
    </section>

    <!-- 03 / CARA KERJA — baris bernomor, pola diagonal -->
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

    <!-- 04 / CTA -->
    <section class="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <div class="border-4 border-black bg-black p-8 text-white md:p-16">
        <SectionLabel>04 / Mulai</SectionLabel>
        <h2 class="mt-6 max-w-3xl text-4xl font-black uppercase leading-[0.95] tracking-tighter md:text-7xl">Udah, langsung coba aja.</h2>
        <p class="mt-4 max-w-xl text-white/60">Daftar dulu, gratis. Nggak diminta kartu kredit atau apa-apa.</p>
        <div class="mt-8 flex flex-col gap-3 sm:flex-row">
          <BaseButton :to="auth.user ? '/analisis' : '/daftar'" variant="accent" size="lg">Mulai nulis</BaseButton>
          <BaseButton to="/riwayat" variant="ghost" size="lg" class="!border-white !text-white hover:!bg-white hover:!text-black">Lihat riwayat</BaseButton>
        </div>
      </div>
    </section>
  </div>
</template>
