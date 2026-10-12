import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Catatan deploy:
// - base './' + hash router = kombinasi paling anti-gagal untuk hosting statis
//   (root maupun subpath, tanpa perlu setting rewrite server).
// - Penyebab layar gelap/putih sebelumnya: Tailwind CDN (JIT di browser) yang
//   tidak ikut ke hasil build; sekarang sudah Tailwind lokal via PostCSS.
export default defineConfig({
  plugins: [vue()],
  base: './',
})
