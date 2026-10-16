<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import BaseCard from '../components/BaseCard.vue'
import SectionLabel from '../components/SectionLabel.vue'
import { api } from '../utils/api'
import { auth } from '../store/auth'
import { documents } from '../store/documents'
import { FREE_WORD_LIMIT, PREMIUM_WORD_LIMIT } from '../utils/categories'

const SAMPLE = `Menulis adalah hal yang sangat penting bagi pelajar. Menulis membantu kita berpikir dengan runtut. Selain itu, menulis juga sangat penting untuk karier. Selain itu, banyak orang tidak sadar kalau tulisan mereka terasa kaku. Saya sering menulis setiap hari, dan saya merasa kemampuan menulis sangat penting untuk masa depan, karena dengan menulis kita bisa menyampaikan gagasan, membangun argumen yang kuat, serta meyakinkan pembaca bahwa ide yang kita sampaikan memang layak untuk dipertimbangkan secara serius oleh banyak pihak.`

const title = ref('')
const text = ref('')
const file = ref(null)
const loading = ref(false)
const error = ref('')
const elapsed = ref(0)
const router = useRouter()

const words = computed(() => (text.value.trim() ? text.value.trim().split(/\s+/).length : 0))
const limit = computed(() => (auth.user?.is_premium ? PREMIUM_WORD_LIMIT : FREE_WORD_LIMIT))

async function run() {
  error.value = ''
  if (words.value < 20 && !file.value) { error.value = 'Tulisan terlalu pendek. Minimal 20 kata.'; return }
  if (words.value > limit.value) { error.value = `Melebihi batas akun ${auth.user?.is_premium ? 'Premium' : 'gratis'} (maks ${limit.value} kata).`; return }
  loading.value = true
  // Analisis nyata butuh puluhan detik; penghitung detik supaya tidak terkesan macet.
  elapsed.value = 0
  const tick = setInterval(() => { elapsed.value += 1 }, 1000)
  try {
    let data
    if (file.value) {
      const form = new FormData()
      form.append('file', file.value)
      if (title.value.trim()) form.append('title', title.value.trim())
      form.append('ai_consent', 'true')
      data = await api('/api/analysis', { method: 'POST', form })
    } else {
      data = await api('/api/analysis', { method: 'POST', body: { text: text.value, title: title.value.trim() || 'Dokumen tanpa judul', ai_consent: true } })
    }
    documents.setCurrent(data)
    router.push('/hasil')
  } catch (e) {
    error.value = e.message || 'Analisis gagal. Coba lagi.'
  } finally {
    clearInterval(tick)
    loading.value = false
  }
}

function onFile(e) {
  const f = e.target.files[0]
  file.value = null
  if (!f) return
  if (f.size > 5 * 1024 * 1024) { error.value = 'File melebihi batas 5 MB.'; return }
  if (!/\.(txt|docx|pdf)$/i.test(f.name)) { error.value = 'Format harus .txt, .docx, atau .pdf.'; return }
  file.value = f
  title.value ||= f.name.replace(/\.(txt|docx|pdf)$/i, '')
  if (/\.txt$/i.test(f.name)) f.text().then((t) => { text.value = t }).catch(() => {})
  error.value = ''
}
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 py-12 sm:px-6">
    <div class="grid gap-8 md:grid-cols-[5fr_7fr]">
      <div>
        <SectionLabel>Analisis baru</SectionLabel>
        <h1 class="mt-4 text-5xl font-black uppercase leading-[0.9] tracking-tighter md:text-6xl">Tempel tulisanmu di sini</h1>
        <p class="mt-4 text-black/70">Tempel teks atau unggah file. Batas akunmu: <strong>{{ auth.user?.is_premium ? '10.000 kata (Premium)' : '500 kata (gratis)' }}</strong>. <router-link to="/premium" class="underline decoration-[#FF3000] decoration-2 underline-offset-4">Lihat Premium</router-link>.</p>
        <div class="swiss-dots mt-8 border-2 border-black bg-[#F2F2F2] p-6">
          <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]">Ketentuan</p>
          <ul class="mt-3 space-y-2 text-sm font-bold uppercase tracking-wide">
            <li class="flex gap-2"><span class="text-[#FF3000]">■</span> Minimal 20 kata</li>
            <li class="flex gap-2"><span class="text-[#FF3000]">■</span> Maks {{ limit }} kata</li>
            <li class="flex gap-2"><span class="text-[#FF3000]">■</span> File .txt / .docx / .pdf, maks 5 MB</li>
          </ul>
        </div>
      </div>

      <BaseCard class="flex flex-col">
        <div class="border-b-2 border-black p-4 sm:p-6">
          <input v-model="title" placeholder="JUDUL DOKUMEN" class="w-full bg-transparent text-xl font-black uppercase tracking-tight placeholder:text-black/30 focus:outline-none" />
        </div>
        <textarea v-model="text" rows="14" placeholder="Tulis atau tempel teks di sini…"
          class="w-full flex-1 resize-y bg-transparent p-4 text-[15px] leading-7 focus:outline-none sm:p-6"></textarea>
        <p v-if="file" class="border-t-2 border-black bg-[#F2F2F2] px-4 py-2 font-mono text-xs uppercase tracking-widest sm:px-6">File: {{ file.name }} ({{ (file.size / 1024).toFixed(0) }} KB) <button class="ml-2 underline" @click="file = null">batal</button></p>
        <div class="flex flex-col gap-3 border-t-2 border-black p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div class="flex flex-wrap items-center gap-2">
            <label class="swiss-snap-fast min-h-[44px] cursor-pointer border-2 border-black bg-white px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white">
              <i class="fa-solid fa-file-arrow-up mr-1.5"></i>Unggah<input type="file" accept=".txt,.docx,.pdf" class="hidden" @change="onFile" />
            </label>
            <button class="swiss-snap-fast min-h-[44px] border-2 border-black bg-white px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white" @click="text = SAMPLE; title ||= 'Contoh esai'"><i class="fa-solid fa-flask mr-1.5"></i>Coba contoh</button>
            <button v-if="text" class="min-h-[44px] px-3 py-2 text-xs font-bold uppercase tracking-widest text-black/60 hover:text-[#FF3000]" @click="text = ''">Hapus semua</button>
          </div>
          <div class="flex items-center gap-4">
            <span :class="['font-mono text-xs font-bold', words > limit ? 'bg-[#FF3000] px-2 py-1 text-white' : '']">{{ words }} / {{ limit }} kata</span>
            <BaseButton :disabled="loading" @click="run">
              <i :class="['fa-solid', loading ? 'fa-circle-notch fa-spin' : 'fa-wand-magic-sparkles']"></i>
              {{ loading ? `Memeriksa… ${elapsed} dtk` : 'Cek tulisan' }}
            </BaseButton>
          </div>
        </div>

        <!-- Muncul hanya saat proses berjalan: teks dikirim ke layanan AI lewat server. -->
        <p v-if="loading" class="border-t-2 border-black bg-[#F2F2F2] px-4 py-3 font-mono text-xs uppercase tracking-widest text-black/60 sm:px-6">
          Teks sedang dikirim ke layanan AI yang dikonfigurasi server. Biasanya selesai dalam 1 menit — biarkan halaman ini terbuka.
        </p>

        <div v-if="error" class="border-t-2 border-black bg-black px-4 py-3 sm:px-6">
          <p class="text-sm font-bold uppercase tracking-wide text-white"><i class="fa-solid fa-circle-exclamation mr-2 text-[#FF3000]"></i>{{ error }}</p>
          <button class="mt-2 min-h-[44px] border-2 border-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-[#FF3000] hover:border-[#FF3000]" @click="run">
            <i class="fa-solid fa-rotate-right mr-1"></i>Coba lagi
          </button>
        </div>
      </BaseCard>
    </div>
  </section>
</template>
