<script setup>
import { computed } from 'vue'
const props = defineProps({ score: Number })
// Dokumentasi: skor Swiss = angka raksasa hitam + bilah blok merah.
// Tanpa ring gradien. Merah hanya untuk angka/bilah.
const bar = computed(() => `${props.score}%`)
const grade = computed(() => (props.score >= 80 ? 'AMAN' : props.score >= 55 ? 'LUMAYAN' : 'BANYAK PR'))
</script>
<template>
  <div class="flex items-end gap-6">
    <p class="text-7xl font-black leading-none tracking-tighter sm:text-8xl">{{ score }}</p>
    <div class="flex-1 pb-2">
      <p class="mb-2 inline-block bg-[#FF3000] px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-widest text-white">{{ grade }}</p>
      <div class="h-4 w-full border-2 border-black bg-white" role="img" :aria-label="`Skor ${score} dari 100`">
        <div class="h-full bg-[#FF3000]" :style="{ width: bar }"></div>
      </div>
      <p class="mt-1 font-mono text-[11px] uppercase tracking-widest text-black/60">Nilai / 100</p>
    </div>
  </div>
</template>
