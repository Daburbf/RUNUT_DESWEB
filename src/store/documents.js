// Dokumen & riwayat pemeriksaan per pengguna
import { auth } from './auth'

const storage = (mode) => {
  try {
    const s = mode === 'session' ? sessionStorage : localStorage
    s.setItem('__t', '1'); s.removeItem('__t')
    return s
  } catch { return null }
}
const mem = new Map()
const fallback = (mode) => ({
  getItem: (k) => (mem.has(mode + k) ? mem.get(mode + k) : null),
  setItem: (k, v) => mem.set(mode + k, String(v)),
  removeItem: (k) => mem.delete(mode + k),
})
const ls = () => storage('local') ?? fallback('local')
const ss = () => storage('session') ?? fallback('session')

const key = () => `runut_docs_${auth.user?.id}`
const all = () => { try { return JSON.parse(ls().getItem(key())) ?? [] } catch { return [] } }
const persist = (docs) => { try { ls().setItem(key(), JSON.stringify(docs)) } catch {} }

// Draf aktif (dokumen yang sedang dianalisis)
let current = null

export const documents = {
  list: () => all().sort((a, b) => b.updated_at - a.updated_at),
  get: (id) => all().find((d) => d.id === id),
  setCurrent(doc) { current = doc; try { ss().setItem('runut_current', JSON.stringify(doc)) } catch {} },
  getCurrent() { try { return current ?? JSON.parse(ss().getItem('runut_current') || 'null') } catch { return current } },
  save(doc) {
    const docs = all().filter((d) => d.id !== doc.id)
    docs.push({ ...doc, updated_at: Date.now() }); persist(docs)
  },
  remove(id) { persist(all().filter((d) => d.id !== id)) },
}
