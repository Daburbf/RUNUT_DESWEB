<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthCard from '../components/AuthCard.vue'
import FormInput from '../components/FormInput.vue'
import BaseButton from '../components/BaseButton.vue'
import { auth } from '../store/auth'

const email = ref(''), password = ref(''), error = ref(''), ok = ref('')
const router = useRouter(), route = useRoute()
function submit() {
  error.value = ''; ok.value = ''
  if (!email.value || !password.value) return (error.value = 'Email sama kata sandinya diisi dulu.')
  try { auth.login(email.value.trim(), password.value); ok.value = `Halo, ${auth.user.name}! Bentaran ya…`; router.push(route.query.redirect || '/analisis') }
  catch (e) { error.value = e.message }
}
</script>
<template>
  <AuthCard title="Masuk" subtitle="Balik lagi? Silakan masuk.">
    <form class="space-y-4" @submit.prevent="submit">
      <FormInput v-model="email" label="Email" type="email" icon="fa-envelope" placeholder="nama@email.com" />
      <FormInput v-model="password" label="Kata sandi" type="password" icon="fa-lock" placeholder="••••••••" />
      <p v-if="error" class="border-2 border-black bg-black px-3 py-2 text-sm font-bold uppercase tracking-wide text-white"><span class="text-[#FF3000]">■</span> {{ error }}</p>
      <p v-if="ok" class="border-2 border-black bg-[#F2F2F2] px-3 py-2 text-sm font-bold uppercase tracking-wide"><span class="text-[#FF3000]">■</span> {{ ok }}</p>
      <BaseButton type="submit" class="w-full">Masuk</BaseButton>
    </form>
    <p class="mt-6 border-t-2 border-black pt-6 text-center text-sm">Belum punya akun? <router-link to="/daftar" class="font-bold uppercase tracking-wide underline decoration-[#FF3000] decoration-2 underline-offset-4 hover:text-[#FF3000]">Daftar</router-link></p>
  </AuthCard>
</template>
