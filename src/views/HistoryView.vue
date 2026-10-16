<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import BaseModal from '../components/BaseModal.vue'
import SectionLabel from '../components/SectionLabel.vue'
import { documents } from '../store/documents'

const router = useRouter()
const docs = ref([])
const q = ref('')
const loading = ref(true)
const error = ref('')
const target = ref(null)
const selected = ref(new Set())
const notice = ref('')
const confirmMulti = ref(false)

const filtered = computed(() => docs.value)
const fmt = (t) => t ? new Date(t).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { documents: list } = await documents.list(q.value.trim())
    docs.value = list || []
  } catch (e) { error.value = e.message || 'Gagal memuat riwayat.' }
  finally { loading.value = false }
}
let deb
function onSearch() { clearTimeout(deb); deb = setTimeout(load, 350) }

function say(msg) { notice.value = msg; clearTimeout(say.t); say.t = setTimeout(() => (notice.value = ''), 2600) }
function open(id) { router.push({ name: 'document-detail', params: { id } }) }
function toggle(id) {
  const s = new Set(selected.value)
  s.has(id) ? s.delete(id) : s.add(id)
  selected.value = s
}
function toggleAll() {
  selected.value = selected.value.size === filtered.value.length ? new Set() : new Set(filtered.value.map((d) => d.id))
}
async function removeIds(ids) {
  try {
    await documents.removeMany(ids)
    say(ids.length > 1 ? `${ids.length} dokumen dihapus.` : 'Dokumen dihapus.')
    selected.value = new Set()
    target.value = null
    confirmMulti.value = false
    await load()
  } catch (e) { error.value = e.message }
}
onMounted(load)
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 py-12 sm:px-6">
    <div class="grid gap-8 md:grid-cols-[5fr_7fr] md:items-end">
      <div>
        <SectionLabel>Riwayat</SectionLabel>
        <h1 class="mt-4 text-5xl font-black uppercase leading-[0.9] tracking-tighter md:text-6xl">Yang pernah diperiksa</h1>
      </div>
      <div class="relative">
        <i class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-sm"></i>
        <input v-model="q" @input="onSearch" placeholder="CARI JUDUL…" class="h-12 w-full border-2 border-black bg-white pl-11 pr-3 text-sm font-bold uppercase tracking-wide placeholder:text-black/30 focus:border-[#FF3000] focus:outline-none" />
      </div>
    </div>

    <p v-if="notice" class="mt-6 flex items-center gap-3 border-2 border-black bg-black px-4 py-3 text-sm font-bold uppercase tracking-wide text-white">
      <span class="flex h-6 w-6 items-center justify-center bg-[#FF3000]"><i class="fa-solid fa-check text-xs"></i></span>{{ notice }}
    </p>
    <p v-if="error" class="mt-6 border-2 border-black bg-black px-4 py-3 text-sm font-bold uppercase tracking-wide text-white"><span class="text-[#FF3000]">■</span> {{ error }}</p>

    <div v-if="loading" class="mt-8 border-4 border-black bg-[#F2F2F2] p-10 text-center font-mono text-sm uppercase tracking-widest"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Memuat riwayat…</div>

    <template v-else>
      <div v-if="filtered.length" class="mt-8">
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <button class="border-2 border-black px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white" @click="toggleAll">{{ selected.size === filtered.length ? 'Batal pilih semua' : 'Pilih semua' }}</button>
          <button v-if="selected.size" class="border-2 border-[#FF3000] bg-[#FF3000] px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-widest text-white hover:bg-black hover:border-black" @click="confirmMulti = true">Hapus {{ selected.size }} terpilih</button>
        </div>
        <div class="border-t-4 border-black">
          <div class="hidden grid-cols-[40px_1fr_140px] gap-4 border-b-2 border-black py-2 font-mono text-[11px] uppercase tracking-widest text-black/50 sm:grid">
            <span></span><span>Dokumen</span><span class="text-right">Aksi</span>
          </div>
          <div class="flex flex-col gap-4 py-6">
            <div v-for="d in filtered" :key="d.id" class="flex flex-col gap-4 border-2 border-black bg-white p-5 hover:bg-[#F2F2F2] sm:flex-row sm:items-center">
              <input type="checkbox" :checked="selected.has(d.id)" @change="toggle(d.id)" class="h-5 w-5 accent-[#FF3000]" :aria-label="'Pilih ' + d.title" />
              <div class="min-w-0 flex-1">
                <h3 class="truncate font-black uppercase tracking-tight">{{ d.title }}</h3>
                <p class="mt-1 font-mono text-[11px] uppercase tracking-widest opacity-60">{{ fmt(d.updated_at) }} · {{ d.pending_count }} menunggu · kedaluwarsa {{ fmt(d.expires_at) }}</p>
              </div>
              <div class="flex gap-2">
                <button class="min-h-[44px] border-2 border-black bg-black px-4 py-2 text-xs font-bold uppercase tracking-widest text-white hover:bg-[#FF3000] hover:border-[#FF3000]" @click="open(d.id)"><i class="fa-solid fa-arrow-up-right-from-square mr-1.5"></i>Buka</button>
                <button class="flex min-h-[44px] min-w-[44px] items-center justify-center border-2 border-black px-3 py-2 text-sm hover:bg-[#FF3000] hover:border-[#FF3000] hover:text-white" aria-label="Hapus" @click="target = d"><i class="fa-regular fa-trash-can"></i></button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="mt-8 flex flex-col items-center border-4 border-black bg-[#F2F2F2] px-6 py-16 text-center">
        <span class="mb-6 flex h-20 w-20 items-center justify-center border-2 border-black bg-white"><i class="fa-regular fa-folder-open text-3xl"></i></span>
        <p class="font-black uppercase tracking-tight">{{ q ? 'Tidak ada dokumen yang cocok.' : 'Belum ada dokumen yang diperiksa.' }}</p>
        <p class="mb-6 mt-1 text-sm text-black/60">Setelah dianalisis, dokumen tersimpan otomatis di server selama 30 hari.</p>
        <BaseButton to="/analisis">Cek tulisan</BaseButton>
      </div>
    </template>

    <BaseModal :open="!!target" title="Hapus ini?" @close="target = null">
      <p class="border-l-4 border-[#FF3000] bg-[#F2F2F2] p-4 text-sm">“{{ target?.title }}” akan dihapus permanen dan tidak bisa dipulihkan.</p>
      <div class="mt-6 flex justify-end gap-2">
        <BaseButton variant="secondary" size="sm" @click="target = null">Batal</BaseButton>
        <BaseButton variant="accent" size="sm" @click="removeIds([target.id])">Hapus</BaseButton>
      </div>
    </BaseModal>

    <BaseModal :open="confirmMulti" title="Hapus yang dipilih?" @close="confirmMulti = false">
      <p class="border-l-4 border-[#FF3000] bg-[#F2F2F2] p-4 text-sm">{{ selected.size }} dokumen akan dihapus permanen.</p>
      <div class="mt-6 flex justify-end gap-2">
        <BaseButton variant="secondary" size="sm" @click="confirmMulti = false">Batal</BaseButton>
        <BaseButton variant="accent" size="sm" @click="removeIds([...selected])">Hapus semua</BaseButton>
      </div>
    </BaseModal>
  </section>
</template>
