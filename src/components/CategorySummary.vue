<script setup>
import { CATEGORIES } from '../utils/analyzer'
defineProps({ summary: Array, active: String })
defineEmits(['select'])
</script>
<template>
  <!-- Dokumentasi: ringkasan kategori Swiss — baris tabel ber-border,
       aktif = hitam terbalik, angka mono besar. Filter satu klik.
       Kategori kemiripan & indikasi AI menampilkan persentase. -->
  <div class="border-2 border-black">
    <button v-for="s in summary" :key="s.type" @click="$emit('select', active === s.type ? null : s.type)"
      :aria-pressed="active === s.type"
      :class="['swiss-snap-fast flex w-full items-center gap-4 border-b-2 border-black px-4 py-3 text-left last:border-b-0 min-h-[44px]', active === s.type ? 'bg-black text-white' : 'bg-white hover:bg-[#F2F2F2]']">
      <span class="font-mono text-xs font-medium text-[#FF3000]">{{ CATEGORIES[s.type].num }}</span>
      <i :class="['fa-solid w-4 text-sm', CATEGORIES[s.type].icon]"></i>
      <span class="flex-1 text-xs font-bold uppercase tracking-wide">{{ CATEGORIES[s.type].label }}</span>
      <span v-if="s.pct !== null && s.pct !== undefined" class="bg-[#FF3000] px-2 py-1 font-mono text-sm font-black tabular-nums text-white">{{ s.pct }}%</span>
      <span v-else class="font-mono text-2xl font-black tabular-nums">{{ s.count }}</span>
    </button>
  </div>
</template>
