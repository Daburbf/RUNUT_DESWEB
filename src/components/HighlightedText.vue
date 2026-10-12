<script setup>
import { computed } from 'vue'
const props = defineProps({ text: String, issues: Array, selected: String })
defineEmits(['pick'])
// Dokumentasi: teks Swiss — sorotan = underline merah tebal (mark.swiss-mark).
// Terpilih = blok hitam teks putih.
const parts = computed(() => {
  const out = []; let pos = 0
  props.issues.filter((i) => i.status === 'pending').forEach((i) => {
    if (i.start > pos) out.push({ t: props.text.slice(pos, i.start) })
    out.push({ t: props.text.slice(i.start, i.end), issue: i }); pos = i.end
  })
  out.push({ t: props.text.slice(pos) })
  return out
})
</script>
<template>
  <div class="whitespace-pre-wrap text-[15px] leading-8 text-black">
    <template v-for="(p, idx) in parts" :key="idx">
      <mark v-if="p.issue" @click="$emit('pick', p.issue.id)" class="swiss-mark"
        :style="selected === p.issue.id
          ? { background: '#000000', color: '#FFFFFF', boxShadow: 'none' }
          : { background: 'transparent', boxShadow: 'inset 0 -3px 0 #FF3000' }">{{ p.t }}</mark>
      <span v-else>{{ p.t }}</span>
    </template>
  </div>
</template>
