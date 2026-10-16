<script setup>
import { computed } from 'vue'
import { canon, CATEGORIES } from '../utils/categories'
const props = defineProps({ text: String, issues: Array, selected: String })
defineEmits(['pick'])

const statusOf = (i) => i.decision || 'active'

const parts = computed(() => {
  const out = []
  let pos = 0
  const list = [...(props.issues || [])]
    .filter((i) => statusOf(i) !== 'rejected')
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

const cat = (i) => CATEGORIES[canon(i.category || i.type)]

function markStyle(i) {
  if (props.selected === i.id) return { background: '#000000', color: '#FFFFFF' }
  const color = cat(i).color
  return {
    background: statusOf(i) === 'applied' ? `${color}22` : 'transparent',
    boxShadow: statusOf(i) === 'applied' ? `inset 0 -4px 0 ${color}` : `inset 0 -2px 0 ${color}`,
  }
}
</script>

<template>
  <div class="whitespace-pre-wrap text-[15px] leading-8 text-black">
    <template v-for="(p, idx) in parts" :key="idx">
      <mark v-if="p.issue" @click="$emit('pick', p.issue.id)" class="swiss-mark cursor-pointer"
        :title="`${cat(p.issue).label}${statusOf(p.issue) === 'applied' ? ' · saran sudah diterapkan' : ''}`"
        :style="markStyle(p.issue)">{{ p.t }}</mark>
      <span v-else>{{ p.t }}</span>
    </template>
  </div>
</template>
