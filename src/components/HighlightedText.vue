<script setup>
import { computed } from 'vue'
import { canon, CATEGORIES } from '../utils/categories'
const props = defineProps({ text: String, issues: Array, selected: String })
defineEmits(['pick'])
const parts = computed(() => {
  const out = []
  let pos = 0
  const list = [...(props.issues || [])]
    .filter((i) => (i.decision || i.status || 'pending') === 'pending')
    .map((i) => ({ ...i, s: i.start_pos ?? i.start, e: i.end_pos ?? i.end }))
    .filter((i) => Number.isInteger(i.s) && Number.isInteger(i.e) && i.s >= 0 && i.e > i.s && i.e <= (props.text || '').length)
    .sort((a, b) => a.s - b.s)
  for (const i of list) {
    if (i.s < pos) continue
    if (i.s > pos) out.push({ t: props.text.slice(pos, i.s) })
    out.push({ t: props.text.slice(i.s, i.e), issue: i })
    pos = i.e
  }
  out.push({ t: (props.text || '').slice(pos) })
  return out
})
const colorOf = (i) => CATEGORIES[canon(i.category || i.type)].color
</script>
<template>
  <div class="whitespace-pre-wrap text-[15px] leading-8 text-black">
    <template v-for="(p, idx) in parts" :key="idx">
      <mark v-if="p.issue" @click="$emit('pick', p.issue.id)" class="swiss-mark cursor-pointer"
        :title="CATEGORIES[canon(p.issue.category || p.issue.type)].label"
        :style="selected === p.issue.id
          ? { background: '#000000', color: '#FFFFFF', boxShadow: 'none' }
          : { background: 'transparent', boxShadow: `inset 0 -3px 0 ${colorOf(p.issue)}` }">{{ p.t }}</mark>
      <span v-else>{{ p.t }}</span>
    </template>
  </div>
</template>
