<template>
  <!-- Dokumentasi: label seksi Swiss = nomor merah + garis + teks kapital. -->
  <p class="flex items-center gap-3 font-mono text-xs font-medium uppercase tracking-widest">
    <span class="inline-block h-3 w-3 bg-[#FF3000]" aria-hidden="true"></span>
    <span class="text-[#FF3000]"><slot /></span>
    <span class="h-[2px] flex-1 bg-black" aria-hidden="true"></span>
  </p>
</template>
