<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import BaseCard from '../components/BaseCard.vue'
import SectionLabel from '../components/SectionLabel.vue'
import { documents } from '../store/documents'

const route = useRoute()
const router = useRouter()
const draft = ref(documents.getCurrent())
const error = ref('')

const original = computed(() => draft.value?.document?.original_text || '')
const revised = computed(() => draft.value?.document?.revised_text || draft.value?.revised_text || '')
const changed = computed(() => original.value !== revised.value)

async function copy() {
  try { await navigator.clipboard.writeText(revised.value); error.value = '' } catch { error.value = 'Gagal menyalin ke clipboard.' }
}

onMounted(async () => {
  const id = route.params.id
  if (!id) {
    if (!draft.value) router.replace('/analisis')
    return
  }
  try {
    draft.value = await documents.get(id)
  } catch (e) {
    error.value = e.message || 'Dokumen tidak ditemukan.'
  }
})
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 py-12 sm:px-6">
    <SectionLabel>Perbandingan</SectionLabel>
    <div class="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 class="text-4xl font-black uppercase leading-[0.95] tracking-tighter md:text-6xl">Teks asli vs revisi</h1>
        <p v-if="draft?.document" class="mt-3 font-mono text-xs uppercase tracking-widest text-black/60">{{ draft.document.title }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <BaseButton variant="secondary" size="sm" :to="draft?.document ? `/hasil/${draft.document.id}` : '/riwayat'"><i class="fa-solid fa-arrow-left"></i>Kembali ke hasil</BaseButton>
        <BaseButton variant="secondary" size="sm" @click="copy"><i class="fa-regular fa-copy"></i>Salin revisi</BaseButton>
      </div>
    </div>

    <p v-if="error" class="mt-6 border-2 border-black bg-black px-4 py-3 text-sm font-bold uppercase tracking-wide text-white"><span class="text-[#FF3000]">■</span> {{ error }}</p>
    <p v-if="draft?.document && !changed" class="mt-6 border-2 border-black bg-[#F2F2F2] px-4 py-3 text-sm font-bold uppercase tracking-wide">Belum ada saran yang diterapkan, jadi teks revisi masih sama dengan teks asli.</p>

    <div v-if="draft?.document" class="mt-8 grid gap-6 md:grid-cols-2">
      <BaseCard>
        <div class="border-b-2 border-black bg-[#F2F2F2] px-6 py-3">
          <span class="font-mono text-xs font-bold uppercase tracking-widest">Teks asli</span>
        </div>
        <p class="max-h-[70vh] overflow-y-auto whitespace-pre-wrap p-6 text-[15px] leading-8 text-black/70">{{ original }}</p>
      </BaseCard>
      <BaseCard class="!border-[#FF3000]">
        <div class="border-b-2 border-[#FF3000] bg-[#FF3000] px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-white">
          <span>Teks revisi</span>
        </div>
        <p class="max-h-[70vh] overflow-y-auto whitespace-pre-wrap p-6 text-[15px] leading-8 font-medium">{{ revised }}</p>
      </BaseCard>
    </div>
  </section>
</template>
