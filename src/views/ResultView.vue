<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import BaseCard from '../components/BaseCard.vue'
import ScoreRing from '../components/ScoreRing.vue'
import CategorySummary from '../components/CategorySummary.vue'
import HighlightedText from '../components/HighlightedText.vue'
import SuggestionCard from '../components/SuggestionCard.vue'
import SectionLabel from '../components/SectionLabel.vue'
import BaseModal from '../components/BaseModal.vue'
import { documents } from '../store/documents'
import { applySuggestions } from '../utils/analyzer'
import { downloadText } from '../utils/download'

const router = useRouter()
const doc = ref(documents.getCurrent())
if (!doc.value) router.replace('/analisis')

const filter = ref(null)
const selected = ref(null)
const notice = ref('')
const confirmSave = ref(false)
const revised = computed(() => (doc.value ? applySuggestions(doc.value.original_text, doc.value.result.issues) : ''))
const pending = computed(() => doc.value?.result.issues.filter((i) => i.status === 'pending' && (!filter.value || i.type === filter.value)) ?? [])
const decided = computed(() => doc.value?.result.issues.filter((i) => i.status !== 'pending').length ?? 0)

function say(msg) { notice.value = msg; clearTimeout(say.t); say.t = setTimeout(() => (notice.value = ''), 2600) }
function persist() { documents.setCurrent(doc.value) }
function accept(id, draft) { const i = doc.value.result.issues.find((x) => x.id === id); i.suggestion = draft; i.status = 'accepted'; persist(); say('Oke, saran ini dipakai.') }
function reject(id) { doc.value.result.issues.find((x) => x.id === id).status = 'rejected'; persist() }
function acceptAll() { pending.value.forEach((i) => (i.status = 'accepted')); persist(); say('Semua saran dipakai.') }
function pick(id) {
  selected.value = id
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}
function askSave() {
  if (!doc.value) return
  confirmSave.value ? doSave() : (confirmSave.value = true)
}
function doSave() { documents.save(doc.value); persist(); confirmSave.value = false; say('Udah kesimpen di riwayat.') }
function download(which) {
  const t = which === 'asli' ? doc.value.original_text : revised.value
  downloadText(`${doc.value.title}-${which}.txt`, t); say('Filenya udah keunduh.')
}
async function copy() { await navigator.clipboard.writeText(revised.value); say('Hasil revisinya udah disalin.') }
</script>

<template>
  <section v-if="doc" class="mx-auto max-w-6xl px-4 py-10 sm:px-6">
    <SectionLabel>Hasil analisis</SectionLabel>
    <div class="mb-8 mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 class="max-w-3xl text-4xl font-black uppercase leading-[0.95] tracking-tighter md:text-6xl">{{ doc.title }}</h1>
        <p class="mt-3 font-mono text-xs uppercase tracking-widest text-black/60">{{ doc.result.words_count }} kata · {{ doc.result.sentences_count }} kalimat · {{ doc.result.issues.length }} temuan</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <BaseButton variant="secondary" size="sm" to="/analisis"><i class="fa-solid fa-arrow-left"></i>Ganti teks</BaseButton>
        <BaseButton variant="secondary" size="sm" @click="askSave"><i class="fa-regular fa-floppy-disk"></i>Simpen</BaseButton>
        <BaseButton variant="accent" size="sm" @click="download('revisi')"><i class="fa-solid fa-download"></i>Unduh hasil</BaseButton>
      </div>
    </div>

    <p v-if="notice" class="mb-6 flex items-center gap-3 border-2 border-black bg-black px-4 py-3 text-sm font-bold uppercase tracking-wide text-white">
      <span class="flex h-6 w-6 items-center justify-center bg-[#FF3000]"><i class="fa-solid fa-check text-xs"></i></span>{{ notice }}
    </p>

    <div class="grid gap-6 lg:grid-cols-[7fr_5fr]">
      <div class="flex flex-col gap-6">
        <BaseCard class="p-6 sm:p-8">
          <ScoreRing :score="doc.result.score" />
          <div v-if="doc.result.metrics" class="mt-6 grid gap-3 sm:grid-cols-2">
            <div class="border-2 border-black p-4">
              <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]"><i class="fa-solid fa-clone mr-1.5"></i>Kemiripan teks</p>
              <p class="mt-2 text-4xl font-black tracking-tighter">{{ doc.result.metrics.similarity_pct }}<span class="text-lg">%</span></p>
              <p class="mt-1 text-xs text-black/60">{{ doc.result.metrics.similarity_pairs }} pasang kalimat yang mirip</p>
            </div>
            <div class="border-2 border-black p-4">
              <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]"><i class="fa-solid fa-robot mr-1.5"></i>Indikasi AI</p>
              <p class="mt-2 text-4xl font-black tracking-tighter">{{ doc.result.metrics.ai_pct }}<span class="text-lg">%</span></p>
              <p class="mt-1 inline-block bg-black px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-widest text-white">{{ doc.result.metrics.ai_level }}</p>
              <p class="mt-2 text-xs text-black/60">{{ doc.result.metrics.ai_signals.join(' · ') }}</p>
            </div>
          </div>
          <div class="mt-6 border-t-2 border-black pt-6"><CategorySummary :summary="doc.result.summary" :active="filter" @select="filter = $event" /></div>
        </BaseCard>
        <BaseCard class="p-6 sm:p-8">
          <p class="mb-4 font-mono text-xs uppercase tracking-widest text-[#FF3000]">Tulisanmu yang udah ditandain</p>
          <HighlightedText :text="doc.original_text" :issues="doc.result.issues" :selected="selected" @pick="pick" />
        </BaseCard>
        <!-- Perbandingan asli vs revisi (dulu halaman terpisah) -->
        <div class="grid gap-6 md:grid-cols-2">
          <BaseCard>
            <div class="flex items-center justify-between border-b-2 border-black px-6 py-3">
              <span class="font-mono text-xs font-bold tracking-widest text-[#FF3000]">SEBELUM</span>
              <button class="font-mono text-xs font-bold uppercase hover:text-[#FF3000]" @click="download('asli')"><i class="fa-solid fa-download mr-1"></i>.txt</button>
            </div>
            <p class="whitespace-pre-wrap p-6 text-[15px] leading-8 text-black/70">{{ doc.original_text }}</p>
          </BaseCard>
          <BaseCard class="!border-[#FF3000]">
            <div class="flex items-center justify-between border-b-2 border-[#FF3000] bg-[#FF3000] px-6 py-3 font-mono text-xs font-bold tracking-widest text-white">
              <span>SESUDAH</span>
              <button class="uppercase hover:underline" @click="copy"><i class="fa-regular fa-copy mr-1"></i>Salin</button>
            </div>
            <p class="whitespace-pre-wrap p-6 text-[15px] leading-8 font-medium">{{ revised }}</p>
          </BaseCard>
        </div>
        <p class="font-mono text-xs uppercase tracking-widest text-black/60"><span class="bg-black px-2 py-1 text-white">{{ decided }} saran udah diputusin</span></p>
      </div>

      <aside class="lg:sticky lg:top-24 lg:self-start">
        <BaseCard>
          <div class="flex items-center justify-between border-b-2 border-black px-4 py-3">
            <h2 class="font-black uppercase tracking-tight">Saran-sarannya</h2>
            <button v-if="pending.length" class="font-mono text-xs font-bold uppercase tracking-widest text-[#FF3000] hover:underline" @click="acceptAll">Terima semua</button>
          </div>
          <div class="max-h-[70vh] space-y-3 overflow-y-auto p-4">
            <SuggestionCard v-for="i in pending" :id="i.id" :key="i.id" :issue="i" :selected="selected === i.id" @pick="selected = $event" @accept="accept" @reject="reject" />
            <div v-if="!pending.length" class="border-2 border-black bg-[#F2F2F2] py-10 text-center text-sm font-bold uppercase tracking-wide">
              <i class="fa-regular fa-circle-check mb-2 block text-2xl"></i>Udah beres semua.
            </div>
          </div>
        </BaseCard>
      </aside>
    </div>

    <!-- Modal konfirmasi simpan -->
    <BaseModal :open="confirmSave" title="Disimpen ke riwayat?" @close="confirmSave = false">
      <p class="border-l-4 border-[#FF3000] bg-[#F2F2F2] p-4 text-sm">“{{ doc.title }}” bakal masuk daftar riwayat kamu.</p>
      <div class="mt-6 flex justify-end gap-2">
        <BaseButton variant="secondary" size="sm" @click="confirmSave = false">Gajadi</BaseButton>
        <BaseButton variant="accent" size="sm" @click="doSave">Simpen</BaseButton>
      </div>
    </BaseModal>
  </section>
</template>
