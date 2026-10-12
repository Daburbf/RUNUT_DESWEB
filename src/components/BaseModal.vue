<script setup>
import { watch, onBeforeUnmount } from 'vue'
const props = defineProps({ open: Boolean, title: String })
const emit = defineEmits(['close'])
const onKey = (e) => e.key === 'Escape' && emit('close')
watch(() => props.open, (v) => (v ? addEventListener('keydown', onKey) : removeEventListener('keydown', onKey)))
onBeforeUnmount(() => removeEventListener('keydown', onKey))
</script>

<template>
  <teleport to="body">
    <transition name="fade">
      <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" @click.self="emit('close')">
        <div role="dialog" aria-modal="true" class="w-full max-w-md border-4 border-black bg-white p-6 sm:p-8">
          <div class="mb-4 flex items-start justify-between gap-4 border-b-2 border-black pb-4">
            <h2 class="text-lg font-black uppercase tracking-tight">{{ title }}</h2>
            <button class="flex h-11 w-11 items-center justify-center border-2 border-black bg-white transition-colors duration-150 hover:bg-black hover:text-white" aria-label="Tutup" @click="emit('close')"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <slot />
        </div>
      </div>
    </transition>
  </teleport>
</template>
