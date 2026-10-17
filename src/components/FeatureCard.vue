<script setup>
import BaseCard from './BaseCard.vue'
defineProps({ icon: String, title: String, desc: String, num: String })
</script>
<template>
  <!-- Dokumentasi: kartu fitur Swiss - hover inversi penuh putih->merah,
       ikon panah berotasi -45°->0°. Nomor seksi merah. -->
  <BaseCard class="swiss-snap group flex min-h-[280px] cursor-default flex-col justify-between p-8 hover:bg-[#FF3000] hover:text-white">
    <div class="flex items-start justify-between">
      <span class="font-mono text-sm font-medium text-[#FF3000] group-hover:text-white">{{ num }}</span>
      <i class="fa-solid fa-arrow-right -rotate-45 text-xl transition-transform duration-200 group-hover:rotate-0"></i>
    </div>
    <div>
      <div class="mb-4 flex h-12 w-12 items-center justify-center border-2 border-black group-hover:border-white">
        <i :class="['fa-solid text-lg', icon]"></i>
      </div>
      <h3 class="text-lg font-black uppercase tracking-tight">{{ title }}</h3>
      <p class="mt-2 text-sm leading-relaxed opacity-70">{{ desc }}</p>
    </div>
  </BaseCard>
</template>