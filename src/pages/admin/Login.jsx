import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usuariosAdminApi, hashPassword } from '../../lib/supabase.js'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const hash = await hashPassword(password)
    const { ok, usuario } = await usuariosAdminApi.login(email.trim().toLowerCase(), hash)

    if (ok && usuario) {
      localStorage.setItem('admin_session', JSON.stringify({ email: usuario.email, nombre: usuario.nombre, role: usuario.rol }))
      navigate('/admin')
    } else {
      setError('Email o contraseña incorrectos.')
    }
    setLoading(false)
  }

  // El acceso siempre va en oscuro (clase "dark" propia) y con la paleta gris del panel
  const campo = 'w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-400'

  return (
    <div
      className="dark admin-login flex min-h-screen items-center justify-center bg-zinc-950 px-4"
      style={{ backgroundImage: 'radial-gradient(900px 520px at 50% -10%, rgba(255,255,255,0.06), transparent 65%)' }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/logo-panel.png" alt="Dream Tours" className="mx-auto mb-4 h-auto w-40" />
          <h1 className="text-2xl font-bold text-white">Panel interno</h1>
          <p className="mt-1 text-sm text-zinc-400">Acceso para el equipo de Dream Tours</p>
        </div>

        <form onSubmit={handleSubmit} className="dash-card space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={campo}
              placeholder="tu@email.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={campo}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand-600 py-2.5 font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
