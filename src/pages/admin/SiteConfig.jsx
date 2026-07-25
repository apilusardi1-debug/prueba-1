import { useState, useEffect } from 'react'
import { useSiteConfig, CONFIG_DEFAULTS } from '../../context/SiteConfigContext.jsx'
import { usuariosAdminApi, hashPassword } from '../../lib/supabase.js'
import { ROLES } from '../../lib/roles.js'

const SECTION = {
  title: (t) => (
    <h2 style={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, fontSize: '1rem', color: '#1C1208', marginBottom: 4 }}>{t}</h2>
  ),
  label: (t) => (
    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t}</label>
  ),
}

function Field({ label, type = 'text', value, onChange, placeholder, hint }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {SECTION.label(label)}
      {type === 'textarea' ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{ width: '100%', border: '1.5px solid #e8d09a', borderRadius: 10, padding: '10px 14px', fontSize: '0.9rem', color: '#1C1208', resize: 'vertical', outline: 'none', background: 'white', boxSizing: 'border-box' }}
          onFocus={e => e.target.style.borderColor = '#b07420'}
          onBlur={e => e.target.style.borderColor = '#e8d09a'}
        />
      ) : type === 'color' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{ width: 48, height: 40, border: '1.5px solid #e8d09a', borderRadius: 8, padding: 2, cursor: 'pointer', background: 'white' }}
          />
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="#000000"
            style={{ flex: 1, border: '1.5px solid #e8d09a', borderRadius: 10, padding: '10px 14px', fontSize: '0.9rem', color: '#1C1208', outline: 'none', background: 'white' }}
            onFocus={e => e.target.style.borderColor = '#b07420'}
            onBlur={e => e.target.style.borderColor = '#e8d09a'}
          />
        </div>
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ width: '100%', border: '1.5px solid #e8d09a', borderRadius: 10, padding: '10px 14px', fontSize: '0.9rem', color: '#1C1208', outline: 'none', background: 'white', boxSizing: 'border-box' }}
          onFocus={e => e.target.style.borderColor = '#b07420'}
          onBlur={e => e.target.style.borderColor = '#e8d09a'}
        />
      )}
      {hint && <p style={{ fontSize: '0.72rem', color: '#999', marginTop: 4 }}>{hint}</p>}
    </div>
  )
}

const FORM_USUARIO_VACIO = { nombre: '', email: '', password: '', rol: 'operativo', activo: true }

function TabAccesos() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_USUARIO_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [eliminandoId, setEliminandoId] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await usuariosAdminApi.getAll()
    setUsuarios(data || [])
    setLoading(false)
  }

  function abrirNuevo() {
    setForm(FORM_USUARIO_VACIO)
    setEditando(null)
    setError('')
    setMostrarForm(true)
  }

  function abrirEditar(u) {
    setForm({ nombre: u.nombre, email: u.email, password: '', rol: u.rol, activo: u.activo })
    setEditando(u.id)
    setError('')
    setMostrarForm(true)
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.email.trim()) return
    if (!editando && !form.password) return setError('La contraseña es obligatoria para un usuario nuevo.')
    setGuardando(true)
    setError('')
    const payload = {
      nombre: form.nombre.trim(),
      email: form.email.trim().toLowerCase(),
      rol: form.rol,
      activo: form.activo,
    }
    if (form.password) payload.password_hash = await hashPassword(form.password)

    const { error: err } = editando
      ? await usuariosAdminApi.update(editando, payload)
      : await usuariosAdminApi.create(payload)

    if (err) {
      setError(err.message?.includes('duplicate') ? 'Ya existe un usuario con ese email.' : 'Error al guardar.')
    } else {
      setMostrarForm(false)
      cargar()
    }
    setGuardando(false)
  }

  async function toggleActivo(u) {
    await usuariosAdminApi.update(u.id, { activo: !u.activo })
    setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, activo: !x.activo } : x))
  }

  async function eliminar(id) {
    await usuariosAdminApi.delete(id)
    setUsuarios(prev => prev.filter(u => u.id !== id))
    setEliminandoId(null)
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">Accesos al panel</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">Creá usuarios, asignales un rol y activá o desactivá su acceso.</p>
        </div>
        <button
          onClick={abrirNuevo}
          className="bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          + Nuevo usuario
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-6 overflow-hidden">
        {loading ? (
          <p className="p-5 text-sm text-gray-400 dark:text-zinc-600">Cargando...</p>
        ) : usuarios.length === 0 ? (
          <p className="p-5 text-sm text-gray-400 dark:text-zinc-600">Sin usuarios cargados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-800/60 text-gray-500 dark:text-zinc-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">Nombre</th>
                <th className="px-5 py-3 text-left">Email</th>
                <th className="px-5 py-3 text-left">Rol</th>
                <th className="px-5 py-3 text-left">Estado</th>
                <th className="px-5 py-3 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
              {usuarios.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                  <td className="px-5 py-3 font-medium text-gray-900 dark:text-zinc-100">{u.nombre}</td>
                  <td className="px-5 py-3 text-gray-500 dark:text-zinc-400">{u.email}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-400">
                      {ROLES[u.rol]?.label || u.rol}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleActivo(u)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${u.activo ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500'}`}
                    >
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => abrirEditar(u)} className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium">
                        Editar
                      </button>
                      {eliminandoId === u.id ? (
                        <span className="flex items-center gap-1.5 text-xs">
                          <button onClick={() => eliminar(u.id)} className="text-red-500 dark:text-red-400 font-semibold">Sí</button>
                          <span className="text-gray-300 dark:text-zinc-700">/</span>
                          <button onClick={() => setEliminandoId(null)} className="text-gray-400 dark:text-zinc-500">No</button>
                        </span>
                      ) : (
                        <button onClick={() => setEliminandoId(u.id)} className="text-xs text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 font-medium">
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-5">
        <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-3">Qué puede ver cada rol</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {Object.entries(ROLES).map(([id, r]) => (
            <div key={id} className="bg-gray-50 dark:bg-zinc-800/60 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200 mb-1">{r.label}</p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">{r.descripcion}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {mostrarForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setMostrarForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl dark:shadow-black/40 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg text-gray-900 dark:text-zinc-100">{editando ? 'Editar usuario' : 'Nuevo usuario'}</h2>
              <button onClick={() => setMostrarForm(false)} className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 text-xl">✕</button>
            </div>

            {error && <p className="text-xs text-red-500 dark:text-red-400 mb-4 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-lg">{error}</p>}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Nombre</label>
                <input type="text" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="Ej: Abril" autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="nombre@dreamstour.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">
                  Contraseña {editando && <span className="text-gray-400 dark:text-zinc-500 font-normal">(dejar en blanco para no cambiarla)</span>}
                </label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="••••••••" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Rol</label>
                <select value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                  {Object.entries(ROLES).map(([id, r]) => <option key={id} value={id}>{r.label}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300">
                <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))}
                  className="rounded border-gray-300 dark:border-zinc-600 dark:bg-zinc-800 text-brand-600 focus:ring-brand-500" />
                Usuario activo
              </label>
            </div>

            <button onClick={guardar} disabled={guardando}
              className="mt-5 w-full bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
              {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear usuario'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SiteConfig() {
  const { config, saveConfig, loading } = useSiteConfig()
  const [form, setForm] = useState(config)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null) // 'ok' | 'error'
  const [tab, setTab] = useState('sitio')

  // Sincroniza el form cuando carga la config de Supabase
  useEffect(() => {
    if (!loading) setForm(config)
  }, [loading])

  function set(key) {
    return (val) => setForm(prev => ({ ...prev, [key]: val }))
  }

  async function handleSave() {
    setSaving(true)
    setStatus(null)
    const result = await saveConfig(form)
    setSaving(false)
    setStatus(result.ok ? 'ok' : 'error')
    setTimeout(() => setStatus(null), 3000)
  }

  function handleReset() {
    setForm(CONFIG_DEFAULTS)
  }

  const card = { background: 'white', borderRadius: 16, border: '1px solid #e8d09a', padding: '24px 28px', marginBottom: 20 }

  return (
    <div style={{ maxWidth: tab === 'accesos' ? 960 : 720, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.2em', color: '#b07420', textTransform: 'uppercase', marginBottom: 6 }}>Panel interno</p>
        <h1 style={{ fontFamily: '"Playfair Display", serif', fontWeight: 900, fontSize: '1.8rem', color: '#1C1208' }}>Configuración</h1>
        <p style={{ fontSize: '0.85rem', color: '#888', marginTop: 4 }}>Sitio público, accesos y roles del panel.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[{ id: 'sitio', label: '🖼️ Sitio público' }, { id: 'accesos', label: '🔐 Accesos' }].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '9px 18px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
              border: tab === t.id ? 'none' : '1.5px solid #e8d09a',
              background: tab === t.id ? '#1C1208' : 'white',
              color: tab === t.id ? '#f9f3e3' : '#8a581e',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'accesos' && <TabAccesos />}

      {tab === 'sitio' && (
        <>
      {/* 1. Hero */}
      <div style={card}>
        <div style={{ marginBottom: 4 }}>{SECTION.title('🖼️  Banner principal (Hero)')}</div>
        <p style={{ fontSize: '0.78rem', color: '#999', marginBottom: 20 }}>
          El título y subtítulo del banner se traducen automáticamente según el idioma del visitante. Podés cambiar la foto de fondo y el texto del botón.
        </p>
        <Field label="Texto del botón" value={form.hero_cta} onChange={set('hero_cta')} placeholder="Ver paquetes" />
        <Field
          label="URL de la imagen de fondo"
          value={form.hero_imagen}
          onChange={set('hero_imagen')}
          placeholder="https://images.unsplash.com/..."
          hint="Usá una URL de Unsplash o subí la imagen a un servicio como Cloudinary."
        />
        {form.hero_imagen && (
          <div style={{ marginTop: 8, borderRadius: 10, overflow: 'hidden', height: 120, position: 'relative' }}>
            <img src={form.hero_imagen} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem', textAlign: 'center', padding: '0 16px' }}>Preview de imagen</p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Colores */}
      <div style={card}>
        <div style={{ marginBottom: 20 }}>{SECTION.title('🎨  Paleta de colores')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field
            label="Color primario (botones, precios)"
            type="color"
            value={form.color_primario}
            onChange={set('color_primario')}
            hint="Dorado/bronce por defecto"
          />
          <Field
            label="Color acento (bordes, estrellas)"
            type="color"
            value={form.color_acento}
            onChange={set('color_acento')}
            hint="Dorado claro por defecto"
          />
        </div>
        {/* Preview de botones */}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <span style={{ background: form.color_primario, color: 'white', padding: '8px 20px', borderRadius: 999, fontSize: '0.82rem', fontWeight: 700 }}>Ver paquetes →</span>
          <span style={{ border: `1.5px solid ${form.color_acento}`, color: form.color_primario, padding: '8px 20px', borderRadius: 999, fontSize: '0.82rem', fontWeight: 600 }}>Consultar</span>
        </div>
      </div>

      {/* 3. Contacto */}
      <div style={card}>
        <div style={{ marginBottom: 20 }}>{SECTION.title('📞  Contacto y redes')}</div>
        <Field
          label="Número de WhatsApp"
          value={form.whatsapp}
          onChange={set('whatsapp')}
          placeholder="5491100000000"
          hint="Sin + ni espacios. Ej: 5491155667788 (54 = Argentina, 11 = CABA)"
        />
        <Field
          label="URL de Instagram"
          value={form.instagram_url}
          onChange={set('instagram_url')}
          placeholder="https://instagram.com/dreamstour"
        />
      </div>

      {/* Botones */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ background: '#1C1208', color: '#f9f3e3', fontWeight: 700, padding: '12px 28px', borderRadius: 12, border: 'none', fontSize: '0.9rem', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, transition: 'background 0.15s' }}
          onMouseEnter={e => { if (!saving) e.target.style.background = '#b07420' }}
          onMouseLeave={e => { e.target.style.background = '#1C1208' }}
        >
          {saving ? '⏳ Guardando...' : '💾 Guardar cambios'}
        </button>

        <button
          onClick={handleReset}
          style={{ background: 'white', color: '#888', fontWeight: 600, padding: '12px 20px', borderRadius: 12, border: '1.5px solid #e8d09a', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          Restablecer defaults
        </button>

        {status === 'ok' && (
          <span style={{ color: '#2e7d32', fontSize: '0.85rem', fontWeight: 600 }}>✓ Guardado correctamente</span>
        )}
        {status === 'error' && (
          <span style={{ color: '#c0392b', fontSize: '0.85rem', fontWeight: 600 }}>✕ Error — ¿Supabase conectado?</span>
        )}
      </div>

      {/* Nota Supabase */}
      <div style={{ marginTop: 28, background: '#fdf8ee', border: '1px solid #e8d09a', borderRadius: 12, padding: '14px 18px' }}>
        <p style={{ fontSize: '0.78rem', color: '#8a581e', lineHeight: 1.6 }}>
          <strong>⚠️  ¿Los cambios no persisten?</strong> Necesitás conectar Supabase. Corré el siguiente SQL en el <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" style={{ color: '#b07420', fontWeight: 600 }}>SQL Editor de Supabase</a>:<br />
          <code style={{ display: 'block', marginTop: 8, background: '#1C1208', color: '#f2e4c0', padding: '10px 14px', borderRadius: 8, fontSize: '0.75rem', whiteSpace: 'pre' }}>{`create table if not exists site_config (
  id integer primary key default 1,
  hero_titulo text,
  hero_subtitulo text,
  hero_cta text,
  hero_imagen text,
  color_primario text,
  color_acento text,
  whatsapp text,
  instagram_url text,
  updated_at timestamptz default now()
);
insert into site_config (id) values (1) on conflict do nothing;`}</code>
        </p>
      </div>
        </>
      )}
    </div>
  )
}
