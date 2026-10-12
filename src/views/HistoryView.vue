<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import HistoryItem from '../components/HistoryItem.vue'
import BaseModal from '../components/BaseModal.vue'
import BaseButton from '../components/BaseButton.vue'
import SectionLabel from '../components/SectionLabel.vue'
import { documents } from '../store/documents'

const router = useRouter()
const docs = ref(documents.list())
const q = ref('')
const target = ref(null)
const notice = ref('')
const filtered = computed(() => docs.value.filter((d) => d.title.toLowerCase().includes(q.value.toLowerCase())))

function say(msg) { notice.value = msg; clearTimeout(say.t); say.t = setTimeout(() => (notice.value = ''), 2600) }
function open(doc) { router.push({ name: 'document-detail', params: { id: doc.id } }) }
function confirmRemove() { documents.remove(target.value.id); docs.value = documents.list(); target.value = null; say('Udah dihapus.') }
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 py-12 sm:px-6">
    <div class="grid gap-8 md:grid-cols-[5fr_7fr] md:items-end">
      <div>
        <SectionLabel>Riwayat</SectionLabel>
        <h1 class="mt-4 text-5xl font-black uppercase leading-[0.9] tracking-tighter md:text-6xl">Yang pernah dicek</h1>
      </div>
      <div class="relative">
        <i class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-sm"></i>
        <input v-model="q" placeholder="CARI JUDUL…" class="h-12 w-full border-2 border-black bg-white pl-11 pr-3 text-sm font-bold uppercase tracking-wide placeholder:text-black/30 focus:border-[#FF3000] focus:outline-none" />
      </div>
    </div>

    <p v-if="notice" class="mt-6 flex items-center gap-3 border-2 border-black bg-black px-4 py-3 text-sm font-bold uppercase tracking-wide text-white">
      <span class="flex h-6 w-6 items-center justify-center bg-[#FF3000]"><i class="fa-solid fa-check text-xs"></i></span>{{ notice }}
    </p>

    <div v-if="filtered.length" class="mt-8 border-t-4 border-black">
      <div class="hidden grid-cols-[1fr_140px] gap-4 border-b-2 border-black py-2 font-mono text-[11px] uppercase tracking-widest text-black/50 sm:grid">
        <span>Dokumen</span><span class="text-right">Aksi</span>
      </div>
      <div class="flex flex-col gap-4 py-6">
        <HistoryItem v-for="d in filtered" :key="d.id" :doc="d" @open="open" @remove="target = $event" />
      </div>
    </div>
    <div v-else class="mt-8 flex flex-col items-center border-4 border-black bg-[#F2F2F2] px-6 py-16 text-center">
      <span class="mb-6 flex h-20 w-20 items-center justify-center border-2 border-black bg-white"><i class="fa-regular fa-folder-open text-3xl"></i></span>
      <p class="font-black uppercase tracking-tight">{{ q ? 'Nggak ketemu yang cocok.' : 'Belum ada yang dicek.' }}</p>
      <p class="mb-6 mt-1 text-sm text-black/60">Abis analisis terus disimpen, nanti munculnya di sini.</p>
      <BaseButton to="/analisis">Cek tulisan</BaseButton>
    </div>

    <BaseModal :open="!!target" title="Hapus ini?" @close="target = null">
      <p class="border-l-4 border-[#FF3000] bg-[#F2F2F2] p-4 text-sm">“{{ target?.title }}” bakal ilang permanen, nggak bisa dibalikin.</p>
      <div class="mt-6 flex justify-end gap-2">
        <BaseButton variant="secondary" size="sm" @click="target = null">Gajadi</BaseButton>
        <BaseButton variant="accent" size="sm" @click="confirmRemove">Hapus aja</BaseButton>
      </div>
    </BaseModal>
  </section>
</template>
