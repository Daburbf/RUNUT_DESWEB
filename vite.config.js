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
  // Profil browser/scratch di .tmp/ pernah bikin watcher mati (EBUSY) saat
  // Edge memegang berkasnya. Diabaikan permanen; node_modules/.git ditulis
  // eksplisit supaya tidak bergantung pada perilaku merge bawaan Vite.
  server: { watch: { ignored: ['**/node_modules/**', '**/.git/**', '**/.tmp/**'] } },
})
