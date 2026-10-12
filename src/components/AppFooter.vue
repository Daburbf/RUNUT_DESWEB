<script setup>
import logoUrl from '/images/logo.svg'
</script>

<template>
  <!-- Dokumentasi: footer Swiss — blok hitam penuh, grid 3 kolom,
       tipografi kapital, aksen merah fungsional. -->
  <footer class="relative z-10 mt-24 bg-black text-white">
    <div class="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3 md:py-16">
      <div>
        <div class="flex items-center gap-2.5">
          <img :src="logoUrl" alt="" class="h-8 w-8 border-2 border-white" />
          <span class="text-xl font-black uppercase tracking-tighter">Runut</span>
        </div>
        <p class="mt-4 max-w-xs text-sm leading-relaxed text-white/60">Buat ngecek tulisan sebelum dikumpulin. Tempel teks, lihat yang janggal, beresin satu-satu.</p>
        <p class="mt-6 font-mono text-[11px] uppercase tracking-widest text-white/40">© 2026 Runut · Balikpapan</p>
      </div>
      <nav aria-label="Tautan footer">
        <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]">Indeks</p>
        <ul class="mt-4 space-y-3 text-sm font-bold uppercase tracking-wide">
          <li><router-link to="/tentang" class="hover:text-[#FF3000]">Tentang</router-link></li>
          <li><router-link to="/analisis" class="hover:text-[#FF3000]">Analisis</router-link></li>
          <li><router-link to="/riwayat" class="hover:text-[#FF3000]">Riwayat</router-link></li>
        </ul>
      </nav>
      <div>
        <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]">Kontak</p>
        <div class="mt-4 flex gap-2">
          <a href="#/" aria-label="GitHub" class="flex h-11 w-11 items-center justify-center border-2 border-white/30 transition-colors duration-150 hover:border-[#FF3000] hover:bg-[#FF3000]"><i class="fa-brands fa-github"></i></a>
          <a href="#/" aria-label="Instagram" class="flex h-11 w-11 items-center justify-center border-2 border-white/30 transition-colors duration-150 hover:border-[#FF3000] hover:bg-[#FF3000]"><i class="fa-brands fa-instagram"></i></a>
          <a href="mailto:halo@runut.id" aria-label="Email" class="flex h-11 w-11 items-center justify-center border-2 border-white/30 transition-colors duration-150 hover:border-[#FF3000] hover:bg-[#FF3000]"><i class="fa-regular fa-envelope"></i></a>
        </div>
        <p class="mt-4 font-mono text-[11px] uppercase tracking-widest text-white/40">halo@runut.id</p>
      </div>
    </div>
    <div class="h-2 bg-[#FF3000]" aria-hidden="true"></div>
  </footer>
</template>
