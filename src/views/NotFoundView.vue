<script setup>
import BaseButton from '../components/BaseButton.vue'
</script>
<template>
  <section class="mx-auto max-w-6xl px-4 py-16 sm:px-6">
    <div class="grid border-4 border-black md:grid-cols-[7fr_5fr]">
      <div class="p-8 md:p-16">
        <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]">Nyasar / 404</p>
        <p class="mt-4 text-8xl font-black tracking-tighter md:text-[10rem] md:leading-none">404</p>
        <h1 class="mt-4 text-2xl font-black uppercase tracking-tight">Salah alamat nih.</h1>
        <p class="mt-2 text-black/60">Halamannya nggak ada. Balik aja ke jalan yang bener.</p>
        <BaseButton to="/" class="mt-8">Balik ke beranda</BaseButton>
      </div>
      <div class="swiss-grid-pattern relative flex min-h-[280px] items-center justify-center border-t-4 border-black bg-[#F2F2F2] md:border-l-4 md:border-t-0" aria-hidden="true">
        <div class="h-32 w-32 rounded-full bg-[#FF3000]"></div>
        <div class="absolute bottom-6 left-6 border-2 border-black bg-white px-3 py-2 font-mono text-[11px] uppercase tracking-widest">FIG. 404 — NYASAR</div>
      </div>
    </div>
  </section>
</template>
