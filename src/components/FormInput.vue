<script setup>
defineProps({ modelValue: String, label: String, type: { type: String, default: 'text' }, icon: String, error: String, placeholder: String })
defineEmits(['update:modelValue'])
</script>

<template>
  <!-- Dokumentasi: input Swiss = kotak persegi border-2, fokus merah. Tanpa glow. -->
  <label class="block">
    <span class="mb-1.5 block text-xs font-bold uppercase tracking-widest">{{ label }}</span>
    <div class="relative">
      <i v-if="icon" :class="['fa-solid absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-black/40', icon]"></i>
      <input :type="type" :value="modelValue" :placeholder="placeholder"
        @input="$emit('update:modelValue', $event.target.value)"
        :class="['h-12 w-full rounded-none border-2 bg-white px-3.5 text-sm text-black placeholder:text-black/30 transition-colors duration-150 focus:outline-none focus:border-[#FF3000]', icon && 'pl-10', error ? 'border-[#FF3000]' : 'border-black']" />
    </div>
    <span v-if="error" class="mt-1 block bg-black px-2 py-1 text-xs font-bold uppercase tracking-wide text-white">{{ error }}</span>
  </label>
</template>
