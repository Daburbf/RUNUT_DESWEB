<script setup>
import BaseButton from '../components/BaseButton.vue'
import SectionLabel from '../components/SectionLabel.vue'
import BaseCard from '../components/BaseCard.vue'
</script>

<template>
  <div>
    <section class="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
      <SectionLabel>Tentang</SectionLabel>
      <h1 class="mt-4 max-w-3xl text-5xl font-black uppercase leading-[0.9] tracking-tighter md:text-7xl">
        Kenapa ada Runut?
      </h1>
      <div class="mt-8 grid gap-8 md:grid-cols-[7fr_5fr]">
        <div class="space-y-5 text-[15px] leading-8 text-black/80">
          <p>
            Jujur aja, Runut ini awalnya tugas kuliah. Disuruh bikin web pakai Vue sama Tailwind,
            ada routing, ada form, harus responsif, ya udah sekalian bikin yang kepake aja.
          </p>
          <p>
            Masalahnya simpel dan sering kejadian: kita nulis, berasa udah bagus, pas dibaca ulang
            ternyata kata yang sama muncul berkali-kali. Atau satu kalimat panjangnya nggak kira-kira.
            Kadang juga bahasanya kaku, kayak hasil tempelan AI. Nah itu yang pengin ditangkep Runut.
          </p>
          <p>
            Jadi cara kerjanya nggak neko-neko. Kamu tempel tulisan, Runut yang bacain polanya,
            bagian yang janggal ditandain. Udah gitu aja. Keputusan tetap di kamu, mau dipakai
            sarannya atau dibiarin. Nggak ada yang otomatis diubah tanpa izin.
          </p>
          <BaseCard class="border-l-4 !border-l-[#FF3000] p-5">
            <p class="text-sm leading-7">
              Catatan: semua data akun sama riwayat disimpen di browser kamu sendiri (localStorage).
              Nggak ada server, nggak dikirim ke mana-mana. Kalau ganti browser atau hapus data,
              ya ilang. Maklum, versi tugas kuliah.
            </p>
          </BaseCard>
        </div>
        <div class="flex flex-col gap-4">
          <div class="border-4 border-black bg-black p-8 text-white">
            <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]">Prinsip</p>
            <ul class="mt-4 space-y-4">
              <li class="flex gap-3">
                <span class="font-mono font-black text-[#FF3000]">01</span>
                <p class="text-sm leading-6"><b class="uppercase">Kamu yang mutusin.</b><br /><span class="text-white/60">Saran cuma saran. Terima, tolak, atau ubah sendiri.</span></p>
              </li>
              <li class="flex gap-3">
                <span class="font-mono font-black text-[#FF3000]">02</span>
                <p class="text-sm leading-6"><b class="uppercase">Nggak sok tahu.</b><br /><span class="text-white/60">Yang ditandain cuma pola yang kelihatan. Bukan nilai tulisanmu.</span></p>
              </li>
              <li class="flex gap-3">
                <span class="font-mono font-black text-[#FF3000]">03</span>
                <p class="text-sm leading-6"><b class="uppercase">Bisa dibuka di HP.</b><br /><span class="text-white/60">Layoutnya ngikutin layar, dari HP sampai laptop.</span></p>
              </li>
            </ul>
          </div>
          <div class="swiss-dots border-2 border-black bg-[#F2F2F2] p-6">
            <p class="font-mono text-xs uppercase tracking-widest">Dibuat oleh</p>
            <p class="mt-2 font-black uppercase tracking-tight">Mahasiswa — Balikpapan, 2026</p>
            <p class="mt-1 text-sm text-black/60">Vue 3 + Tailwind. Kalau ada bug, dimaklumi ya.</p>
            <BaseButton to="/analisis" class="mt-4">Coba analisis</BaseButton>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
