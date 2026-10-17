<script setup>
import { ref, onMounted } from 'vue'
import BaseButton from '../components/BaseButton.vue'
import BaseCard from '../components/BaseCard.vue'
import SectionLabel from '../components/SectionLabel.vue'
import { documents } from '../store/documents'

const props = defineProps({ id: String })
const data = ref(null)
const loading = ref(true)
const error = ref('')
const renamed = ref('')
const notice = ref('')

async function load(id) {
  loading.value = true
  error.value = ''
  try {
    data.value = await documents.get(id)
    renamed.value = data.value.document.title
  } catch (e) { error.value = e.message || 'Dokumen tidak ditemukan.' }
  finally { loading.value = false }
}
async function saveTitle() {
  const next = renamed.value.trim()
  if (!next || next === data.value.document.title) return
  try {
    const r = await documents.rename(data.value.document.id, next)
    data.value.document.title = r.title
    renamed.value = r.title
    notice.value = 'Judul diperbarui.'
    clearTimeout(saveTitle.t); saveTitle.t = setTimeout(() => (notice.value = ''), 2600)
  } catch (e) { error.value = e.message }
}
async function download(format) {
  try { await documents.download(data.value.document.id, format, `${data.value.document.title}-revisi.${format}`) }
  catch (e) { error.value = e.message }
}
onMounted(() => load(props.id || window.location.hash.match(/\/dokumen\/([^/?]+)/)?.[1]))
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 py-12 sm:px-6">
    <SectionLabel>Detail dokumen</SectionLabel>
    <div v-if="loading" class="mt-8 border-4 border-black bg-[#F2F2F2] p-10 text-center font-mono text-sm uppercase tracking-widest"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Memuat...</div>
    <div v-else-if="data">
      <h1 class="mt-4 max-w-3xl text-4xl font-black uppercase leading-[0.95] tracking-tighter md:text-6xl">{{ data.document.title }}</h1>
      <p class="mt-3 font-mono text-xs uppercase tracking-widest text-black/60">
        {{ data.document.word_count }} kata · {{ data.issues.length }} temuan · revisi {{ new Date(data.document.updated_at).toLocaleString('id-ID') }}
      </p>
      <p v-if="notice" class="mt-4 border-2 border-black bg-black px-4 py-2 text-sm font-bold uppercase tracking-wide text-white"><span class="text-[#FF3000]">■</span> {{ notice }}</p>
      <p v-if="error" class="mt-4 border-2 border-black bg-black px-4 py-2 text-sm font-bold uppercase tracking-wide text-white"><span class="text-[#FF3000]">■</span> {{ error }}</p>
      <div class="mt-6 flex flex-wrap items-center gap-2">
        <input v-model="renamed" @keyup.enter="saveTitle" class="h-11 min-w-0 flex-1 border-2 border-black px-3 text-sm font-bold uppercase tracking-wide sm:min-w-[220px]" aria-label="Judul dokumen" />
        <BaseButton size="sm" variant="secondary" @click="saveTitle">Ganti judul</BaseButton>
        <BaseButton size="sm" :to="`/hasil/${data.document.id}`">Buka hasil lengkap <i class="fa-solid fa-arrow-right text-xs"></i></BaseButton>
        <BaseButton size="sm" variant="secondary" :to="`/bandingkan/${data.document.id}`">Bandingkan</BaseButton>
        <BaseButton size="sm" variant="secondary" @click="download('txt')">Unduh .txt</BaseButton>
        <BaseButton size="sm" variant="secondary" @click="download('docx')">Unduh .docx</BaseButton>
        <BaseButton variant="secondary" size="sm" to="/riwayat">Kembali</BaseButton>
      </div>

      <div class="mt-8 grid gap-6 md:grid-cols-2">
        <BaseCard>
          <div class="border-b-2 border-black bg-[#F2F2F2] px-6 py-3">
            <span class="font-mono text-xs font-bold uppercase tracking-widest text-[#FF3000]">Teks asli</span>
          </div>
          <p class="max-h-[320px] overflow-y-auto whitespace-pre-wrap p-6 text-[15px] leading-8 text-black/70">{{ data.document.original_text }}</p>
        </BaseCard>
        <BaseCard class="!border-[#FF3000]">
          <div class="border-b-2 border-[#FF3000] bg-[#FF3000] px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-white">
            <span>Hasil revisi terakhir</span>
          </div>
          <p class="max-h-[320px] overflow-y-auto whitespace-pre-wrap p-6 text-[15px] leading-8 font-medium">{{ data.document.revised_text }}</p>
        </BaseCard>
      </div>
    </div>

    <div v-else class="mt-8 border-4 border-black bg-[#F2F2F2] p-10 text-center">
      <p class="font-black uppercase tracking-tight">Dokumen tidak ditemukan.</p>
      <p class="mt-1 text-sm text-black/60">{{ error || 'Kemungkinan sudah dihapus, kedaluwarsa setelah 30 hari, atau bukan milik akunmu.' }}</p>
      <BaseButton to="/riwayat" class="mt-6">Balik ke riwayat</BaseButton>
    </div>
  </section>
</template>