<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { auth } from '../store/auth'
import BaseButton from './BaseButton.vue'
import logoUrl from '/images/logo.svg'

const open = ref(false)
const route = useRoute()
const router = useRouter()
watch(() => route.fullPath, () => (open.value = false))

const links = [
  { to: '/', label: 'Beranda', num: '01' },
  { to: '/tentang', label: 'Tentang', num: '02' },
  { to: '/analisis', label: 'Analisis', num: '03' },
  { to: '/riwayat', label: 'Riwayat', num: '04' },
]

function logout() {
  auth.logout(); router.push('/')
}
</script>

<template>
  <!-- Dokumentasi: header Swiss — bar hitam 8px + baris putih border-b-4.
       Navigasi memakai animasi geser vertikal (lihat .swiss-nav-link). -->
  <header class="sticky top-0 z-40 bg-white">
    <div class="h-2 bg-black" aria-hidden="true"></div>
    <nav class="mx-auto flex h-16 max-w-6xl items-center justify-between border-b-4 border-black px-4 sm:px-6" aria-label="Navigasi utama">
      <router-link to="/" class="flex items-center gap-2.5">
        <img :src="logoUrl" alt="Logo Runut" class="h-8 w-8" />
        <span class="text-lg font-black uppercase tracking-tighter">Runut</span>
        <span class="hidden bg-black px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-white sm:inline">V.2.0</span>
      </router-link>

      <ul class="hidden items-center gap-7 md:flex">
        <li v-for="l in links" :key="l.to">
          <router-link :to="l.to" class="swiss-nav-link text-xs font-bold uppercase tracking-widest hover:text-black"
            :class="$route.path === l.to ? 'text-[#FF3000]' : 'text-black'"
            exact-active-class="!text-[#FF3000]">
            <span :data-label="l.label">{{ l.label }}</span>
          </router-link>
        </li>
      </ul>

      <div class="hidden items-center gap-3 md:flex">
        <template v-if="auth.user">
          <span class="max-w-[140px] truncate text-sm font-bold uppercase">{{ auth.user.name }}</span>
          <BaseButton variant="secondary" size="sm" @click="logout">Keluar</BaseButton>
        </template>
        <template v-else>
          <router-link to="/masuk" class="swiss-nav-link text-xs font-bold uppercase tracking-widest text-black">
            <span data-label="Masuk">Masuk</span>
          </router-link>
          <BaseButton to="/daftar" size="sm">Daftar</BaseButton>
        </template>
      </div>

      <button class="flex h-11 w-11 items-center justify-center border-2 border-black md:hidden" :aria-expanded="open" aria-label="Buka menu" @click="open = !open">
        <i :class="['fa-solid text-lg transition-transform duration-200', open ? 'fa-xmark rotate-90' : 'fa-bars']"></i>
      </button>
    </nav>

    <transition name="fade">
      <div v-if="open" class="border-b-4 border-black bg-white px-4 py-4 md:hidden">
        <router-link v-for="l in links" :key="l.to" :to="l.to"
          class="flex items-center justify-between border-b-2 border-black/10 px-2 py-4 text-sm font-black uppercase tracking-wide last:border-0 hover:bg-[#F2F2F2] hover:text-[#FF3000]">
          <span>{{ l.label }}</span><span class="font-mono text-xs text-[#FF3000]">{{ l.num }}</span>
        </router-link>
        <div class="mt-3 flex flex-col gap-2 border-t-2 border-black pt-4">
          <BaseButton v-if="auth.user" variant="secondary" @click="logout">Keluar ({{ auth.user.name }})</BaseButton>
          <template v-else>
            <BaseButton to="/masuk" variant="secondary">Masuk</BaseButton>
            <BaseButton to="/daftar">Daftar</BaseButton>
          </template>
        </div>
      </div>
    </transition>
  </header>
</template>
