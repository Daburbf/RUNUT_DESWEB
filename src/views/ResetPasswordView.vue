<script setup>
import { ref, onMounted } from 'vue'
import AuthCard from '../components/AuthCard.vue'
import FormInput from '../components/FormInput.vue'
import BaseButton from '../components/BaseButton.vue'
import { api } from '../utils/api'

const token = ref('')
const password = ref('')
const confirm = ref('')
const msg = ref('')
const error = ref('')
const busy = ref(false)

onMounted(() => {
  token.value = new URLSearchParams(window.location.hash.split('?')[1] || '').get('token') || ''
  if (!token.value) error.value = 'Tautan reset tidak valid (token hilang). Minta tautan baru di halaman lupa sandi.'
})

async function submit() {
  error.value = ''
  msg.value = ''
  if (password.value.length < 8) { error.value = 'Kata sandi baru minimal 8 karakter.'; return }
  if (password.value !== confirm.value) { error.value = 'Konfirmasinya nggak sama.'; return }
  busy.value = true
  try {
    const r = await api('/api/auth/reset-password', { method: 'POST', body: { token: token.value, password: password.value } })
    msg.value = r.message || 'Berhasil. Silakan masuk.'
  } catch (e) { error.value = e.message }
  finally { busy.value = false }
}
</script>
<template>
  <AuthCard title="Atur ulang sandi" subtitle="Pilih kata sandi baru.">
    <form class="space-y-4" @submit.prevent="submit">
      <FormInput v-model="password" label="Kata sandi baru" type="password" icon="fa-lock" placeholder="••••••••" />
      <FormInput v-model="confirm" label="Konfirmasi" type="password" icon="fa-lock" placeholder="••••••••" />
      <p v-if="error" class="border-2 border-black bg-black px-3 py-2 text-sm font-bold text-white"><span class="text-[#FF3000]">■</span> {{ error }}</p>
      <p v-if="msg" class="border-2 border-black bg-[#F2F2F2] px-3 py-2 text-sm font-bold"><span class="text-[#FF3000]">■</span> {{ msg }}</p>
      <BaseButton type="submit" class="w-full" :disabled="busy || !token">{{ busy ? 'Menyimpan…' : 'Simpan sandi baru' }}</BaseButton>
    </form>
    <p class="mt-6 border-t-2 border-black pt-6 text-center text-sm"><router-link to="/masuk" class="font-bold uppercase tracking-wide underline decoration-[#FF3000] decoration-2 underline-offset-4">Masuk</router-link></p>
  </AuthCard>
</template>
