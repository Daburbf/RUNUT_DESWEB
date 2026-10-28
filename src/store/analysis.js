// Job analisis global. Proses dipegang store, bukan komponen, supaya pindah
// halaman (tab lain di aplikasi) tidak membatalkan permintaan atau menghapus
// hasil yang sudah didapat. ponytail: hanya tahan navigasi dalam satu tab;
// muat ulang halaman tetap menghentikan job — tambah penyimpanan di server
// kalau nanti butuh lanjut setelah reload.
import { reactive } from 'vue'
import { api } from '../utils/api'
import { documents } from './documents'

export const job = reactive({
  status: 'idle', // idle | running | done | error
  elapsed: 0,
  startedAt: 0,
  error: '',
  documentId: null,
  title: '',
  // Draf ikut disimpan agar teks yang sudah ditempel tidak hilang saat
  // pengguna berpindah halaman lalu kembali.
  draft: { title: '', text: '' },
})

let timer = null

function stopTick() {
  if (timer) clearInterval(timer)
  timer = null
}

export async function startJob({ text, title, file }) {
  if (job.status === 'running') return null
  job.status = 'running'
  job.error = ''
  job.documentId = null
  job.title = title || ''
  job.elapsed = 0
  job.startedAt = Date.now()
  stopTick()
  timer = setInterval(() => { job.elapsed = Math.floor((Date.now() - job.startedAt) / 1000) }, 1000)
  try {
    let data
    if (file) {
      const form = new FormData()
      form.append('file', file)
      if (title?.trim()) form.append('title', title.trim())
      form.append('ai_consent', 'true')
      data = await api('/api/analysis', { method: 'POST', form })
    } else {
      data = await api('/api/analysis', {
        method: 'POST',
        body: { text, title: title?.trim() || 'Dokumen tanpa judul', ai_consent: true },
      })
    }
    documents.setCurrent(data)
    job.documentId = data.document.id
    job.status = 'done'
    return data
  } catch (e) {
    job.error = e.message || 'Analisis gagal. Coba lagi.'
    job.status = 'error'
    return null
  } finally {
    stopTick()
    job.elapsed = Math.floor((Date.now() - job.startedAt) / 1000)
  }
}

export function clearJob() {
  stopTick()
  job.status = 'idle'
  job.error = ''
  job.documentId = null
  job.elapsed = 0
}
