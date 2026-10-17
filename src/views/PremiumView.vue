<script setup>
import BaseCard from '../components/BaseCard.vue'
import SectionLabel from '../components/SectionLabel.vue'
import { auth } from '../store/auth'

// Harga & masa aktif dipakai seragam dengan footer website.
const PRICE = 'Rp49.000'
const DAYS = 30

// Tampilan saja: metode pembayaran hanya ditampilkan sebagai gambaran.
// Tidak ada tombol yang mengirim permintaan ke server.
const methods = [
  { name: 'QRIS', note: 'Semua aplikasi pembayaran', icon: 'fa-qrcode' },
  { name: 'BCA Virtual Account', note: 'Transfer bank', icon: 'fa-building-columns' },
  { name: 'GoPay', note: 'Saldo & aplikasi', icon: 'fa-wallet' },
  { name: 'OVO', note: 'Saldo & aplikasi', icon: 'fa-mobile-screen-button' },
  { name: 'DANA', note: 'Saldo & aplikasi', icon: 'fa-money-bill-transfer' },
  { name: 'ShopeePay', note: 'Saldo & aplikasi', icon: 'fa-bag-shopping' },
  { name: 'Kartu Kredit / Debit', note: 'Visa · Mastercard', icon: 'fa-credit-card' },
  { name: 'Alfamart / Indomaret', note: 'Bayar di gerai', icon: 'fa-store' },
]

const benefits = [
  '10.000 kata per analisis',
  'Seluruh masalah beserta penjelasan',
  'Semua saran terbuka',
  'Terapkan per saran atau sekaligus',
  'Unduh DOCX dan TXT',
  'Dokumen tersimpan 30 hari',
]

const fmt = (t) => (t ? new Date(t).toLocaleString('id-ID', { dateStyle: 'medium' }) : '-')
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 py-12 sm:px-6">
    <SectionLabel>Premium</SectionLabel>
    <h1 class="mt-4 text-5xl font-black uppercase leading-[0.9] tracking-tighter md:text-6xl">Naik ke premium</h1>
    <p class="mt-4 max-w-2xl text-black/70">
      Gratis: analisis sampai 500 kata, statistik tulisan, dan maksimal 3 masalah. Premium: sampai 10.000 kata,
      seluruh masalah beserta penjelasan dan saran, serta unduhan DOCX dan TXT.
    </p>

    <p class="mt-6 border-2 border-black bg-black px-4 py-3 text-sm font-bold uppercase tracking-wide text-white">
      <span class="text-[#FF3000]">■</span> Pembayaran belum dibuka. Paket dan metode di bawah hanya tampilan.
    </p>

    <div class="mt-8 grid gap-6 md:grid-cols-2">
      <BaseCard class="p-6 sm:p-8">
        <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]">Paket {{ DAYS }} hari</p>
        <p class="mt-2 text-5xl font-black tracking-tighter">{{ PRICE }}</p>
        <ul class="mt-6 space-y-2 text-sm font-bold uppercase tracking-wide">
          <li v-for="b in benefits" :key="b" class="flex gap-2"><span class="text-[#FF3000]">■</span> {{ b }}</li>
        </ul>

        <div v-if="auth.user?.is_premium" class="mt-6 border-2 border-black bg-black px-4 py-2 text-sm font-bold uppercase tracking-widest text-white">
          Aktif sampai {{ fmt(auth.user.premium_until) }}
        </div>
        <p v-else class="mt-6 border-2 border-dashed border-black px-4 py-3 text-center font-mono text-xs uppercase tracking-widest text-black/60">
          Pembelian belum tersedia
        </p>
      </BaseCard>

      <BaseCard class="p-6 sm:p-8">
        <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]">Metode pembayaran</p>
        <ul class="mt-4 grid gap-2 sm:grid-cols-2">
          <li v-for="m in methods" :key="m.name" class="flex items-center gap-3 border-2 border-black/20 px-3 py-2">
            <span class="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-black/20 text-black/40">
              <i :class="['fa-solid', m.icon]"></i>
            </span>
            <span class="min-w-0">
              <span class="block truncate text-sm font-bold uppercase tracking-wide text-black/70">{{ m.name }}</span>
              <span class="block font-mono text-[10px] uppercase tracking-widest text-black/40">{{ m.note }}</span>
            </span>
          </li>
        </ul>
        <p class="mt-4 border-t-2 border-black/10 pt-3 text-xs text-black/60">
          Semua metode di atas masih gambaran. Tidak ada transaksi yang diproses dan tidak ada uang yang berpindah.
        </p>
      </BaseCard>
    </div>
  </section>
</template>
