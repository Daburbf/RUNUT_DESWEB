<script setup>
import { CATEGORIES, canon } from '../utils/categories'
defineProps({ summary: Array, active: String })
defineEmits(['select'])
const cat = (t) => CATEGORIES[canon(t)]
</script>

<template>
  <div class="border-2 border-black">
    <button v-for="s in summary" :key="s.type" @click="$emit('select', active === s.type ? null : s.type)"
      :aria-pressed="active === s.type"
      :class="['swiss-snap-fast flex w-full items-center gap-4 border-b-2 border-black px-4 py-3 text-left last:border-b-0 min-h-[44px]', active === s.type ? 'bg-black text-white' : 'bg-white hover:bg-[#F2F2F2]']">
      <span class="h-4 w-4 shrink-0 border-2 border-black" :style="{ background: cat(s.type).color }" aria-hidden="true"></span>
      <span class="font-mono text-xs font-medium text-[#FF3000]">{{ cat(s.type).num }}</span>
      <i :class="['fa-solid w-4 text-sm', cat(s.type).icon]"></i>
      <span class="flex-1 text-xs font-bold uppercase tracking-wide">{{ cat(s.type).label }}</span>
      <span class="font-mono text-2xl font-black tabular-nums">{{ s.count }}</span>
    </button>
  </div>
</template>
