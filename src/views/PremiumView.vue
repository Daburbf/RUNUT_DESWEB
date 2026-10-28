<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import BaseCard from '../components/BaseCard.vue'
import SectionLabel from '../components/SectionLabel.vue'
import { api, fetchBlob, downloadFile } from '../utils/api'
import { auth } from '../store/auth'

// Halaman Premium = satu-satunya jalur pembelian. Nominal dan nomor pesanan
// selalu dibuat server; halaman ini hanya memilih metode dan menampilkan
// instruksi yang dikembalikan server.

const route = useRoute()
const router = useRouter()

const info = ref(null)
const orders = ref([])
const loading = ref(true)
const error = ref('')
const notice = ref('')
const method = ref('')
const order = ref(null)
const creating = ref(false)
const checking = ref(false)
const qrUrl = ref('')
let poll = null

const fmtIdr = (n) => 'Rp' + Number(n || 0).toLocaleString('id-ID')
const fmtDate = (t) => (t ? new Date(t).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-')

const price = computed(() => fmtIdr(info.value?.price_idr || 0))
const days = computed(() => info.value?.duration_days || 30)
const mode = computed(() => info.value?.mode || 'unavailable')
const available = computed(() => Boolean(info.value?.available))
const methods = computed(() => info.value?.methods || [])
const isPremium = computed(() => Boolean(auth.user?.is_premium))
const premiumUntil = computed(() => (auth.user?.premium_until ? fmtDate(auth.user.premium_until) : '-'))

const STATUS = {
  pending: { label: 'Menunggu pembayaran', cls: 'bg-[#F2F2F2] text-black' },
  paid: { label: 'Lunas', cls: 'bg-black text-white' },
  failed: { label: 'Gagal', cls: 'bg-[#FF3000] text-white' },
  expired: { label: 'Kedaluwarsa', cls: 'bg-[#FF3000] text-white' },
  cancelled: { label: 'Dibatalkan', cls: 'bg-[#FF3000] text-white' },
  refunded: { label: 'Dikembalikan', cls: 'bg-[#F2F2F2] text-black' },
}
const statusOf = (s) => STATUS[s] || { label: s, cls: 'bg-[#F2F2F2] text-black' }

const benefits = [
  'Teks sepuasnya — tanpa batas kata',
  'Seluruh masalah beserta penjelasan',
  'Semua saran terbuka',
  'Perbaikan otomatis sekali klik',
  'Unduh hasil perbaikan PDF, DOCX, TXT',
  'Dokumen tersimpan 30 hari',
]

async function copy(value) {
  try {
    await navigator.clipboard.writeText(String(value))
    notice.value = 'Nomor disalin ke papan klip.'
  } catch {
    error.value = 'Gagal menyalin. Salin manual dari teks di atas.'
  }
}

function stopPoll() {
  if (poll) clearInterval(poll)
  poll = null
}

function startPoll() {
  stopPoll()
  if (order.value?.status !== 'pending') return
  poll = setInterval(check, 5000)
}

function apply(payment) {
  order.value = payment
  const i = orders.value.findIndex((o) => o.order_id === payment.order_id)
  if (i >= 0) orders.value[i] = payment
  else if (payment.order_id) orders.value.unshift(payment)
  if (payment.status !== 'pending') {
    stopPoll()
    if (payment.status === 'paid') {
      notice.value = 'Pembayaran diterima. Premium aktif.'
      auth.refreshProfile()
    }
  }
}

async function loadQr() {
  if (qrUrl.value) { URL.revokeObjectURL(qrUrl.value); qrUrl.value = '' }
  if (order.value?.channel !== 'qris' || !order.value?.instructions?.qr_url) return
  try {
    qrUrl.value = URL.createObjectURL(await fetchBlob(`/api/payments/${order.value.order_id}/qr`))
  } catch {
    qrUrl.value = ''
  }
}

// Status selalu ditanyakan ke server; server yang bertanya ke gateway.
async function check(silent = true) {
  if (!order.value || checking.value) return
  checking.value = true
  try {
    const { payment } = await api(`/api/payments/${order.value.order_id}`)
    apply(payment)
    if (!silent) notice.value = payment.status === 'pending' ? 'Belum ada pembayaran masuk. Coba lagi beberapa saat.' : ''
  } catch (e) {
    if (!silent) error.value = e.message
  } finally {
    checking.value = false
  }
}

async function create() {
  error.value = ''
  notice.value = ''
  if (!method.value) { error.value = 'Pilih metode pembayaran dulu.'; return }
  creating.value = true
  try {
    const { payment } = await api('/api/payments', { method: 'POST', body: { method: method.value } })
    apply(payment)
    router.replace({ name: 'premium', query: { order: payment.order_id } })
    await loadQr()
    startPoll()
    if (payment.channel === 'card' && mode.value === 'midtrans' && payment.instructions?.redirect_url) {
      window.open(payment.instructions.redirect_url, '_blank', 'noopener')
    }
  } catch (e) {
    error.value = e.message || 'Transaksi tidak bisa dibuat.'
  } finally {
    creating.value = false
  }
}

async function openOrder(row) {
  error.value = ''
  notice.value = ''
  apply(row)
  router.replace({ name: 'premium', query: { order: row.order_id } })
  await loadQr()
  startPoll()
  if (row.status === 'pending') await check()
}

async function simulate() {
  if (!order.value) return
  checking.value = true
  try {
    const { payment } = await api(`/api/payments/${order.value.order_id}/simulate`, { method: 'POST', body: {} })
    apply(payment)
  } catch (e) {
    error.value = e.message
  } finally {
    checking.value = false
  }
}

async function invoice(row) {
  try {
    await downloadFile(`/api/payments/${row.order_id}/invoice`, `invoice-${row.order_id}.pdf`)
  } catch (e) {
    error.value = e.message
  }
}

onMounted(async () => {
  try {
    const data = await api('/api/payments')
    info.value = data
    orders.value = data.orders || []
    if (data.methods?.length) method.value = data.methods[0].id
    const wanted = String(route.query.order || '')
    if (wanted) {
      const known = orders.value.find((o) => o.order_id === wanted)
      if (known) await openOrder(known)
      else {
        const { payment } = await api(`/api/payments/${wanted}`)
        apply(payment)
        await loadQr()
        startPoll()
      }
    }
  } catch (e) {
    error.value = e.message || 'Data pembayaran tidak bisa dimuat.'
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  stopPoll()
  if (qrUrl.value) URL.revokeObjectURL(qrUrl.value)
})
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 py-12 sm:px-6">
    <SectionLabel>Premium</SectionLabel>
    <h1 class="mt-4 text-5xl font-black uppercase leading-[0.9] tracking-tighter md:text-6xl">Naik ke premium</h1>
    <p class="mt-4 max-w-2xl text-black/70">
      Gratis: analisis sampai 500 kata, statistik tulisan, dan maksimal 3 masalah.
      Premium: tanpa batas kata, seluruh masalah beserta saran, perbaikan otomatis, dan unduhan PDF/DOCX/TXT.
    </p>

    <p v-if="isPremium" class="mt-6 border-2 border-black bg-black px-4 py-3 text-sm font-bold uppercase tracking-wide text-white">
      <span class="text-[#FF3000]">■</span> Akun ini Premium sampai {{ premiumUntil }}. Perpanjangan bisa dilakukan setelah masa aktif berakhir.
    </p>
    <p v-else-if="!loading && !available" class="mt-6 border-2 border-black bg-[#FF3000] px-4 py-3 text-sm font-bold uppercase tracking-wide text-white">
      <span class="text-white">■</span> Pembelian sedang ditutup: payment gateway belum dikonfigurasi di server.
    </p>
    <p v-else-if="mode === 'simulator'" class="mt-6 border-2 border-black bg-[#F2F2F2] px-4 py-3 text-sm font-bold uppercase tracking-wide">
      <span class="text-[#FF3000]">■</span> Mode uji: pembayaran disimulasikan, tidak ada uang berpindah.
    </p>

    <p v-if="notice" class="mt-4 flex items-center gap-3 border-2 border-black bg-black px-4 py-3 text-sm font-bold uppercase tracking-wide text-white">
      <span class="flex h-6 w-6 items-center justify-center bg-[#FF3000]"><i class="fa-solid fa-check text-xs"></i></span>{{ notice }}
    </p>
    <p v-if="error" class="mt-4 flex items-center gap-3 border-2 border-black bg-black px-4 py-3 text-sm font-bold uppercase tracking-wide text-white">
      <span class="flex h-6 w-6 items-center justify-center bg-[#FF3000]"><i class="fa-solid fa-triangle-exclamation text-xs"></i></span>{{ error }}
    </p>

    <div class="mt-8 grid gap-6 md:grid-cols-2">
      <BaseCard class="p-6 sm:p-8">
        <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]">Paket {{ days }} hari</p>
        <p class="mt-2 text-5xl font-black tracking-tighter">{{ price }}</p>
        <ul class="mt-6 space-y-2 text-sm font-bold uppercase tracking-wide">
          <li v-for="b in benefits" :key="b" class="flex gap-2"><span class="text-[#FF3000]">■</span> {{ b }}</li>
        </ul>
      </BaseCard>

      <BaseCard class="p-6 sm:p-8">
        <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]">Metode pembayaran</p>
        <p v-if="loading" class="mt-4 font-mono text-xs uppercase tracking-widest text-black/50"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Memuat metode...</p>
        <ul v-else class="mt-4 grid gap-2 sm:grid-cols-2">
          <li v-for="m in methods" :key="m.id">
            <button
              type="button"
              :disabled="!available || isPremium"
              :aria-pressed="method === m.id"
              :class="['flex w-full items-center gap-3 border-2 px-3 py-2 text-left transition-colors disabled:opacity-40', method === m.id ? 'border-black bg-black text-white' : 'border-black/20 hover:border-black']"
              @click="method = m.id">
              <span :class="['flex h-8 w-8 shrink-0 items-center justify-center border-2', method === m.id ? 'border-white' : 'border-black/20']">
                <i :class="['fa-solid', m.icon]"></i>
              </span>
              <span class="min-w-0">
                <span class="block truncate text-sm font-bold uppercase tracking-wide">{{ m.label }}</span>
                <span :class="['block font-mono text-[10px] uppercase tracking-widest', method === m.id ? 'text-white/60' : 'text-black/40']">{{ m.note || m.group }}</span>
              </span>
            </button>
          </li>
        </ul>

        <BaseButton class="mt-5 w-full" :disabled="!available || isPremium || creating || !!order" @click="create">
          <i :class="['fa-solid', creating ? 'fa-circle-notch fa-spin' : 'fa-lock-open']"></i>
          {{ creating ? 'Membuat transaksi...' : `Bayar ${price}` }}
        </BaseButton>
        <p v-if="isPremium" class="mt-3 text-xs text-black/60">Akun Premium tidak bisa membuat transaksi baru sebelum masa aktif berakhir.</p>
        <p v-else-if="order" class="mt-3 text-xs text-black/60">
          Transaksi aktif sedang ditampilkan di bawah.
          <button class="underline" @click="order = null; stopPoll()">Ganti metode</button>
        </p>
      </BaseCard>
    </div>

    <!-- Instruksi pembayaran transaksi aktif -->
    <BaseCard v-if="order" class="mt-6 p-6 sm:p-8">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-4">
        <div>
          <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]">Transaksi {{ order.order_id }}</p>
          <p class="mt-1 text-xl font-black uppercase tracking-tight">{{ order.method_label }} · {{ fmtIdr(order.amount) }}</p>
        </div>
        <span :class="['px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest', statusOf(order.status).cls]">{{ statusOf(order.status).label }}</span>
      </div>

      <!-- QRIS -->
      <div v-if="order.channel === 'qris'" class="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
        <img v-if="qrUrl" :src="qrUrl" alt="Kode QRIS pembayaran" class="h-52 w-52 border-2 border-black bg-white p-2" />
        <div v-else class="flex h-52 w-52 items-center justify-center border-2 border-dashed border-black text-center font-mono text-[10px] uppercase tracking-widest text-black/50">
          Kode QR hanya tersedia pada gateway asli
        </div>
        <div class="text-sm leading-relaxed">
          <p class="font-bold uppercase tracking-wide">Scan dengan aplikasi pembayaran apa pun.</p>
          <p class="mt-1 text-black/70">Nominal sudah terisi otomatis: <strong>{{ fmtIdr(order.amount) }}</strong>. Jangan ubah nominalnya.</p>
          <p v-if="order.expires_at" class="mt-2 font-mono text-xs uppercase tracking-widest text-black/50">Berlaku sampai {{ fmtDate(order.expires_at) }}</p>
        </div>
      </div>

      <!-- Virtual Account -->
      <div v-else-if="order.channel === 'va'" class="mt-5">
        <p class="font-mono text-xs uppercase tracking-widest text-black/60">Nomor virtual account {{ order.instructions.bank ? '· ' + String(order.instructions.bank).toUpperCase() : '' }}</p>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <span class="border-2 border-black px-4 py-2 text-2xl font-black tabular-nums tracking-wider">{{ order.instructions.va_number || '—' }}</span>
          <button class="min-h-[44px] border-2 border-black px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white" @click="copy(order.instructions.va_number)"><i class="fa-solid fa-copy mr-1"></i>Salin</button>
        </div>
        <p class="mt-3 text-sm text-black/70">Transfer tepat {{ fmtIdr(order.amount) }} lewat mobile banking atau ATM. Status berubah otomatis setelah pembayaran diterima.</p>
      </div>

      <!-- Minimarket -->
      <div v-else-if="order.channel === 'cstore'" class="mt-5">
        <p class="font-mono text-xs uppercase tracking-widest text-black/60">Kode bayar di {{ String(order.instructions.store || '').toUpperCase() }}</p>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <span class="border-2 border-black px-4 py-2 text-2xl font-black tabular-nums tracking-wider">{{ order.instructions.payment_code || '—' }}</span>
          <button class="min-h-[44px] border-2 border-black px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white" @click="copy(order.instructions.payment_code)"><i class="fa-solid fa-copy mr-1"></i>Salin</button>
        </div>
        <p class="mt-3 text-sm text-black/70">Tunjukkan kode ini di kasir dan bayar {{ fmtIdr(order.amount) }}.</p>
      </div>

      <!-- E-wallet -->
      <div v-else-if="order.channel === 'ewallet'" class="mt-5">
        <a v-if="order.instructions.deeplink" :href="order.instructions.deeplink" target="_blank" rel="noopener" class="inline-block border-2 border-black bg-black px-4 py-2 text-xs font-bold uppercase tracking-widest text-white hover:bg-[#FF3000] hover:border-[#FF3000]">
          <i class="fa-solid fa-arrow-up-right-from-square mr-1"></i>Buka aplikasi {{ order.method_label }}
        </a>
        <p class="mt-3 text-sm text-black/70">Selesaikan pembayaran {{ fmtIdr(order.amount) }} di aplikasi. Kembali ke halaman ini setelah selesai.</p>
      </div>

      <!-- Kartu -->
      <div v-else-if="order.channel === 'card'" class="mt-5">
        <a v-if="order.instructions.redirect_url" :href="order.instructions.redirect_url" target="_blank" rel="noopener" class="inline-block border-2 border-black bg-black px-4 py-2 text-xs font-bold uppercase tracking-widest text-white hover:bg-[#FF3000] hover:border-[#FF3000]">
          <i class="fa-solid fa-credit-card mr-1"></i>Buka halaman kartu
        </a>
        <p class="mt-3 text-sm text-black/70">Pembayaran kartu diproses di halaman aman gateway. Setelah selesai, status di halaman ini ikut diperbarui.</p>
      </div>

      <div class="mt-5 flex flex-wrap gap-2 border-t-2 border-black pt-4">
        <BaseButton v-if="order.status === 'pending'" size="sm" :disabled="checking" @click="check(false)">
          <i :class="['fa-solid', checking ? 'fa-circle-notch fa-spin' : 'fa-rotate-right']"></i>Saya sudah bayar, periksa
        </BaseButton>
        <BaseButton v-if="order.status === 'pending' && mode === 'simulator'" variant="accent" size="sm" :disabled="checking" @click="simulate">
          <i class="fa-solid fa-flask"></i>Simulasikan lunas
        </BaseButton>
        <BaseButton v-if="order.status === 'paid'" variant="secondary" size="sm" @click="invoice(order)">
          <i class="fa-solid fa-file-invoice"></i>Unduh invoice PDF
        </BaseButton>
        <span v-if="order.status === 'pending'" class="self-center font-mono text-[10px] uppercase tracking-widest text-black/50">
          Status diperiksa otomatis tiap 5 detik
        </span>
        <BaseButton v-if="order.status === 'paid'" size="sm" to="/analisis"><i class="fa-solid fa-arrow-right"></i>Mulai analisis</BaseButton>
      </div>
    </BaseCard>

    <!-- Riwayat transaksi -->
    <BaseCard v-if="orders.length" class="mt-6">
      <p class="border-b-2 border-black px-4 py-3 font-black uppercase tracking-tight">Riwayat transaksi</p>
      <ul class="divide-y-2 divide-black/10">
        <li v-for="o in orders" :key="o.order_id" class="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
          <div class="min-w-0 flex-1">
            <p class="truncate font-bold uppercase tracking-wide">{{ o.method_label }}</p>
            <p class="font-mono text-[11px] uppercase tracking-widest text-black/50">{{ o.order_id }} · {{ fmtDate(o.created_at) }} · {{ fmtIdr(o.amount) }}</p>
          </div>
          <span :class="['px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest', statusOf(o.status).cls]">{{ statusOf(o.status).label }}</span>
          <button class="min-h-[36px] border-2 border-black px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-black hover:text-white" @click="openOrder(o)">
            {{ o.status === 'pending' ? 'Lanjutkan' : 'Lihat' }}
          </button>
          <button v-if="o.status === 'paid'" class="min-h-[36px] border-2 border-black px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-black hover:text-white" @click="invoice(o)">Invoice</button>
        </li>
      </ul>
    </BaseCard>
  </section>
</template>
