<script setup>
import { CATEGORIES, canon } from '../utils/categories'
defineProps({ summary: Array, active: String })
defineEmits(['select'])
const cat = (t) => CATEGORIES[canon(t)]
</script>
<template>
  <div class="border-2 border-black">
    <button v-for="s in summary" :key="s.type || s.category" @click="$emit('select', active === (s.type || s.category) ? null : (s.type || s.category))"
      :aria-pressed="active === (s.type || s.category)"
      :class="['swiss-snap-fast flex w-full items-center gap-4 border-b-2 border-black px-4 py-3 text-left last:border-b-0 min-h-[44px]', active === (s.type || s.category) ? 'bg-black text-white' : 'bg-white hover:bg-[#F2F2F2]']">
      <span class="font-mono text-xs font-medium text-[#FF3000]">{{ cat(s.type || s.category).num }}</span>
      <i :class="['fa-solid w-4 text-sm', cat(s.type || s.category).icon]"></i>
      <span class="flex-1 text-xs font-bold uppercase tracking-wide">{{ cat(s.type || s.category).label }}</span>
      <span class="font-mono text-2xl font-black tabular-nums">{{ s.count }}</span>
    </button>
  </div>
</template>
