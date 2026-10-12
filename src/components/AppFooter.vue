<script setup>
</script>

<template>
  <footer class="relative z-10 mt-24 bg-black text-white">
    <div class="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3 md:py-16">
      <div>
        <div class="flex items-center gap-2.5">
          <span class="flex h-8 w-8 items-center justify-center border-2 border-white font-mono text-sm font-black">R</span>
          <span class="text-xl font-black uppercase tracking-tighter">Runut</span>
        </div>
        <p class="mt-4 max-w-xs text-sm leading-relaxed text-white/60">Analisis pola tulisan berbahasa Indonesia: tempel teks, lihat yang janggal, bereskan satu per satu.</p>
        <p class="mt-6 font-mono text-[11px] uppercase tracking-widest text-white/40">© 2026 Runut</p>
      </div>
      <nav aria-label="Tautan footer">
        <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]">Indeks</p>
        <ul class="mt-4 space-y-3 text-sm font-bold uppercase tracking-wide">
          <li><router-link to="/tentang" class="hover:text-[#FF3000]">Tentang Aplikasi</router-link></li>
          <li><router-link to="/analisis" class="hover:text-[#FF3000]">Analisis</router-link></li>
          <li><router-link to="/riwayat" class="hover:text-[#FF3000]">Riwayat</router-link></li>
          <li><router-link to="/premium" class="hover:text-[#FF3000]">Premium</router-link></li>
        </ul>
      </nav>
      <div>
        <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]">Batasan</p>
        <p class="mt-4 text-sm leading-relaxed text-white/60">Gratis: 500 kata per analisis. Premium: 10.000 kata. Dokumen tersimpan 30 hari setelah analisis terakhir.</p>
      </div>
    </div>
  </footer>
</template>
