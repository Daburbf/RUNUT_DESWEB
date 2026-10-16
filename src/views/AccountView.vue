<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import BaseCard from '../components/BaseCard.vue'
import SectionLabel from '../components/SectionLabel.vue'
import { auth } from '../store/auth'

const router = useRouter()
const fmt = (t) => t ? new Date(t).toLocaleString('id-ID', { dateStyle: 'long' }) : '-'
const show = ref(false)

function logout() {
  auth.logout().finally(() => router.push('/'))
}
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 py-12 sm:px-6">
    <SectionLabel>Akun</SectionLabel>
    <h1 class="mt-4 text-5xl font-black uppercase leading-[0.9] tracking-tighter md:text-6xl">Akunmu</h1>
    <div v-if="auth.user" class="mt-8 grid gap-6 md:grid-cols-2">
      <BaseCard class="p-6 sm:p-8">
        <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]">Profil</p>
        <p class="mt-2 text-2xl font-black uppercase tracking-tight">{{ auth.user.name }}</p>
        <p class="text-sm text-black/60">{{ auth.user.email }}</p>
        <p class="mt-4 inline-block border-2 border-black px-2 py-1 font-mono text-xs font-bold uppercase tracking-widest" :class="auth.user.is_premium ? 'bg-[#FF3000] text-white border-[#FF3000]' : ''">
          {{ auth.user.is_premium ? 'Premium sampai ' + fmt(auth.user.premium_until) : 'Akun gratis (500 kata)' }}
        </p>
        <div class="mt-6 flex flex-wrap gap-2">
          <BaseButton v-if="!auth.user.is_premium" to="/premium" variant="accent" size="sm">Naik ke Premium</BaseButton>
          <BaseButton variant="secondary" size="sm" @click="show = true">Keluar</BaseButton>
        </div>
      </BaseCard>
      <BaseCard class="p-6 sm:p-8">
        <p class="font-mono text-xs uppercase tracking-widest text-[#FF3000]">Data & privasi</p>
        <p class="mt-2 text-sm leading-7 text-black/70">Dokumenmu tersimpan di server selama 30 hari setelah analisis terakhir, lalu dihapus otomatis. Menghapus dari riwayat juga menghapusnya permanen. Teks dokumen hanya dikirim ke provider AI yang dikonfigurasi server, tidak ke layanan lain.</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <BaseButton to="/riwayat" variant="secondary" size="sm">Kelola riwayat</BaseButton>
          <BaseButton to="/premium" variant="secondary" size="sm">Lihat pembayaran</BaseButton>
        </div>
      </BaseCard>
    </div>
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" @click.self="show = false">
      <div class="w-full max-w-md border-4 border-black bg-white p-6">
        <p class="font-black uppercase tracking-tight">Yakin mau keluar?</p>
        <div class="mt-6 flex justify-end gap-2">
          <BaseButton variant="secondary" size="sm" @click="show = false">Batal</BaseButton>
          <BaseButton variant="accent" size="sm" @click="logout">Keluar</BaseButton>
        </div>
      </div>
    </div>
  </section>
</template>
