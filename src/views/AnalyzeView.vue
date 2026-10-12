<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import BaseCard from '../components/BaseCard.vue'
import SectionLabel from '../components/SectionLabel.vue'
import { analyze } from '../utils/analyzer'
import { documents } from '../store/documents'

const SAMPLE = `Menulis adalah hal yang sangat penting bagi pelajar. Menulis membantu kita berpikir dengan runtut. Selain itu, menulis juga sangat penting untuk karier. Selain itu, banyak orang gak sadar kalau tulisan mereka terasa kaku banget. Saya sering menulis setiap hari, dan aku merasa kemampuan menulis sangat penting untuk masa depan, karena dengan menulis kita bisa menyampaikan gagasan, membangun argumen yang kuat, serta meyakinkan pembaca bahwa ide yang kita sampaikan memang layak untuk dipertimbangkan secara serius oleh banyak pihak.`

const title = ref('')
const text = ref('')
const loading = ref(false)
const error = ref('')
const router = useRouter()
const words = computed(() => (text.value.trim() ? text.value.trim().split(/\s+/).length : 0))
const MAX = 5000

function run() {
  error.value = ''
  if (words.value < 20) return (error.value = 'Tulisannya kurang panjang, minimal 20 kata ya.')
  if (words.value > MAX) return (error.value = `Kepanjangan, maksimal ${MAX} kata aja.`)
  loading.value = true
  setTimeout(() => {
    const result = analyze(text.value)
    documents.setCurrent({ id: 'd' + Date.now(), title: title.value.trim() || 'Dokumen tanpa judul', original_text: text.value, result })
    loading.value = false
    router.push('/hasil')
  }, 900)
}
function onFile(e) {
  const f = e.target.files[0]; if (!f) return
  if (!f.name.endsWith('.txt')) return (error.value = 'File-nya harus .txt ya, yang lain belum bisa.')
  f.text().then((t) => { text.value = t; title.value ||= f.name.replace(/\.txt$/, '') })
}
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 py-12 sm:px-6">
    <div class="grid gap-8 md:grid-cols-[5fr_7fr]">
      <div>
        <SectionLabel>Analisis baru</SectionLabel>
        <h1 class="mt-4 text-5xl font-black uppercase leading-[0.9] tracking-tighter md:text-6xl">Tempel tulisanmu di sini</h1>
        <p class="mt-4 text-black/70">Copy-paste aja teksnya, atau upload file .txt kalau udah ada. Mau nyoba dulu? Pencet tombol contoh.</p>
        <div class="swiss-dots mt-8 border-2 border-black bg-[#F2F2F2] p-6">
          <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]">Syaratnya</p>
          <ul class="mt-3 space-y-2 text-sm font-bold uppercase tracking-wide">
            <li class="flex gap-2"><span class="text-[#FF3000]">■</span> Paling dikit 20 kata</li>
            <li class="flex gap-2"><span class="text-[#FF3000]">■</span> Paling banyak 5.000 kata</li>
            <li class="flex gap-2"><span class="text-[#FF3000]">■</span> File .txt doang yang bisa diupload</li>
          </ul>
        </div>
      </div>

      <BaseCard class="flex flex-col">
        <div class="border-b-2 border-black p-4 sm:p-6">
          <input v-model="title" placeholder="KASIH JUDUL DI SINI" class="w-full bg-transparent text-xl font-black uppercase tracking-tight placeholder:text-black/30 focus:outline-none" />
        </div>
        <textarea v-model="text" rows="14" placeholder="Tulis atau tempel teks kamu di sini…"
          class="w-full flex-1 resize-y bg-transparent p-4 text-[15px] leading-7 focus:outline-none sm:p-6"></textarea>
        <div class="flex flex-col gap-3 border-t-2 border-black p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div class="flex flex-wrap items-center gap-2">
            <label class="swiss-snap-fast min-h-[44px] cursor-pointer border-2 border-black bg-white px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white">
              <i class="fa-solid fa-file-arrow-up mr-1.5"></i>Upload .txt<input type="file" accept=".txt" class="hidden" @change="onFile" />
            </label>
            <button class="swiss-snap-fast min-h-[44px] border-2 border-black bg-white px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white" @click="text = SAMPLE; title ||= 'Contoh esai'"><i class="fa-solid fa-flask mr-1.5"></i>Coba contoh</button>
            <button v-if="text" class="min-h-[44px] px-3 py-2 text-xs font-bold uppercase tracking-widest text-black/60 hover:text-[#FF3000]" @click="text = ''">Hapus semua</button>
          </div>
          <div class="flex items-center gap-4">
            <span :class="['font-mono text-xs font-bold', words > MAX ? 'bg-[#FF3000] px-2 py-1 text-white' : '']">{{ words }} / {{ MAX }} kata</span>
            <BaseButton :disabled="loading" @click="run">
              <i :class="['fa-solid', loading ? 'fa-circle-notch fa-spin' : 'fa-wand-magic-sparkles']"></i>
              {{ loading ? 'Lagi dicek…' : 'Cek tulisan' }}
            </BaseButton>
          </div>
        </div>
        <p v-if="error" class="border-t-2 border-black bg-black px-4 py-3 text-sm font-bold uppercase tracking-wide text-white sm:px-6"><i class="fa-solid fa-circle-exclamation mr-2 text-[#FF3000]"></i>{{ error }}</p>
      </BaseCard>
    </div>
  </section>
</template>
