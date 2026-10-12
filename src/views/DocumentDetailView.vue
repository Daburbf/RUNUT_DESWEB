<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import BaseCard from '../components/BaseCard.vue'
import SectionLabel from '../components/SectionLabel.vue'
import ScoreRing from '../components/ScoreRing.vue'
import { documents } from '../store/documents'
import { applySuggestions } from '../utils/analyzer'

const route = useRoute()
const router = useRouter()
const doc = computed(() => documents.get(route.params.id))

function open() {
  if (!doc.value) return
  documents.setCurrent(doc.value)
  router.push('/hasil')
}
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 py-12 sm:px-6">
    <SectionLabel>Detail dokumen</SectionLabel>
    <div v-if="doc">
      <h1 class="mt-4 max-w-3xl text-4xl font-black uppercase leading-[0.95] tracking-tighter md:text-6xl">{{ doc.title }}</h1>
      <p class="mt-3 font-mono text-xs uppercase tracking-widest text-black/60">
        {{ doc.result.words_count }} kata · {{ doc.result.sentences_count }} kalimat · {{ doc.result.issues.length }} temuan
      </p>

      <div class="mt-8 grid gap-6 md:grid-cols-2">
        <BaseCard class="p-6 sm:p-8">
          <ScoreRing :score="doc.result.score" />
          <p class="mt-6 text-sm leading-7 text-black/70">
            Ini ringkasan kondisinya waktu terakhir dicek. Kalau mau ngulik sarannya satu-satu
            atau nerusin revisi yang kemarin kepending, buka aja hasil lengkapnya.
          </p>
          <div class="mt-6 flex flex-wrap gap-2">
            <BaseButton size="sm" @click="open">Buka hasil lengkap <i class="fa-solid fa-arrow-right text-xs"></i></BaseButton>
            <BaseButton variant="secondary" size="sm" to="/riwayat">Kembali</BaseButton>
          </div>
        </BaseCard>
        <BaseCard>
          <div class="border-b-2 border-black bg-[#F2F2F2] px-6 py-3">
            <span class="font-mono text-xs font-bold uppercase tracking-widest text-[#FF3000]">Hasil revisi terakhir</span>
          </div>
          <p class="max-h-[320px] overflow-y-auto whitespace-pre-wrap p-6 text-[15px] leading-8">{{ applySuggestions(doc.original_text, doc.result.issues) }}</p>
        </BaseCard>
      </div>

      <BaseCard class="mt-6">
        <div class="border-b-2 border-black px-6 py-3">
          <span class="font-mono text-xs font-bold uppercase tracking-widest text-[#FF3000]">Teks asli</span>
        </div>
        <p class="max-h-[280px] overflow-y-auto whitespace-pre-wrap p-6 text-[15px] leading-8 text-black/70">{{ doc.original_text }}</p>
      </BaseCard>
    </div>

    <div v-else class="mt-8 border-4 border-black bg-[#F2F2F2] p-10 text-center">
      <p class="font-black uppercase tracking-tight">Dokumennya nggak ketemu.</p>
      <p class="mt-1 text-sm text-black/60">Mungkin udah dihapus atau linknya salah salin.</p>
      <BaseButton to="/riwayat" class="mt-6">Balik ke riwayat</BaseButton>
    </div>
  </section>
</template>
