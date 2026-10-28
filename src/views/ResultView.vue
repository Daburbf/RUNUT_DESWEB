<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import BaseCard from '../components/BaseCard.vue'
import CategorySummary from '../components/CategorySummary.vue'
import HighlightedText from '../components/HighlightedText.vue'
import SuggestionCard from '../components/SuggestionCard.vue'
import SectionLabel from '../components/SectionLabel.vue'
import BaseModal from '../components/BaseModal.vue'
import { documents } from '../store/documents'
import { auth } from '../store/auth'
import { canon, CATEGORIES } from '../utils/categories'

const route = useRoute()
const router = useRouter()
const draft = ref(documents.getCurrent())
const loading = ref(!draft.value)
const loadError = ref('')

// Sumber kebenaran hasil adalah server: bila URL memuat id dokumen (dari
// analisis baru, riwayat, atau tab baru), muat ulang dari sana. sessionStorage
// hanya jalan pintas agar perpindahan halaman terasa instan.
async function hydrate() {
  const id = route.params.id || draft.value?.document?.id
  if (!id) { router.replace('/analisis'); return }
  if (draft.value?.document?.id === id) { loading.value = false; return }
  try {
    const fresh = await documents.get(id)
    draft.value = fresh
    documents.setCurrent(fresh)
  } catch (e) {
    loadError.value = e.message || 'Hasil tidak bisa dimuat.'
  } finally {
    loading.value = false
  }
}
onMounted(async () => {
  await hydrate()
  // Premium: laporan langsung diperbaiki otomatis setelah analisis, sesuai
  // alur "tempel laporan -> teks diperbaiki -> unduh".
  if (isPremium.value && doc.value && !hasFix.value) autoFix()
})

const filter = ref(null)
const selected = ref(null)
const notice = ref('')
const error = ref('')
const busy = ref(false)

const doc = computed(() => draft.value?.document)
const analysis = computed(() => draft.value?.analysis)
const stats = computed(() => analysis.value?.stats || {})
const issues = computed(() => draft.value?.issues || [])
const statusOf = (i) => i.decision || 'active'
const pending = computed(() => issues.value.filter((i) => statusOf(i) === 'active' && (!filter.value || canon(i.category || i.type) === filter.value)))
const decided = computed(() => issues.value.filter((i) => statusOf(i) !== 'active'))
const revised = computed(() => doc.value?.revised_text || draft.value?.revised_text || doc.value?.original_text || '')
const summary = computed(() => {
  const map = new Map()
  for (const i of issues.value) {
    const k = canon(i.category || i.type)
    map.set(k, (map.get(k) || 0) + 1)
  }
  return [...map.entries()].map(([type, count]) => ({ type, count }))
})
const scores = computed(() => stats.value.scores || {})
const isPremium = computed(() => Boolean(draft.value?.meta?.is_premium ?? auth.user?.is_premium))
const hasFix = computed(() => Boolean(revised.value) && revised.value !== (doc.value?.original_text || ''))
const scoresList = computed(() => ['similarity', 'ai_usage']
  .map((key) => ({ key, ...(scores.value[key] || {}) }))
  .filter((m) => Number.isFinite(m.percent)))

function say(msg) { notice.value = msg; clearTimeout(say.t); say.t = setTimeout(() => (notice.value = ''), 2600) }
function fail(msg) { error.value = msg; clearTimeout(fail.t); fail.t = setTimeout(() => (error.value = ''), 6000) }
function sync(d) { draft.value = d; documents.setCurrent(d) }

function pick(id) {
  selected.value = id
  document.getElementById('s-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

async function sendDecision(body, okMsg) {
  busy.value = true
  try {
    const res = await documents.decide(doc.value.id, body)
    sync({ ...draft.value, issues: res.issues, revised_text: res.revised_text, document: { ...doc.value, revised_text: res.revised_text } })
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
  if (issue.needs_manual_review && !confirm('Saran ini ditandai PERLU CEK MANUAL karena berisiko mengubah makna. Terapkan tetap?')) return
  sendDecision({ decisions: [{ id: issue.id, decision: 'applied', confirm_manual: true }] }, 'Saran diterapkan.')
}
function reject(issue) {
  sendDecision({ decisions: [{ id: issue.id, decision: 'rejected' }] }, 'Saran ditolak.')
}
function acceptAll() {
  if (!confirm('Terapkan semua saran yang aman sekaligus? Saran yang perlu cek manual dilewati.')) return
  sendDecision({ accept_all: true }, 'Semua saran aman diterapkan.')
}

// Perbaikan otomatis: menerapkan semua saran yang lolos validasi. Saran yang
// ditandai perlu cek manual tetap dilewati agar makna tulisan tidak berubah.
const fixing = ref(false)
async function autoFix(manual = false) {
  if (!isPremium.value || fixing.value || busy.value) return
  if (!issues.value.some((i) => statusOf(i) === 'active' && !i.needs_manual_review)) {
    if (manual) fail('Tidak ada saran yang bisa diterapkan otomatis.')
    return
  }
  fixing.value = true
  try {
    const res = await documents.decide(doc.value.id, { accept_all: true })
    sync({
      ...draft.value,
      issues: res.issues,
      revised_text: res.revised_text,
      document: { ...doc.value, revised_text: res.revised_text, status: res.document?.status || doc.value.status },
    })
    if (manual) say('Semua saran aman diterapkan. Laporan siap diunduh.')
  } catch (e) {
    if (e.status === 403) fail('Perbaikan otomatis khusus Premium. Buka halaman Premium untuk mengaktifkannya.')
    else fail(e.message || 'Gagal menerapkan saran.')
  } finally {
    fixing.value = false
  }
}
async function restore() {
  if (!confirm('Pulihkan teks asli dan ubah semua keputusan menjadi aktif lagi?')) return
  busy.value = true
  try {
    const res = await documents.restore(doc.value.id)
    const fresh = await documents.get(doc.value.id)
    sync({ document: fresh.document, analysis: fresh.analysis, issues: fresh.issues, revised_text: res.revised_text, meta: draft.value.meta })
    say('Teks asli dipulihkan.')
  } catch (e) { fail(e.message) } finally { busy.value = false }
}
async function download(format) {
  if (!hasFix.value) { fail('Belum ada teks perbaikan untuk diunduh. Terapkan saran dulu.'); return }
  try {
    await documents.download(doc.value.id, format, `${doc.value.title}-revisi.${format}`)
    say(`Laporan perbaikan (.${format}) terunduh.`)
  } catch (e) { fail(e.message) }
}
</script>

<template>
  <section v-if="loading" class="mx-auto max-w-6xl px-4 py-24 sm:px-6 text-center font-mono text-sm uppercase tracking-widest">
    <i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Memuat hasil...
  </section>

  <section v-else-if="!draft || !doc" class="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
    <p class="font-black uppercase tracking-tight">Hasil tidak ditemukan.</p>
    <p class="mt-2 text-sm text-black/60">{{ loadError || 'Dokumen mungkin sudah dihapus atau kedaluwarsa setelah 30 hari.' }}</p>
    <div class="mt-8 flex justify-center gap-2">
      <BaseButton to="/riwayat">Buka riwayat</BaseButton>
      <BaseButton variant="secondary" to="/analisis">Analisis baru</BaseButton>
    </div>
  </section>

  <section v-else class="mx-auto max-w-6xl px-4 py-10 sm:px-6">
    <SectionLabel>Hasil analisis</SectionLabel>
    <div class="mb-8 mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 class="max-w-3xl text-4xl font-black uppercase leading-[0.95] tracking-tighter md:text-6xl">{{ doc.title }}</h1>
        <p class="mt-3 font-mono text-xs uppercase tracking-widest text-black/60">{{ stats.word_count }} kata · {{ stats.sentence_count }} kalimat · {{ issues.length }} temuan</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <BaseButton variant="secondary" size="sm" to="/analisis"><i class="fa-solid fa-arrow-left"></i>Ganti teks</BaseButton>
        <BaseButton variant="secondary" size="sm" :to="`/bandingkan/${doc.id}`"><i class="fa-solid fa-code-compare"></i>Bandingkan</BaseButton>
        <BaseButton variant="secondary" size="sm" :disabled="!hasFix" @click="download('pdf')"><i class="fa-solid fa-file-pdf"></i>.pdf</BaseButton>
        <BaseButton variant="secondary" size="sm" :disabled="!hasFix" @click="download('txt')"><i class="fa-solid fa-download"></i>.txt</BaseButton>
        <BaseButton variant="secondary" size="sm" :disabled="!hasFix" @click="download('docx')"><i class="fa-solid fa-file-word"></i>.docx</BaseButton>
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

    <!-- Editor kiri + panel hasil kanan (desktop); susunan vertikal di layar sempit -->
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
          <div v-if="scoresList.length" class="mt-4 border-t-2 border-black pt-4">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]">Similarity &amp; penggunaan AI</p>
            </div>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <div v-for="m in scoresList" :key="m.key" class="border-2 border-black bg-black p-3 text-white">
                <div class="flex items-end justify-between gap-2">
                  <p class="font-mono text-[11px] uppercase tracking-widest text-white/70">{{ m.label }}</p>
                  <p class="text-3xl font-black tabular-nums text-white">{{ m.percent }}<span class="text-base">%</span></p>
                </div>
                <div class="mt-3 h-3 w-full border-2 border-white bg-white">
                  <div class="h-full bg-[#FF3000] transition-[width] duration-500" :style="{ width: m.percent + '%' }"></div>
                </div>
                <div class="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-widest text-white/50"><span>0%</span><span>100%</span></div>
                <div class="mt-3 space-y-2">
                  <div v-for="s in m.signals" :key="s.key">
                    <div class="flex justify-between font-mono text-[10px] uppercase tracking-widest text-white/70"><span>{{ s.label }}</span><span class="tabular-nums text-white">{{ s.percent }}%</span></div>
                    <div class="mt-1 h-1.5 w-full bg-white/20"><div class="h-full bg-[#FF3000]" :style="{ width: s.percent + '%' }"></div></div>
                  </div>
                </div>
                <p class="mt-3 text-xs leading-relaxed text-white/70">{{ m.note }}</p>
              </div>
            </div>
          </div>
          <div v-if="stats.top_words?.length" class="mt-4 border-t-2 border-black pt-4">
            <p class="mb-2 font-mono text-xs uppercase tracking-widest text-[#FF3000]">Kata tersering</p>
            <div class="flex flex-wrap gap-2">
              <span v-for="w in stats.top_words.slice(0, 8)" :key="w.word" class="border-2 border-black px-2 py-1 font-mono text-xs">{{ w.word }} ×{{ w.count }}</span>
            </div>
          </div>
          <div v-if="summary.length" class="mt-6 border-t-2 border-black pt-6"><CategorySummary :summary="summary" :active="filter" @select="filter = $event" /></div>
        </BaseCard>

        <BaseCard class="p-6 sm:p-8">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]">Laporan hasil perbaikan</p>
            <div class="flex flex-wrap gap-2">
              <BaseButton size="sm" :disabled="!hasFix || fixing" @click="download('pdf')"><i class="fa-solid fa-file-pdf"></i>Unduh PDF</BaseButton>
              <BaseButton variant="secondary" size="sm" :disabled="!hasFix || fixing" @click="download('txt')"><i class="fa-solid fa-download"></i>TXT</BaseButton>
              <BaseButton variant="secondary" size="sm" :disabled="!hasFix || fixing" @click="download('docx')"><i class="fa-solid fa-file-word"></i>DOCX</BaseButton>
            </div>
          </div>

          <p v-if="fixing" class="mt-4 border-2 border-black bg-[#F2F2F2] px-4 py-3 font-mono text-xs uppercase tracking-widest text-black/60">
            <i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Menerapkan saran perbaikan...
          </p>
          <pre v-else-if="hasFix" class="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap border-2 border-black bg-[#F2F2F2] p-4 text-[15px] leading-7">{{ revised }}</pre>
          <div v-else class="mt-4 border-2 border-dashed border-black p-4 text-sm leading-relaxed">
            <template v-if="!isPremium">
              Teks yang sudah diperbaiki terbuka di Premium — termasuk unduhan PDF, DOCX, dan TXT.
              <router-link to="/premium" class="ml-1 font-bold uppercase tracking-wide underline decoration-[#FF3000] decoration-2 underline-offset-4">Buka Premium</router-link>
            </template>
            <template v-else>
              Belum ada saran yang diterapkan.
              <button class="font-bold uppercase tracking-wide underline decoration-[#FF3000] decoration-2 underline-offset-4" @click="autoFix(true)">Perbaiki otomatis sekarang</button>
            </template>
          </div>
        </BaseCard>

        <BaseCard class="p-6 sm:p-8">
          <p class="mb-4 font-mono text-xs uppercase tracking-widest text-[#FF3000]">Teks dengan sorotan masalah</p>
          <HighlightedText :text="doc.original_text" :issues="issues" :selected="selected" @pick="pick" />
          <p class="mt-4 border-t-2 border-black/10 pt-3 font-mono text-[11px] uppercase tracking-widest text-black/50">Klik sorotan untuk melihat saran di panel kanan.</p>
        </BaseCard>
      </div>

      <aside class="lg:sticky lg:top-24 lg:self-start">
        <BaseCard>
          <div class="flex items-center justify-between border-b-2 border-black px-4 py-3">
            <h2 class="font-black uppercase tracking-tight">Saran perbaikan</h2>
            <button v-if="pending.length && auth.user?.is_premium" :disabled="busy" class="font-mono text-xs font-bold uppercase tracking-widest text-[#FF3000] hover:underline disabled:opacity-50" @click="acceptAll">Terapkan semua</button>
          </div>
          <div class="max-h-[70vh] space-y-3 overflow-y-auto p-4">
            <div v-for="i in pending" :id="'s-' + i.id" :key="i.id">
              <SuggestionCard :issue="i" :selected="selected === i.id" :busy="busy" @pick="selected = $event" @accept="accept" @reject="reject" />
            </div>
            <div v-if="!pending.length" class="border-2 border-black bg-[#F2F2F2] py-10 text-center text-sm font-bold uppercase tracking-wide">
              <i class="fa-regular fa-circle-check mb-2 block text-2xl"></i>{{ issues.length ? 'Semua saran sudah diputuskan.' : 'Tidak ada masalah yang terbukti pada teks ini.' }}
            </div>
          </div>
        </BaseCard>

        <BaseCard v-if="decided.length" class="mt-6">
          <p class="border-b-2 border-black px-4 py-3 font-black uppercase tracking-tight">Sudah diputuskan</p>
          <ul class="divide-y-2 divide-black/10">
            <li v-for="i in decided" :key="i.id" class="flex items-start gap-3 px-4 py-3 text-sm">
              <span class="mt-0.5 h-3 w-3 shrink-0 border-2 border-black" :style="{ background: CATEGORIES[canon(i.category || i.type)].color }"></span>
              <span class="min-w-0 flex-1"><span class="font-mono text-xs">"{{ i.snippet }}"</span></span>
              <span :class="['shrink-0 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest', statusOf(i) === 'applied' ? 'bg-black text-white' : 'border-2 border-black text-black/60']">{{ statusOf(i) === 'applied' ? 'Diterapkan' : 'Ditolak' }}</span>
            </li>
          </ul>
        </BaseCard>
        <BaseModal :open="busy" title="Menyimpan..."><p class="text-sm">Keputusanmu sedang disimpan ke server.</p></BaseModal>
      </aside>
    </div>
  </section>
</template>