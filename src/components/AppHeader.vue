<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../store/auth'

const open = ref(false)
const router = useRouter()

function logout() {
  auth.logout().finally(() => router.push('/'))
}
</script>

<template>
  <header class="sticky top-0 z-40 bg-white">
    <div class="h-2 bg-black" aria-hidden="true"></div>
    <nav class="mx-auto flex h-16 max-w-6xl items-center justify-between border-b-4 border-black px-4 sm:px-6" aria-label="Navigasi utama">
      <router-link to="/" class="flex items-center gap-2.5">
        <span class="flex h-8 w-8 items-center justify-center bg-black font-mono text-sm font-black text-white">R</span>
        <span class="text-lg font-black uppercase tracking-tighter">Runut</span>
      </router-link>

      <ul class="hidden items-center gap-7 md:flex">
        <li><router-link to="/" class="swiss-nav-link text-xs font-bold uppercase tracking-widest" exact-active-class="!text-[#FF3000]"><span data-label="Beranda">Beranda</span></router-link></li>
        <li><router-link to="/tentang" class="swiss-nav-link text-xs font-bold uppercase tracking-widest" exact-active-class="!text-[#FF3000]"><span data-label="Tentang Aplikasi">Tentang Aplikasi</span></router-link></li>
        <li><router-link to="/analisis" class="swiss-nav-link text-xs font-bold uppercase tracking-widest" exact-active-class="!text-[#FF3000]"><span data-label="Analisis">Analisis</span></router-link></li>
        <li><router-link to="/riwayat" class="swiss-nav-link text-xs font-bold uppercase tracking-widest" exact-active-class="!text-[#FF3000]"><span data-label="Riwayat">Riwayat</span></router-link></li>
      </ul>

      <div class="hidden items-center gap-3 md:flex">
        <template v-if="auth.user">
          <router-link to="/akun" class="max-w-[140px] truncate text-sm font-bold uppercase hover:text-[#FF3000]">{{ auth.user.name }}</router-link>
          <span v-if="auth.user.is_premium" class="bg-[#FF3000] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white">Pro</span>
          <button class="border-2 border-black px-3 py-1.5 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white" @click="logout">Keluar</button>
        </template>
        <template v-else>
          <router-link to="/masuk" class="swiss-nav-link text-xs font-bold uppercase tracking-widest text-black">
            <span data-label="Masuk">Masuk</span>
          </router-link>
          <router-link to="/daftar" class="border-2 border-black bg-black px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-[#FF3000] hover:border-[#FF3000]">Daftar</router-link>
        </template>
      </div>

      <button class="flex h-11 w-11 items-center justify-center border-2 border-black md:hidden" :aria-expanded="open" aria-label="Buka menu" @click="open = !open">
        <i :class="['fa-solid text-lg transition-transform duration-200', open ? 'fa-xmark rotate-90' : 'fa-bars']"></i>
      </button>
    </nav>

    <transition name="fade">
      <div v-if="open" class="border-b-4 border-black bg-white px-4 py-4 md:hidden">
        <router-link to="/" class="flex items-center justify-between border-b-2 border-black/10 px-2 py-4 text-sm font-black uppercase tracking-wide hover:bg-[#F2F2F2] hover:text-[#FF3000]"><span>Beranda</span><span class="font-mono text-xs text-[#FF3000]">01</span></router-link>
        <router-link to="/tentang" class="flex items-center justify-between border-b-2 border-black/10 px-2 py-4 text-sm font-black uppercase tracking-wide hover:bg-[#F2F2F2] hover:text-[#FF3000]"><span>Tentang Aplikasi</span><span class="font-mono text-xs text-[#FF3000]">02</span></router-link>
        <router-link to="/analisis" class="flex items-center justify-between border-b-2 border-black/10 px-2 py-4 text-sm font-black uppercase tracking-wide hover:bg-[#F2F2F2] hover:text-[#FF3000]"><span>Analisis</span><span class="font-mono text-xs text-[#FF3000]">03</span></router-link>
        <router-link to="/riwayat" class="flex items-center justify-between border-b-2 border-black/10 px-2 py-4 text-sm font-black uppercase tracking-wide hover:bg-[#F2F2F2] hover:text-[#FF3000]"><span>Riwayat</span><span class="font-mono text-xs text-[#FF3000]">04</span></router-link>
        <router-link to="/premium" class="flex items-center justify-between border-b-2 border-black/10 px-2 py-4 text-sm font-black uppercase tracking-wide hover:bg-[#F2F2F2] hover:text-[#FF3000]"><span>Premium</span><span class="font-mono text-xs text-[#FF3000]">05</span></router-link>
        <div class="mt-3 flex flex-col gap-2 border-t-2 border-black pt-4">
          <button v-if="auth.user" class="border-2 border-black px-3 py-2 text-xs font-bold uppercase tracking-widest" @click="logout">Keluar ({{ auth.user.name }})</button>
          <template v-else>
            <router-link to="/masuk" class="border-2 border-black px-3 py-2 text-center text-xs font-bold uppercase tracking-widest">Masuk</router-link>
            <router-link to="/daftar" class="border-2 border-black bg-black px-3 py-2 text-center text-xs font-bold uppercase tracking-widest text-white">Daftar</router-link>
          </template>
        </div>
      </div>
    </transition>
  </header>
</template>
