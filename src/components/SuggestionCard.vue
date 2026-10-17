<script setup>
import { CATEGORIES, canon } from '../utils/categories'
const props = defineProps({ issue: Object, selected: Boolean, busy: Boolean })
defineEmits(['accept', 'reject', 'pick'])
const key = canon(props.issue.category || props.issue.type)
const color = CATEGORIES[key].color
</script>

<template>
  <article @click="$emit('pick', issue.id)"
    :class="['swiss-snap cursor-pointer border-2 p-4', selected ? 'border-black bg-black text-white' : 'border-black bg-white hover:bg-[#F2F2F2]']">
    <div class="mb-2 flex flex-wrap items-center gap-2 text-xs">
      <span class="px-1.5 py-0.5 font-mono font-bold text-white" :style="{ background: color }">{{ CATEGORIES[key].num }}</span>
      <i :class="['fa-solid', CATEGORIES[key].icon]"></i>
      <span class="font-bold uppercase tracking-widest">{{ CATEGORIES[key].label }}</span>
      <span v-if="issue.needs_manual_review" class="ml-auto border-2 border-black bg-[#F2F2F2] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-black">Perlu cek manual</span>
    </div>
    <p class="text-sm">{{ issue.explanation }}</p>
    <div class="mt-3 space-y-1.5 border-t-2 pt-3 text-sm" :class="selected ? 'border-white/30' : 'border-black/10'">
      <p class="break-words font-mono text-xs" :class="selected ? 'text-white/80' : 'text-black/60'">Kutipan: "{{ issue.snippet }}"</p>
      <p class="border-2 px-2 py-1 font-medium" :class="selected ? 'border-white bg-white text-black' : 'border-black bg-black text-white'">{{ issue.suggestion }}</p>
    </div>
    <div class="mt-4 flex flex-wrap gap-2">
      <button :disabled="busy" class="min-h-[44px] border-2 border-black bg-black px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-[#FF3000] hover:border-[#FF3000] disabled:opacity-50" :class="selected && '!border-white'" @click.stop="$emit('accept', issue)"><i class="fa-solid fa-check mr-1"></i>Terapkan</button>
      <button :disabled="busy" class="min-h-[44px] border-2 border-black bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-black hover:bg-black hover:text-white disabled:opacity-50" :class="selected && '!border-white !bg-transparent !text-white hover:!bg-white hover:!text-black'" @click.stop="$emit('reject', issue)"><i class="fa-solid fa-xmark mr-1"></i>Tolak</button>
    </div>
  </article>
</template>