<script setup>
defineProps({ title: String, subtitle: String })
</script>
<template>
  <!-- Dokumentasi: kartu auth Swiss - grid 7:5, kiri panel hitam manifesto,
       kanan formulir. Bingkai border-4 hitam. -->
  <section class="mx-auto max-w-5xl px-4 py-12 sm:px-6 md:py-16">
    <div class="grid border-4 border-black md:grid-cols-[7fr_5fr]">
      <div class="swiss-dots relative hidden flex-col justify-between bg-black p-8 text-white md:flex md:p-12">
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center border-2 border-white font-mono text-base font-black">R</span>
          <span class="text-xl font-black uppercase tracking-tighter">Runut</span>
        </div>
        <div>
          <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]">Kenapa daftar?</p>
          <p class="mt-4 text-4xl font-black uppercase leading-[0.95] tracking-tighter">Cek tulisan<br />sebelum<br />dikumpulin.</p>
          <p class="mt-6 max-w-xs text-sm leading-relaxed text-white/70">Buat yang capek baca ulang tulisannya sendiri berkali-kali.</p>
        </div>
        <p class="font-mono text-[11px] uppercase tracking-widest text-white/50">RUNUT - 2026</p>
      </div>
      <div class="bg-white p-6 sm:p-8 md:p-12">
        <h1 class="text-3xl font-black uppercase tracking-tighter">{{ title }}</h1>
        <p class="mb-8 mt-2 text-sm text-black/60">{{ subtitle }}</p>
        <slot />
      </div>
    </div>
  </section>
</template>
