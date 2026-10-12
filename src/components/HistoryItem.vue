<script setup>
import BaseCard from './BaseCard.vue'
defineProps({ doc: Object })
defineEmits(['open', 'remove'])
const fmt = (t) => new Date(t).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
</script>
<template>
  <!-- Dokumentasi: item riwayat Swiss — baris tabel, hover = inversi hitam. -->
  <BaseCard class="swiss-snap group flex flex-col gap-4 p-5 hover:bg-black hover:text-white sm:flex-row sm:items-center">
    <div class="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-black bg-white text-black group-hover:border-white"><i class="fa-regular fa-file-lines text-lg"></i></div>
    <div class="min-w-0 flex-1">
      <h3 class="truncate font-black uppercase tracking-tight">{{ doc.title }}</h3>
      <p class="mt-0.5 truncate text-sm opacity-60">{{ doc.original_text.slice(0, 90) }}…</p>
      <p class="mt-1 font-mono text-[11px] uppercase tracking-widest opacity-60">{{ fmt(doc.updated_at) }} · {{ doc.result.issues.length }} temuan · skor {{ doc.result.score }}</p>
    </div>
    <div class="flex gap-2">
      <button class="min-h-[44px] border-2 border-black bg-black px-4 py-2 text-xs font-bold uppercase tracking-widest text-white group-hover:border-white hover:!bg-[#FF3000] hover:!border-[#FF3000]" @click="$emit('open', doc)"><i class="fa-solid fa-arrow-up-right-from-square mr-1.5"></i>Buka</button>
      <button class="flex min-h-[44px] min-w-[44px] items-center justify-center border-2 border-black px-3 py-2 text-sm group-hover:border-white hover:!bg-[#FF3000] hover:!border-[#FF3000] hover:!text-white" aria-label="Hapus" @click="$emit('remove', doc)"><i class="fa-regular fa-trash-can"></i></button>
    </div>
  </BaseCard>
</template>
