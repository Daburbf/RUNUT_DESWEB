<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import BaseButton from '../components/BaseButton.vue'
import BaseCard from '../components/BaseCard.vue'
import SectionLabel from '../components/SectionLabel.vue'
import { api, apiBase, session } from '../utils/api'
import { auth } from '../store/auth'

const health = ref(null)
const payments = ref([])
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const active = ref(null) // transaksi QRIS yang sedang ditampilkan
const qrUrl = ref('')

const rupiah = (n) => 'Rp' + Number(n || 0).toLocaleString('id-ID')
const fmt = (t) => (t ? new Date(t).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-')
const LABEL = { pending: 'Menunggu pembayaran', success: 'Berhasil', failed: 'Gagal', expired: 'Kedaluwarsa', cancelled: 'Dibatalkan' }

async function loadQrImage(orderId) {
  if (qrUrl.value) URL.revokeObjectURL(qrUrl.value)
  qrUrl.value = ''
  const res = await fetch(`${apiBase}/api/payments/${orderId}/qr`, {
    headers: { Authorization: `Bearer ${session.access || ''}` },
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Kode QR belum bisa diambil dari Midtrans.')
  qrUrl.value = URL.createObjectURL(await res.blob())
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    health.value = await api('/api/health')
    const { payments: list } = await api('/api/payments')
    payments.value = list || []
  } catch (e) { error.value = e.message } finally { loading.value = false }
}

async function create() {
  busy.value = true
  error.value = ''
  try {
    const { payment } = await api('/api/payments', { method: 'POST', body: {} })
    active.value = payment
    await loadQrImage(payment.order_id)
    await load()
  } catch (e) { error.value = e.message } finally { busy.value = false }
}

async function checkStatus(orderId) {
  busy.value = true
  error.value = ''
  try {
    const { payment } = await api(`/api/payments/${orderId}/status`)
    active.value = payment
    if (payment.status === 'success') await auth.refreshProfile()
    await load()
  } catch (e) { error.value = e.message } finally { busy.value = false }
}

// Selama transaksi masih menunggu, status juga diambil berkala.
let poll
function startPoll(orderId) {
  stopPoll()
  poll = setInterval(async () => {
    if (active.value?.status !== 'pending') return stopPoll()
    try { await checkStatus(orderId) } catch { /* biarkan tombol manual */ }
  }, 10000)
}
function stopPoll() { if (poll) clearInterval(poll); poll = null }

function watch(orderId) { active.value = payments.value.find((p) => p.order_id === orderId) || active.value; startPoll(orderId) }

onMounted(async () => { await load(); if (active.value) startPoll(active.value.order_id) })
onUnmounted(() => { stopPoll(); if (qrUrl.value) URL.revokeObjectURL(qrUrl.value) })
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 py-12 sm:px-6">
    <SectionLabel>Premium</SectionLabel>
    <h1 class="mt-4 text-5xl font-black uppercase leading-[0.9] tracking-tighter md:text-6xl">Naik ke premium</h1>
    <p class="mt-4 max-w-2xl text-black/70">Gratis: analisis sampai 500 kata, statistik dan maksimal 3 masalah, saran terkunci. Premium: sampai 10.000 kata, semua masalah beserta penjelasan dan saran, serta tombol menerapkan saran.</p>

    <p v-if="error" class="mt-6 border-2 border-black bg-black px-4 py-3 text-sm font-bold uppercase tracking-wide text-white"><span class="text-[#FF3000]">■</span> {{ error }}</p>

    <div v-if="loading" class="mt-8 border-4 border-black bg-[#F2F2F2] p-10 text-center font-mono text-sm uppercase tracking-widest"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Memuat…</div>

    <div v-else class="mt-8 grid gap-6 md:grid-cols-2">
      <BaseCard class="p-6 sm:p-8">
        <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]">Paket {{ health?.premium?.duration_days || 30 }} hari</p>
        <p class="mt-2 text-5xl font-black tracking-tighter">{{ health?.premium?.price_idr ? rupiah(health.premium.price_idr) : 'Belum ditetapkan' }}</p>
        <ul class="mt-6 space-y-2 text-sm font-bold uppercase tracking-wide">
          <li>■ 10.000 kata per analisis</li>
          <li>■ Semua masalah beserta saran terbuka</li>
          <li>■ Terapkan per saran atau sekaligus</li>
          <li>■ Unduh DOCX dan TXT</li>
        </ul>

        <div v-if="auth.user?.is_premium" class="mt-6 border-2 border-black bg-black px-4 py-2 text-sm font-bold uppercase tracking-widest text-white">Aktif sampai {{ fmt(auth.user.premium_until) }}</div>

        <template v-else-if="health?.premium?.configured">
          <div class="mt-6 flex flex-wrap gap-2">
            <BaseButton :disabled="busy" @click="create">
              <i :class="['fa-solid', busy ? 'fa-circle-notch fa-spin' : 'fa-qrcode']"></i>
              {{ busy ? 'Menyiapkan…' : 'Bayar dengan QRIS' }}
            </BaseButton>
          </div>

          <div v-if="active" class="mt-6 border-2 border-black p-4">
            <div class="flex items-center justify-between border-b-2 border-black pb-2">
              <span class="font-mono text-xs font-bold uppercase tracking-widest">Transaksi</span>
              <span class="px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-widest" :class="active.status === 'success' ? 'bg-black text-white' : 'border-2 border-black'">{{ LABEL[active.status] || active.status }}</span>
            </div>
            <div class="mt-4 flex flex-col items-center gap-3">
              <img v-if="qrUrl" :src="qrUrl" alt="Kode QRIS transaksi Midtrans" class="h-56 w-56 border-2 border-black bg-white object-contain" />
              <p v-else class="border-2 border-dashed border-black px-6 py-16 text-center font-mono text-xs uppercase tracking-widest">Kode QR tidak tersedia</p>
              <p class="text-center font-mono text-xs uppercase tracking-widest text-black/60">Pindai dengan aplikasi pembayaran apa pun yang mendukung QRIS.</p>
            </div>
            <dl class="mt-4 space-y-1 border-t-2 border-black pt-3 text-sm">
              <div class="flex justify-between gap-3"><dt class="text-black/60">Nominal</dt><dd class="font-bold tabular-nums">{{ rupiah(active.amount) }}</dd></div>
              <div class="flex justify-between gap-3"><dt class="text-black/60">Nomor referensi</dt><dd class="font-mono text-xs">{{ active.order_id }}</dd></div>
              <div class="flex justify-between gap-3"><dt class="text-black/60">Batas waktu bayar</dt><dd class="font-mono text-xs">{{ active.expiry_time || '-' }}</dd></div>
            </dl>
            <button :disabled="busy" class="mt-4 min-h-[44px] w-full border-2 border-black bg-white px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white disabled:opacity-50" @click="checkStatus(active.order_id)">
              <i class="fa-solid fa-rotate-right mr-1"></i>Periksa status pembayaran
            </button>
          </div>
        </template>

        <p v-else class="mt-6 border-l-4 border-[#FF3000] bg-[#F2F2F2] p-4 text-sm">
          Pembayaran belum aktif: server belum diberi kredensial Midtrans dan/atau tarif premium. Isi <code class="font-mono">MIDTRANS_SERVER_KEY</code> dan <code class="font-mono">PREMIUM_PRICE_IDR</code> di <code class="font-mono">server/.env</code> (SRS/SDD tidak menetapkan harga, jadi tidak ada nilai bawaan).
        </p>

        <p class="mt-4 text-xs text-black/60">Premium aktif <strong>hanya setelah pembayaran terverifikasi</strong> server lewat status/notifikasi resmi Midtrans — bukan dari parameter di browser.</p>
      </BaseCard>

      <BaseCard class="p-6 sm:p-8">
        <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]">Riwayat transaksi</p>
        <div v-if="payments.length" class="mt-4 space-y-2">
          <div v-for="p in payments" :key="p.id" class="border-2 border-black px-3 py-2 text-sm">
            <div class="flex items-center justify-between gap-3">
              <p class="font-mono text-xs">{{ p.order_id }}</p>
              <span class="shrink-0 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-widest" :class="p.status === 'success' ? 'bg-black text-white' : 'border-2 border-black'">{{ LABEL[p.status] || p.status }}</span>
            </div>
            <p class="mt-1 text-xs text-black/60">{{ fmt(p.created_at) }} · {{ rupiah(p.amount) }}</p>
            <button v-if="p.status === 'pending'" class="mt-2 min-h-[44px] border-2 border-black px-3 py-1.5 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white" @click="checkStatus(p.order_id); watch(p.order_id)"><i class="fa-solid fa-rotate-right mr-1"></i>Periksa status</button>
          </div>
        </div>
        <p v-else class="mt-4 text-sm text-black/60">Belum ada transaksi.</p>
        <p class="mt-4 border-t-2 border-black/10 pt-3 text-xs text-black/60">Penyimpanan transaksi masih di memori server untuk tahap pengembangan; riwayat ini hilang saat server dimulai ulang.</p>
      </BaseCard>
    </div>
  </section>
</template>
