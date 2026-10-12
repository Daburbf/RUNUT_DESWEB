// Penyimpanan sesi & pengguna (simulasi backend menggunakan localStorage)
import { reactive } from 'vue'

const USERS_KEY = 'runut_users'
const SESSION_KEY = 'runut_session'

const storage = (mode) => {
  try {
    const s = mode === 'session' ? sessionStorage : localStorage
    // Tes tulis: sebagian hosting/preview memblokir storage (privacy mode,
    // iframe sandbox, dsb.) -> tanpa try/catch, error ini meruntuhkan
    // seluruh app saat modul diimpor = layar putih/blank total.
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

const load = (k, d) => { try { return JSON.parse(ls().getItem(k)) ?? d } catch { return d } }
const save = (k, v) => { try { ls().setItem(k, JSON.stringify(v)) } catch {} }

// Hash sederhana (simulasi hashing kata sandi)
const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return 'h' + (h >>> 0).toString(16) }

export const auth = reactive({
  user: load(SESSION_KEY, null),

  register({ name, email, password }) {
    const users = load(USERS_KEY, [])
    if (users.some((u) => u.email === email)) throw new Error('Email ini udah kepakai, coba yang lain.')
    const user = { id: Date.now(), name, email, password_hash: hash(password) }
    users.push(user); save(USERS_KEY, users)
    return user
  },
  login(email, password) {
    const user = load(USERS_KEY, []).find((u) => u.email === email && u.password_hash === hash(password))
    if (!user) throw new Error('Email atau kata sandinya salah, coba cek lagi.')
    this.user = { id: user.id, name: user.name, email: user.email }
    save(SESSION_KEY, this.user)
  },
  logout() { this.user = null; try { ls().removeItem(SESSION_KEY) } catch {} },
})
