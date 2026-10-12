<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import BaseCard from '../components/BaseCard.vue'
import CategorySummary from '../components/CategorySummary.vue'
import HighlightedText from '../components/HighlightedText.vue'
import SuggestionCard from '../components/SuggestionCard.vue'
import SignalsCard from '../components/SignalsCard.vue'
import SectionLabel from '../components/SectionLabel.vue'
import BaseModal from '../components/BaseModal.vue'
import { documents } from '../store/documents'
import { auth } from '../store/auth'
import { canon } from '../utils/categories'

const router = useRouter()
const draft = ref(documents.getCurrent())
if (!draft.value) router.replace('/analisis')

const filter = ref(null)
const selected = ref(null)
const notice = ref('')
const error = ref('')
const busy = ref(false)
const showCompare = ref(true)

const doc = computed(() => draft.value?.document)
const analysis = computed(() => draft.value?.analysis)
const stats = computed(() => analysis.value?.stats || {})
const signals = computed(() => analysis.value?.signals || analysis.value?.stats?.signals || null)
const issues = computed(() => draft.value?.issues || [])
const pending = computed(() => issues.value.filter((i) => (i.decision || 'pending') === 'pending' && (!filter.value || (i.category || i.type) === filter.value)))
const decided = computed(() => issues.value.filter((i) => (i.decision || 'pending') !== 'pending').length)
const revised = computed(() => doc.value?.revised_text || draft.value?.revised_text || doc.value?.original_text || '')
const summary = computed(() => {
  const map = new Map()
  for (const i of issues.value) {
    const k = canon(i.category || i.type)
    map.set(k, (map.get(k) || 0) + 1)
  }
  return [...map.entries()].map(([type, count]) => ({ type, count }))
})

function say(msg) { notice.value = msg; clearTimeout(say.t); say.t = setTimeout(() => (notice.value = ''), 2600) }
function fail(msg) { error.value = msg; clearTimeout(fail.t); fail.t = setTimeout(() => (error.value = ''), 5000) }
function sync(d) { draft.value = d; documents.setCurrent(d) }

function pick(id) {
  selected.value = id
  const el = document.getElementById('s-' + id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

async function sendDecision(body, okMsg) {
  busy.value = true
  try {
    const id = doc.value.id
    const res = await documents.decide(id, body)
    const next = { ...draft.value, issues: res.issues, revised_text: res.revised_text, document: { ...doc.value, revised_text: res.revised_text } }
    sync(next)
    say(okMsg)
  } catch (e) {
    if (e.status === 403) fail('Saran terkunci untuk akun gratis. Buka halaman Premium untuk membuka semuanya.')
    else if (e.status === 409) fail(e.message)
    else fail(e.message || 'Gagal menyimpan keputusan.')
  } finally {
    busy.value = false
  }
}

function accept(issue) {
  if (issue.needs_manual_review && !confirm('Saran ini ditandai PERLU CEK MANUAL (berisiko mengubah makna). Tetap terapkan?')) return
  sendDecision({ decisions: [{ id: issue.id, decision: 'accepted', confirmManual: true }] }, 'Oke, saran ini dipakai.')
}
function reject(issue) {
  sendDecision({ decisions: [{ id: issue.id, decision: 'rejected' }] }, 'Saran ditolak.')
}
function acceptAll() {
  if (!confirm('Terapkan semua saran yang aman sekaligus? (Yang perlu cek manual dilewati.)')) return
  sendDecision({ acceptAll: true }, 'Semua saran aman dipakai.')
}
async function restore() {
  if (!confirm('Pulihkan teks asli dan ulang semua keputusan?')) return
  busy.value = true
  try {
    const res = await documents.restore(doc.value.id)
    const fresh = await documents.get(doc.value.id)
    sync({ document: fresh.document, analysis: fresh.analysis, issues: fresh.issues, revised_text: res.revised_text, meta: draft.value.meta })
    say('Teks asli dipulihkan.')
  } catch (e) { fail(e.message) } finally { busy.value = false }
}
async function download(format) {
  try {
    await documents.download(doc.value.id, format, `${doc.value.title}-revisi.${format}`)
    say('Filenya udah keunduh.')
  } catch (e) { fail(e.message) }
}
async function copy() {
  try { await navigator.clipboard.writeText(revised.value); say('Hasil revisinya udah disalin.') }
  catch { fail('Gagal menyalin ke clipboard.') }
}
</script>

<template>
  <section v-if="draft && doc" class="mx-auto max-w-6xl px-4 py-10 sm:px-6">
    <SectionLabel>Hasil analisis</SectionLabel>
    <div class="mb-8 mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 class="max-w-3xl text-4xl font-black uppercase leading-[0.95] tracking-tighter md:text-6xl">{{ doc.title }}</h1>
        <p class="mt-3 font-mono text-xs uppercase tracking-widest text-black/60">{{ stats.word_count }} kata · {{ stats.sentence_count }} kalimat · {{ issues.length }} temuan</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <BaseButton variant="secondary" size="sm" to="/analisis"><i class="fa-solid fa-arrow-left"></i>Ganti teks</BaseButton>
        <BaseButton variant="secondary" size="sm" @click="download('txt')"><i class="fa-solid fa-download"></i>.txt</BaseButton>
        <BaseButton variant="secondary" size="sm" @click="download('docx')"><i class="fa-solid fa-file-word"></i>.docx</BaseButton>
        <BaseButton variant="accent" size="sm" @click="restore"><i class="fa-solid fa-rotate-left"></i>Pulihkan asli</BaseButton>
      </div>
    </div>

    <p v-if="notice" class="mb-6 flex items-center gap-3 border-2 border-black bg-black px-4 py-3 text-sm font-bold uppercase tracking-wide text-white">
      <span class="flex h-6 w-6 items-center justify-center bg-[#FF3000]"><i class="fa-solid fa-check text-xs"></i></span>{{ notice }}
    </p>
    <p v-if="error" class="mb-6 flex items-center gap-3 border-2 border-black bg-black px-4 py-3 text-sm font-bold uppercase tracking-wide text-white">
      <span class="flex h-6 w-6 items-center justify-center bg-[#FF3000]"><i class="fa-solid fa-triangle-exclamation text-xs"></i></span>{{ error }}
    </p>
    <div v-if="draft.meta?.locked_note" class="mb-6 border-2 border-black bg-[#F2F2F2] p-4 text-sm">
      <strong>Mode gratis:</strong> {{ draft.meta.locked_note }}
      <router-link to="/premium" class="ml-2 font-bold uppercase tracking-wide underline decoration-[#FF3000] decoration-2 underline-offset-4">Buka Premium</router-link>
    </div>

    <!-- Editor kiri + panel hasil kanan (desktop); vertikal di HP -->
    <div class="grid gap-6 lg:grid-cols-[7fr_5fr]">
      <div class="flex flex-col gap-6">
        <BaseCard class="p-6 sm:p-8">
          <p class="mb-2 font-mono text-xs uppercase tracking-widest text-[#FF3000]">Statistik tulisan (dihitung server)</p>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div class="border-2 border-black p-3"><p class="font-mono text-[11px] uppercase tracking-widest text-black/60">Kata</p><p class="text-3xl font-black tabular-nums">{{ stats.word_count }}</p></div>
            <div class="border-2 border-black p-3"><p class="font-mono text-[11px] uppercase tracking-widest text-black/60">Kalimat</p><p class="text-3xl font-black tabular-nums">{{ stats.sentence_count }}</p></div>
            <div class="border-2 border-black p-3"><p class="font-mono text-[11px] uppercase tracking-widest text-black/60">Rata-rata</p><p class="text-3xl font-black tabular-nums">{{ stats.avg_sentence_length }}</p></div>
            <div class="border-2 border-black p-3"><p class="font-mono text-[11px] uppercase tracking-widest text-black/60">Temuan</p><p class="text-3xl font-black tabular-nums">{{ issues.length }}</p></div>
          </div>
          <div v-if="stats.top_words?.length" class="mt-4 border-t-2 border-black pt-4">
            <p class="mb-2 font-mono text-xs uppercase tracking-widest text-[#FF3000]">Kata tersering</p>
            <div class="flex flex-wrap gap-2">
              <span v-for="w in stats.top_words.slice(0, 8)" :key="w.word" class="border-2 border-black px-2 py-1 font-mono text-xs">{{ w.word }} ×{{ w.count }}</span>
            </div>
          </div>
          <div class="mt-6 border-t-2 border-black pt-6"><CategorySummary :summary="summary" :active="filter" @select="filter = $event" /></div>
        </BaseCard>

        <SignalsCard v-if="signals" :signals="signals" />

        <BaseCard class="p-6 sm:p-8">
          <p class="mb-4 font-mono text-xs uppercase tracking-widest text-[#FF3000]">Tulisanmu yang udah ditandain</p>
          <HighlightedText :text="doc.original_text" :issues="issues" :selected="selected" @pick="pick" />
        </BaseCard>

        <div class="flex items-center justify-between">
          <button class="font-mono text-xs font-bold uppercase tracking-widest underline decoration-[#FF3000] decoration-2 underline-offset-4" @click="showCompare = !showCompare">
            {{ showCompare ? 'Sembunyikan perbandingan' : 'Bandingkan asli vs revisi' }}
          </button>
          <p class="font-mono text-xs uppercase tracking-widest text-black/60"><span class="bg-black px-2 py-1 text-white">{{ decided }} saran udah diputusin</span></p>
        </div>
        <div v-if="showCompare" class="grid gap-6 md:grid-cols-2">
          <BaseCard>
            <div class="flex items-center justify-between border-b-2 border-black px-6 py-3">
              <span class="font-mono text-xs font-bold tracking-widest text-[#FF3000]">SEBELUM</span>
              <button class="font-mono text-xs font-bold uppercase hover:text-[#FF3000]" @click="download('txt')"><i class="fa-solid fa-download mr-1"></i>.txt</button>
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
      </div>

      <aside class="lg:sticky lg:top-24 lg:self-start">
        <BaseCard>
          <div class="flex items-center justify-between border-b-2 border-black px-4 py-3">
            <h2 class="font-black uppercase tracking-tight">Saran-sarannya</h2>
            <button v-if="pending.length && auth.user?.is_premium" :disabled="busy" class="font-mono text-xs font-bold uppercase tracking-widest text-[#FF3000] hover:underline disabled:opacity-50" @click="acceptAll">Terima semua</button>
          </div>
          <div class="max-h-[70vh] space-y-3 overflow-y-auto p-4">
            <div v-for="i in pending" :id="'s-' + i.id" :key="i.id">
              <SuggestionCard :issue="i" :selected="selected === i.id" @pick="selected = $event" @accept="accept" @reject="reject" />
            </div>
            <div v-if="!pending.length" class="border-2 border-black bg-[#F2F2F2] py-10 text-center text-sm font-bold uppercase tracking-wide">
              <i class="fa-regular fa-circle-check mb-2 block text-2xl"></i>Udah beres semua.
            </div>
          </div>
        </BaseCard>
        <BaseModal :open="busy" title="Menyimpan…"><p class="text-sm">Keputusanmu lagi disimpan ke server.</p></BaseModal>
      </aside>
    </div>
  </section>
</template>
