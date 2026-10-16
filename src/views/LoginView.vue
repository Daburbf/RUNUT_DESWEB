<script setup>
import { ref } from 'vue'
import AuthCard from '../components/AuthCard.vue'
import FormInput from '../components/FormInput.vue'
import BaseButton from '../components/BaseButton.vue'
import { auth } from '../store/auth'

const email = ref(''), password = ref(''), error = ref('')
async function submit() {
  error.value = ''
  if (!email.value || !password.value) { error.value = 'Isi email dan kata sandi terlebih dahulu.'; return }
  try {
    await auth.login(email.value.trim(), password.value)
  } catch (e) { error.value = e.message; return }
  const dest = new URLSearchParams(window.location.hash.split('?')[1] || '').get('redirect') || '/analisis'
  window.location.hash = '#' + dest
}
</script>
<template>
  <AuthCard title="Masuk" subtitle="Balik lagi? Silakan masuk.">
    <form class="space-y-4" @submit.prevent="submit">
      <FormInput v-model="email" label="Email" type="email" icon="fa-envelope" placeholder="nama@email.com" />
      <FormInput v-model="password" label="Kata sandi" type="password" icon="fa-lock" placeholder="••••••••" />
      <p v-if="error" class="border-2 border-black bg-black px-3 py-2 text-sm font-bold uppercase tracking-wide text-white"><span class="text-[#FF3000]">■</span> {{ error }}</p>
      <BaseButton type="submit" class="w-full">Masuk</BaseButton>
    </form>
    <div class="mt-6 space-y-2 border-t-2 border-black pt-6 text-center text-sm">
      <p><router-link to="/lupa-sandi" class="font-bold uppercase tracking-wide underline decoration-[#FF3000] decoration-2 underline-offset-4 hover:text-[#FF3000]">Lupa kata sandi?</router-link></p>
      <p>Belum punya akun? <router-link to="/daftar" class="font-bold uppercase tracking-wide underline decoration-[#FF3000] decoration-2 underline-offset-4 hover:text-[#FF3000]">Daftar</router-link></p>
    </div>
  </AuthCard>
</template>
