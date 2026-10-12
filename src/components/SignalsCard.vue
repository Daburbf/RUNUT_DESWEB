<script setup>
import { computed } from 'vue'
import BaseCard from './BaseCard.vue'

const props = defineProps({ signals: Object })

const like = computed(() => props.signals?.ai_likeness || null)
const sim = computed(() => props.signals?.similarity || null)
const source = computed(() => props.signals?.meta?.ai_source || '')

const bandCls = (b) =>
  b === 'tinggi' ? 'bg-[#B3261E] text-white border-[#B3261E]'
  : b === 'sedang' ? 'bg-[#7C4D00] text-white border-[#7C4D00]'
  : 'bg-white text-black'
</script>

<template>
  <BaseCard v-if="like || sim" class="p-6 sm:p-8">
    <p class="mb-1 font-mono text-xs uppercase tracking-widest text-[#FF3000]">Sinyal tambahan (provisional)</p>
    <p class="mb-5 text-xs leading-6 text-black/60">
      Angka di bawah ini <strong>bukan vonis AI dan bukan skor Turnitin</strong> — hanya sinyal awal yang masih dilatih.
    </p>

    <!-- Kemiripan pola -->
    <div v-if="like" class="border-2 border-black p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm font-black uppercase tracking-tight">Kemiripan pola</p>
        <span :class="['border-2 border-black px-2 py-1 font-mono text-xs font-bold uppercase tracking-widest', bandCls(like.band)]">
          {{ like.score }} / 100 · {{ like.band }}
        </span>
      </div>
      <div class="mt-3 h-3 border-2 border-black bg-white" role="img" :aria-label="`Kemiripan pola ${like.score} dari 100`">
        <div class="h-full bg-[#FF3000]" :style="{ width: Math.min(100, Math.max(0, like.score)) + '%' }"></div>
      </div>
      <p class="mt-2 text-xs text-black/60">
        Sumber: {{ source === 'model' ? 'model (' + (like.method || 'Qwen') + ')' : 'heuristik sementara (heuristic-v0)' }}.
        {{ like.disclaimer }}
      </p>
      <ul v-if="like.reasons?.length" class="mt-3 space-y-1.5 text-sm">
        <li v-for="(r, i) in like.reasons.slice(0, 3)" :key="i" class="flex gap-2">
          <span class="text-[#FF3000]">■</span><span>{{ r }}</span>
        </li>
      </ul>
      <p v-if="like.fallback" class="mt-3 border-t-2 border-black/10 pt-2 font-mono text-[11px] uppercase tracking-widest text-black/50">
        Pembanding heuristik: {{ like.fallback.score }}/100 · {{ like.fallback.band }}
      </p>
    </div>

    <!-- Kemiripan internal -->
    <div v-if="sim" class="mt-4 border-2 border-black p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm font-black uppercase tracking-tight">Kemiripan dengan tulisanmu sendiri</p>
        <span class="border-2 border-black bg-black px-2 py-1 font-mono text-xs font-bold text-white">
          maks {{ sim.max_score }}%
        </span>
      </div>
      <p class="mt-2 text-xs text-black/60">{{ sim.disclaimer }}</p>
      <ul v-if="sim.matches?.length" class="mt-3 space-y-1.5 text-sm">
        <li v-for="m in sim.matches" :key="m.document_id || m.title" class="flex items-center justify-between gap-3 border-2 border-black/10 px-3 py-2">
          <span class="min-w-0 truncate font-bold">{{ m.title }}</span>
          <span class="shrink-0 font-mono text-xs font-bold">{{ m.score }}%</span>
        </li>
      </ul>
      <p v-else class="mt-3 text-sm text-black/60">Tidak ada bagian yang mirip dengan {{ sim.compared }} dokumenmu yang lain.</p>
    </div>
  </BaseCard>
</template>
