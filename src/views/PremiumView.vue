<script setup>
import { ref, onMounted } from 'vue'
import BaseButton from '../components/BaseButton.vue'
import BaseCard from '../components/BaseCard.vue'
import SectionLabel from '../components/SectionLabel.vue'
import { api, apiBase } from '../utils/api'
import { auth } from '../store/auth'

const info = ref(null)
const payments = ref([])
const loading = ref(true)
const error = ref('')
const paying = ref(false)

async function load() {
  loading.value = true
  try {
    info.value = await api('/api/health')
    const { payments: list } = await api('/api/payments')
    payments.value = list || []
  } catch (e) { error.value = e.message }
  finally { loading.value = false }
}

async function pay() {
  paying.value = true
  error.value = ''
  try {
    const trx = await api('/api/payments', { method: 'POST', body: {} })
    if (window.snap && trx.snap_token) {
      window.snap.pay(trx.snap_token, {
        onSuccess: async () => { await auth.refreshProfile(); await load() },
        onPending: async () => { await load() },
        onError: (r) => { error.value = 'Pembayaran gagal: ' + (r?.status_message || 'coba lagi.') },
        onClose: () => { error.value = 'Jendela pembayaran ditutup sebelum selesai. Status premium hanya aktif setelah pembayaran terverifikasi.' },
      })
    } else if (trx.redirect_url) {
      window.open(trx.redirect_url, '_blank')
      error.value = 'Selesaikan pembayaran di tab baru, lalu muat ulang halaman ini. Premium aktif otomatis setelah notifikasi terverifikasi.'
    } else {
      error.value = 'Respons Midtrans tidak lengkap.'
    }
  } catch (e) { error.value = e.message }
  finally { paying.value = false }
}

const rupiah = (n) => 'Rp' + Number(n || 0).toLocaleString('id-ID')
const fmt = (t) => t ? new Date(t).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'

onMounted(() => {
  const s = info.value
  void s
  load().then(() => {
    const snapJs = document.querySelector('script[data-snap]')
    if (!snapJs && info.value) {
      const sc = document.createElement('script')
      sc.src = 'https://app.sandbox.midtrans.com/snap/snap.js'
      sc.setAttribute('data-client-key', '')
      sc.setAttribute('data-snap', '1')
      document.head.appendChild(sc)
    }
  })
})
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 py-12 sm:px-6">
    <SectionLabel>Premium</SectionLabel>
    <h1 class="mt-4 text-5xl font-black uppercase leading-[0.9] tracking-tighter md:text-6xl">Naik ke premium</h1>
    <p class="mt-4 max-w-2xl text-black/70">Gratis: analisis sampai 500 kata, statistik + maksimal 3 masalah, saran terkunci. Premium: sampai 10.000 kata, semua masalah + penjelasan + saran, dan tombol terapkan saran.</p>

    <div class="mt-8 grid gap-6 md:grid-cols-2">
      <BaseCard class="p-6 sm:p-8">
        <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]">Paket 30 hari</p>
        <p class="mt-2 text-5xl font-black tracking-tighter">{{ rupiah(info?.premium_price_idr || 49000) }}</p>
        <ul class="mt-6 space-y-2 text-sm font-bold uppercase tracking-wide">
          <li>■ 10.000 kata per analisis</li>
          <li>■ Semua masalah + saran terbuka</li>
          <li>■ Terapkan per bagian / sekaligus</li>
          <li>■ Unduh DOCX + TXT</li>
        </ul>
        <div class="mt-6 flex flex-wrap gap-2">
          <BaseButton v-if="!auth.user?.is_premium" :disabled="paying" @click="pay">
            <i :class="['fa-solid', paying ? 'fa-circle-notch fa-spin' : 'fa-crown']"></i>
            {{ paying ? 'Menyiapkan…' : 'Bayar via Midtrans' }}
          </BaseButton>
          <span v-else class="border-2 border-black bg-black px-4 py-2 text-sm font-bold uppercase tracking-widest text-white">Aktif sampai {{ fmt(auth.user.premium_until) }}</span>
        </div>
        <p class="mt-4 text-xs text-black/60">Premium aktif <strong>hanya setelah pembayaran terverifikasi</strong> oleh server via notifikasi Midtrans. Jangan percaya status dari browser.</p>
      </BaseCard>

      <BaseCard class="p-6 sm:p-8">
        <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]">Riwayat pembayaranmu</p>
        <div v-if="loading" class="mt-4 font-mono text-xs uppercase tracking-widest"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Memuat…</div>
        <div v-else-if="payments.length" class="mt-4 space-y-2">
          <div v-for="p in payments" :key="p.id" class="flex items-center justify-between gap-3 border-2 border-black px-3 py-2 text-sm">
            <div><p class="font-mono text-xs">{{ p.order_id }}</p><p class="text-xs text-black/60">{{ fmt(p.created_at) }} · {{ rupiah(p.amount) }}</p></div>
            <span class="bg-black px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-widest text-white">{{ p.status }}</span>
          </div>
        </div>
        <p v-else class="mt-4 text-sm text-black/60">Belum ada transaksi.</p>
        <p v-if="error" class="mt-4 border-2 border-black bg-black px-3 py-2 text-sm font-bold text-white"><span class="text-[#FF3000]">■</span> {{ error }}</p>
        <p class="mt-4 hidden">{{ apiBase }}</p>
      </BaseCard>
    </div>
  </section>
</template>
