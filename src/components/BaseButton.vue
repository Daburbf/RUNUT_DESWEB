<script setup>
import { computed } from 'vue'
const props = defineProps({
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'md' },
  to: { type: [String, Object], default: null },
  type: { type: String, default: 'button' },
  disabled: Boolean,
})
// Dokumentasi: tombol Swiss = persegi (rounded-none), border-2 hitam,
// primer hitam-putih, hover inversi merah. Huruf kapital tebal.
const cls = computed(() => [
  'swiss-snap inline-flex items-center justify-center gap-2 rounded-none border-2 border-black font-bold uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3000] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 min-h-[44px]',
  { sm: 'h-10 px-4 text-xs', md: 'h-12 px-6 text-sm', lg: 'h-16 px-8 text-sm' }[props.size],
  {
    primary: 'bg-black text-white hover:bg-[#FF3000] hover:border-[#FF3000] hover:text-white',
    secondary: 'bg-white text-black hover:bg-black hover:text-white',
    accent: 'bg-[#FF3000] border-[#FF3000] text-white hover:bg-black hover:border-black',
    danger: 'bg-white text-black hover:bg-[#FF3000] hover:border-[#FF3000] hover:text-white',
    ghost: 'bg-transparent border-transparent hover:border-black',
  }[props.variant],
])
</script>

<template>
  <router-link v-if="to" :to="to" :class="cls"><slot /></router-link>
  <button v-else :type="type" :disabled="disabled" :class="cls"><slot /></button>
</template>
