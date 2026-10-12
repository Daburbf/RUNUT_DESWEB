<script setup>
import { ref, watch } from 'vue'
import { CATEGORIES } from '../utils/analyzer'
const props = defineProps({ issue: Object, selected: Boolean })
const emit = defineEmits(['accept', 'reject', 'pick'])
const draft = ref(props.issue.suggestion)
const editing = ref(false)
watch(() => props.issue.suggestion, (v) => (draft.value = v))
</script>
<template>
  <!-- Dokumentasi: kartu saran Swiss — border-2, header nomor merah + label,
       teks lama dicoret, saran = blok hitam. Plus berputar saat terpilih. -->
  <article @click="emit('pick', issue.id)"
    :class="['swiss-snap cursor-pointer border-2 p-4', selected ? 'border-black bg-black text-white' : 'border-black bg-white hover:bg-[#F2F2F2]']">
    <div class="mb-2 flex items-center gap-2 text-xs">
      <span class="bg-[#FF3000] px-1.5 py-0.5 font-mono font-bold text-white">{{ CATEGORIES[issue.type].num }}</span>
      <i :class="['fa-solid', CATEGORIES[issue.type].icon]"></i>
      <span class="font-bold uppercase tracking-widest">{{ CATEGORIES[issue.type].label }}</span>
      <i :class="['fa-solid fa-plus ml-auto transition-transform duration-200', selected && 'rotate-90 text-[#FF3000]']"></i>
    </div>
    <p class="text-sm">{{ issue.message }}</p>
    <div class="mt-3 space-y-1.5 border-t-2 pt-3 text-sm" :class="selected ? 'border-white/30' : 'border-black/10'">
      <p class="text-[#FF3000] line-through decoration-2">{{ issue.text }}</p>
      <input v-if="editing" v-model="draft" @click.stop class="w-full border-2 border-[#FF3000] bg-white px-2.5 py-1.5 text-black focus:outline-none" />
      <p v-else class="border-2 border-black bg-black px-2 py-1 font-medium text-white" :class="selected && '!border-white'">{{ draft }}</p>
    </div>
    <div class="mt-4 flex flex-wrap gap-2">
      <button class="min-h-[44px] border-2 border-black bg-black px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-[#FF3000] hover:border-[#FF3000]" :class="selected && '!border-white'" @click.stop="emit('accept', issue.id, draft)"><i class="fa-solid fa-check mr-1"></i>Terima</button>
      <button class="min-h-[44px] border-2 border-black bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-black hover:bg-black hover:text-white" :class="selected && '!border-white !bg-transparent !text-white hover:!bg-white hover:!text-black'" @click.stop="editing = !editing"><i class="fa-solid fa-pen mr-1"></i>{{ editing ? 'Selesai' : 'Sesuaikan' }}</button>
      <button class="min-h-[44px] border-2 border-black bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-black hover:bg-[#FF3000] hover:border-[#FF3000] hover:text-white" :class="selected && '!border-white !bg-transparent !text-white hover:!bg-[#FF3000] hover:!border-[#FF3000]'" @click.stop="emit('reject', issue.id)"><i class="fa-solid fa-xmark mr-1"></i>Tolak</button>
    </div>
  </article>
</template>
