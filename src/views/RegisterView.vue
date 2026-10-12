<script setup>
import { reactive, ref } from 'vue'
import AuthCard from '../components/AuthCard.vue'
import FormInput from '../components/FormInput.vue'
import BaseButton from '../components/BaseButton.vue'
import { auth } from '../store/auth'

const f = reactive({ name: '', email: '', password: '', confirm: '' })
const err = reactive({})
const ok = ref('')
async function submit() {
  Object.keys(err).forEach((k) => delete err[k])
  ok.value = ''
  if (f.name.trim().length < 2) err.name = 'Namanya kependekan, minimal 2 huruf.'
  if (!/^\S+@\S+\.\S+$/.test(f.email)) err.email = 'Emailnya kayaknya salah ketik deh.'
  if (f.password.length < 8) err.password = 'Kata sandinya minimal 8 karakter ya.'
  if (f.password !== f.confirm) err.confirm = 'Konfirmasinya nggak sama, cek lagi.'
  if (Object.keys(err).length) return
  try {
    await auth.register({ name: f.name.trim(), email: f.email.trim(), password: f.password })
    ok.value = 'Akunnya jadi.'
    window.location.hash = '#/analisis'
  } catch (e) { err.email = e.message }
}
</script>
<template>
  <AuthCard title="Bikin akun" subtitle="Gratis, nggak sampai semenit.">
    <form class="space-y-4" @submit.prevent="submit">
      <FormInput v-model="f.name" label="Nama" icon="fa-user" :error="err.name" />
      <FormInput v-model="f.email" label="Email" type="email" icon="fa-envelope" :error="err.email" />
      <FormInput v-model="f.password" label="Kata sandi" type="password" icon="fa-lock" :error="err.password" />
      <FormInput v-model="f.confirm" label="Konfirmasi kata sandi" type="password" icon="fa-lock" :error="err.confirm" />
      <p v-if="ok" class="border-2 border-black bg-[#F2F2F2] px-3 py-2 text-sm font-bold uppercase tracking-wide"><span class="text-[#FF3000]">■</span> {{ ok }}</p>
      <BaseButton type="submit" class="w-full">Daftar</BaseButton>
    </form>
    <p class="mt-6 border-t-2 border-black pt-6 text-center text-sm">Sudah punya akun? <router-link to="/masuk" class="font-bold uppercase tracking-wide underline decoration-[#FF3000] decoration-2 underline-offset-4 hover:text-[#FF3000]">Masuk</router-link></p>
  </AuthCard>
</template>
