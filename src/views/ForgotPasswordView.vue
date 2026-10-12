<script setup>
import { ref } from 'vue'
import AuthCard from '../components/AuthCard.vue'
import FormInput from '../components/FormInput.vue'
import BaseButton from '../components/BaseButton.vue'
import { api } from '../utils/api'

const email = ref('')
const msg = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  msg.value = ''
  if (!/^\S+@\S+\.\S+$/.test(email.value)) { error.value = 'Emailnya kayaknya salah ketik deh.'; return }
  busy.value = true
  try {
    const r = await api('/api/auth/forgot-password', { method: 'POST', body: { email: email.value.trim() } })
    msg.value = r.message || 'Tautan reset dikirim.'
  } catch (e) { error.value = e.message }
  finally { busy.value = false }
}
</script>
<template>
  <AuthCard title="Lupa sandi" subtitle="Tautan reset berlaku 30 menit.">
    <form class="space-y-4" @submit.prevent="submit">
      <FormInput v-model="email" label="Email" type="email" icon="fa-envelope" placeholder="nama@email.com" />
      <p v-if="error" class="border-2 border-black bg-black px-3 py-2 text-sm font-bold text-white"><span class="text-[#FF3000]">■</span> {{ error }}</p>
      <p v-if="msg" class="border-2 border-black bg-[#F2F2F2] px-3 py-2 text-sm font-bold"><span class="text-[#FF3000]">■</span> {{ msg }}</p>
      <BaseButton type="submit" class="w-full" :disabled="busy">{{ busy ? 'Mengirim…' : 'Kirim tautan reset' }}</BaseButton>
    </form>
    <p class="mt-6 border-t-2 border-black pt-6 text-center text-sm"><router-link to="/masuk" class="font-bold uppercase tracking-wide underline decoration-[#FF3000] decoration-2 underline-offset-4">Kembali masuk</router-link></p>
  </AuthCard>
</template>
