import { useState, useEffect } from 'react'
import { useSiteConfig, CONFIG_DEFAULTS } from '../../context/SiteConfigContext.jsx'
import { usuariosAdminApi, hashPassword, conceptosApi, respuestasRapidasApi, botApi, embudoApi, supabase } from '../../lib/supabase.js'
import { ROLES } from '../../lib/roles.js'
import { useEtapas, CLAVES_FIJAS, TIPOS_ETAPA } from '../../lib/embudo.js'
import Ic from '../../components/admin/dashboard/Ic.jsx'

const SECTION = {
  title: (t) => (
    <h2 className="mb-1 text-base font-bold tracking-tight text-gray-900 dark:text-white">{t}</h2>
  ),
  label: (t) => (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">{t}</label>
  ),
}

function Field({ label, type = 'text', value, onChange, placeholder, hint }) {
  return (
    <div className="mb-[18px]">
      {SECTION.label(label)}
      {type === 'textarea' ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`${CLASE_CAMPO} resize-y`}
        />
      ) : type === 'color' ? (
        <div className="flex items-center gap-2.5">
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="h-10 w-12 cursor-pointer rounded-lg border border-gray-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-800"
          />
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="#000000"
            className={`${CLASE_CAMPO} flex-1`}
          />
        </div>
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={CLASE_CAMPO}
        />
      )}
      {hint && <p className="mt-1 text-[11.5px] text-gray-400 dark:text-zinc-500">{hint}</p>}
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
    const { ok, usuarios: lista } = await usuariosAdminApi.getAll()
    setUsuarios(ok ? lista : [])
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

    const { ok, error: err } = editando
      ? await usuariosAdminApi.update(editando, payload)
      : await usuariosAdminApi.create(payload)

    if (!ok) {
      setError(err?.includes('duplicate') ? 'Ya existe un usuario con ese email.' : 'Error al guardar.')
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
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

function TabConceptos() {
  const [conceptos, setConceptos] = useState([])
  const [loading, setLoading] = useState(true)
  const [nuevo, setNuevo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [editandoNombre, setEditandoNombre] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await conceptosApi.getAll()
    setConceptos(data || [])
    setLoading(false)
  }

  async function agregar() {
    if (!nuevo.trim()) return
    setGuardando(true)
    const { data } = await conceptosApi.create({ nombre: nuevo.trim() })
    if (data) setConceptos(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setNuevo('')
    setGuardando(false)
  }

  function iniciarEdicion(c) {
    setEditandoId(c.id)
    setEditandoNombre(c.nombre)
  }

  async function guardarEdicion(id) {
    if (!editandoNombre.trim()) return
    const { data } = await conceptosApi.update(id, { nombre: editandoNombre.trim() })
    if (data) setConceptos(prev => prev.map(c => c.id === id ? data : c))
    setEditandoId(null)
  }

  async function toggleActivo(c) {
    await conceptosApi.update(c.id, { activo: !c.activo })
    setConceptos(prev => prev.map(x => x.id === c.id ? { ...x, activo: !x.activo } : x))
  }

  async function eliminar(id) {
    await conceptosApi.delete(id)
    setConceptos(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="max-w-xl">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">Conceptos de movimiento</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">Opciones que aparecen en el campo "Concepto" al registrar un movimiento en Finanzas.</p>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-4 overflow-hidden">
        {loading ? (
          <p className="p-5 text-sm text-gray-400 dark:text-zinc-600">Cargando...</p>
        ) : conceptos.length === 0 ? (
          <p className="p-5 text-sm text-gray-400 dark:text-zinc-600">Sin conceptos cargados.</p>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-zinc-800">
            {conceptos.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                {editandoId === c.id ? (
                  <input
                    type="text"
                    value={editandoNombre}
                    autoFocus
                    onChange={e => setEditandoNombre(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && guardarEdicion(c.id)}
                    onBlur={() => guardarEdicion(c.id)}
                    className="flex-1 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                ) : (
                  <button onClick={() => iniciarEdicion(c)} className="flex-1 text-left text-sm font-medium text-gray-800 dark:text-zinc-200 hover:text-brand-600 dark:hover:text-brand-400">
                    {c.nombre}
                  </button>
                )}
                <button
                  onClick={() => toggleActivo(c)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${c.activo ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500'}`}
                >
                  {c.activo ? 'Activo' : 'Inactivo'}
                </button>
                <button onClick={() => eliminar(c.id)} className="text-xs text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 font-medium shrink-0">
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={nuevo}
          onChange={e => setNuevo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && agregar()}
          placeholder="Nuevo concepto (Ej: Comisión vendedor)"
          className="flex-1 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <button
          onClick={agregar}
          disabled={guardando || !nuevo.trim()}
          className="bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          + Agregar
        </button>
      </div>
    </div>
  )
}

function TabRespuestasRapidas() {
  const [respuestas, setRespuestas] = useState([])
  const [loading, setLoading] = useState(true)
  const [nuevoTitulo, setNuevoTitulo] = useState('')
  const [nuevoTexto, setNuevoTexto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [editForm, setEditForm] = useState({ titulo: '', texto: '' })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await respuestasRapidasApi.getAll()
    setRespuestas(data || [])
    setLoading(false)
  }

  async function agregar() {
    if (!nuevoTitulo.trim() || !nuevoTexto.trim()) return
    setGuardando(true)
    const { data } = await respuestasRapidasApi.create({ titulo: nuevoTitulo.trim(), texto: nuevoTexto.trim() })
    if (data) setRespuestas(prev => [...prev, data].sort((a, b) => a.titulo.localeCompare(b.titulo)))
    setNuevoTitulo('')
    setNuevoTexto('')
    setGuardando(false)
  }

  function iniciarEdicion(r) {
    setEditandoId(r.id)
    setEditForm({ titulo: r.titulo, texto: r.texto })
  }

  async function guardarEdicion(id) {
    if (!editForm.titulo.trim() || !editForm.texto.trim()) return
    const { data } = await respuestasRapidasApi.update(id, { titulo: editForm.titulo.trim(), texto: editForm.texto.trim() })
    if (data) setRespuestas(prev => prev.map(r => r.id === id ? data : r))
    setEditandoId(null)
  }

  async function toggleActivo(r) {
    await respuestasRapidasApi.update(r.id, { activo: !r.activo })
    setRespuestas(prev => prev.map(x => x.id === r.id ? { ...x, activo: !x.activo } : x))
  }

  async function eliminar(id) {
    await respuestasRapidasApi.delete(id)
    setRespuestas(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div className="max-w-xl">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">Respuestas rápidas</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">Frases guardadas que se pueden insertar con un click al responder en CRM → WhatsApp.</p>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm mb-4 overflow-hidden">
        {loading ? (
          <p className="p-5 text-sm text-gray-400 dark:text-zinc-600">Cargando...</p>
        ) : respuestas.length === 0 ? (
          <p className="p-5 text-sm text-gray-400 dark:text-zinc-600">Sin respuestas guardadas.</p>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-zinc-800">
            {respuestas.map(r => (
              <div key={r.id} className="px-5 py-3">
                {editandoId === r.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editForm.titulo}
                      autoFocus
                      onChange={e => setEditForm(f => ({ ...f, titulo: e.target.value }))}
                      className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg px-2.5 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-400"
                    />
                    <textarea
                      rows={2}
                      value={editForm.texto}
                      onChange={e => setEditForm(f => ({ ...f, texto: e.target.value }))}
                      className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => guardarEdicion(r.id)} className="text-xs font-semibold text-brand-600 dark:text-brand-400">Guardar</button>
                      <button onClick={() => setEditandoId(null)} className="text-xs text-gray-400 dark:text-zinc-500">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <button onClick={() => iniciarEdicion(r)} className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 hover:text-brand-600 dark:hover:text-brand-400">{r.titulo}</p>
                      <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{r.texto}</p>
                    </button>
                    <button
                      onClick={() => toggleActivo(r)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${r.activo ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500'}`}
                    >
                      {r.activo ? 'Activa' : 'Inactiva'}
                    </button>
                    <button onClick={() => eliminar(r.id)} className="text-xs text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 font-medium shrink-0">
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <input
          type="text"
          value={nuevoTitulo}
          onChange={e => setNuevoTitulo(e.target.value)}
          placeholder="Título (Ej: Bienvenida)"
          className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <textarea
          rows={2}
          value={nuevoTexto}
          onChange={e => setNuevoTexto(e.target.value)}
          placeholder="Texto del mensaje..."
          className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
        />
        <button
          onClick={agregar}
          disabled={guardando || !nuevoTitulo.trim() || !nuevoTexto.trim()}
          className="w-full bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          + Agregar
        </button>
      </div>
    </div>
  )
}

const GRUPOS_BOT = [
  { id: 'paquetes', titulo: 'Paquetes', detalle: 'Cuando el contacto elige Paquetes (o escribe "paquete").' },
  { id: 'paseos', titulo: 'Paseos', detalle: 'Cuando el contacto elige Paseos (o escribe "paseo", "excursión" o "tour").' },
]

const CLASE_CAMPO = 'w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none'

function TabAsistente() {
  const [cfg, setCfg] = useState(null)
  const [reparto, setReparto] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [textos, setTextos] = useState({ saludo: '', mensaje_derivacion: '', mensaje_sin_asignar: '' })
  const [guardando, setGuardando] = useState(false)
  const [estado, setEstado] = useState(null) // 'ok' | 'error'

  useEffect(() => {
    Promise.all([botApi.getConfig(), botApi.getReparto(), usuariosAdminApi.getAll()]).then(([c, r, u]) => {
      const datos = c?.data || null
      setCfg(datos)
      if (datos) setTextos({ saludo: datos.saludo, mensaje_derivacion: datos.mensaje_derivacion, mensaje_sin_asignar: datos.mensaje_sin_asignar })
      setReparto(r?.data || [])
      setUsuarios(u?.ok ? (u.usuarios || []).filter(x => x.activo !== false) : [])
      setLoading(false)
    })
  }, [])

  async function toggleActivo() {
    const { data } = await botApi.saveConfig({ activo: !cfg.activo })
    if (data) setCfg(data)
  }

  async function guardarTextos() {
    setGuardando(true)
    const { data, error } = await botApi.saveConfig({
      saludo: textos.saludo.trim(),
      mensaje_derivacion: textos.mensaje_derivacion.trim(),
      mensaje_sin_asignar: textos.mensaje_sin_asignar.trim(),
    })
    if (data) setCfg(data)
    setEstado(error ? 'error' : 'ok')
    setGuardando(false)
    setTimeout(() => setEstado(null), 3000)
  }

  async function toggleMiembro(grupo, usuarioId) {
    const existente = reparto.find(m => m.grupo === grupo && m.usuario_id === usuarioId)
    if (existente) {
      await botApi.removeMiembro(existente.id)
      setReparto(prev => prev.filter(m => m.id !== existente.id))
    } else {
      const { data } = await botApi.addMiembro(grupo, usuarioId)
      if (data) setReparto(prev => [...prev, data])
    }
  }

  if (loading) return <p className="text-sm text-gray-400 dark:text-zinc-500">Cargando...</p>
  if (!cfg) {
    return (
      <div className="max-w-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl p-5">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Falta preparar la base de datos</p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Hay que correr la migración del asistente en Supabase (20260919160000_bot_asistente.sql) para poder configurarlo.</p>
      </div>
    )
  }

  const sinPersonas = GRUPOS_BOT.filter(g => !reparto.some(m => m.grupo === g.id))

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">Asistente automático</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
          Al primer mensaje de un contacto nuevo pregunta si busca Paquetes o Paseos y le asigna la conversación a alguien de ese grupo, en turnos.
          Deja de intervenir apenas una persona responde a mano.
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-5 flex items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Estado del asistente</p>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
            {cfg.activo ? 'Encendido: responde a los contactos nuevos.' : 'Apagado: las conversaciones llegan sin asignar, como hasta ahora.'}
          </p>
        </div>
        <button
          onClick={toggleActivo}
          className={`text-xs font-semibold px-4 py-2 rounded-full shrink-0 ${cfg.activo ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400'}`}
        >
          {cfg.activo ? 'Activo - apagar' : 'Apagado - encender'}
        </button>
      </div>

      {cfg.activo && sinPersonas.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            {sinPersonas.map(g => g.titulo).join(' y ')} no tiene personas asignadas: quien elija esa opción va a quedar sin asignar.
          </p>
        </div>
      )}

      {GRUPOS_BOT.map(g => (
        <div key={g.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-3">
            <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">{g.titulo}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{g.detalle} Se reparte en turnos entre las personas tildadas.</p>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-zinc-800 border-t border-gray-50 dark:border-zinc-800">
            {usuarios.length === 0 && <p className="px-5 py-3 text-xs text-gray-400 dark:text-zinc-500">No hay usuarios activos.</p>}
            {usuarios.map(u => (
              <label key={u.id} className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                <input
                  type="checkbox"
                  checked={reparto.some(m => m.grupo === g.id && m.usuario_id === u.id)}
                  onChange={() => toggleMiembro(g.id, u.id)}
                  className="w-4 h-4 accent-brand-600"
                />
                <span className="text-sm text-gray-800 dark:text-zinc-200">{u.nombre}</span>
                <span className="text-xs text-gray-400 dark:text-zinc-500 truncate">{u.email}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Saludo (se envía con los botones Paquetes / Paseos)</label>
          <textarea rows={2} value={textos.saludo} onChange={e => setTextos(t => ({ ...t, saludo: e.target.value }))} className={CLASE_CAMPO} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Mensaje al derivar (usa {'{nombre}'} y {'{grupo}'})</label>
          <textarea rows={2} value={textos.mensaje_derivacion} onChange={e => setTextos(t => ({ ...t, mensaje_derivacion: e.target.value }))} className={CLASE_CAMPO} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Mensaje cuando no se pudo derivar</label>
          <textarea rows={2} value={textos.mensaje_sin_asignar} onChange={e => setTextos(t => ({ ...t, mensaje_sin_asignar: e.target.value }))} className={CLASE_CAMPO} />
        </div>
        <button
          onClick={guardarTextos}
          disabled={guardando || !textos.saludo.trim() || !textos.mensaje_derivacion.trim() || !textos.mensaje_sin_asignar.trim()}
          className="w-full bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          {guardando ? 'Guardando...' : estado === 'ok' ? 'Guardado' : estado === 'error' ? 'No se pudo guardar' : 'Guardar textos'}
        </button>
      </div>
    </div>
  )
}

// ── Etapas del embudo de ventas (las columnas de Leads) ─────────────────────────
function slugEtapa(nombre) {
  return nombre.toLowerCase().normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/[\s-]+/g, '_').slice(0, 40)
}

function FilaEtapa({ etapa, indice, total, fija, cantidad, ocupado, alCambiar, alMover, alBorrar }) {
  const [nombre, setNombre] = useState(etapa.nombre)
  const [color, setColor] = useState(etapa.color)
  const [confirmando, setConfirmando] = useState(false)
  useEffect(() => { setNombre(etapa.nombre); setColor(etapa.color) }, [etapa.nombre, etapa.color])

  const boton = 'grid h-8 w-8 place-content-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 px-3 py-2.5 dark:border-white/[0.07]">
      <input
        type="color"
        value={color}
        onChange={e => setColor(e.target.value)}
        onBlur={() => { if (color !== etapa.color) alCambiar(etapa.clave, { color }) }}
        aria-label={`Color de ${etapa.nombre}`}
        className="h-9 w-10 cursor-pointer rounded-lg border border-gray-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-800"
      />
      <input
        type="text"
        value={nombre}
        onChange={e => setNombre(e.target.value)}
        onBlur={() => {
          const limpio = nombre.trim()
          if (limpio && limpio !== etapa.nombre) alCambiar(etapa.clave, { nombre: limpio })
          else setNombre(etapa.nombre)
        }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        aria-label="Nombre de la etapa"
        className={`${CLASE_CAMPO} min-w-[180px] flex-1`}
      />
      <select
        value={etapa.tipo}
        disabled={fija || ocupado}
        onChange={e => alCambiar(etapa.clave, { tipo: e.target.value })}
        aria-label="Tipo de etapa"
        title={fija ? 'El sistema usa esta etapa: su tipo no se cambia' : undefined}
        className={`${CLASE_CAMPO} w-[170px] disabled:opacity-60`}
      >
        {TIPOS_ETAPA.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
      </select>
      <span className="w-[68px] text-right text-xs tabular-nums text-gray-500 dark:text-zinc-400">
        {cantidad == null ? '' : `${cantidad} ${cantidad === 1 ? 'lead' : 'leads'}`}
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => alMover(indice, -1)} disabled={ocupado || indice === 0} title="Subir" aria-label="Subir la etapa" className={boton}>
          <Ic n="up" className="h-4 w-4" />
        </button>
        <button onClick={() => alMover(indice, 1)} disabled={ocupado || indice === total - 1} title="Bajar" aria-label="Bajar la etapa" className={boton}>
          <Ic n="down" className="h-4 w-4" />
        </button>
        {confirmando ? (
          <span className="ml-1 flex items-center gap-1.5 text-xs">
            <button onClick={() => { setConfirmando(false); alBorrar(etapa) }} className="font-bold text-red-500 hover:text-red-700 dark:text-red-400">Borrar</button>
            <button onClick={() => setConfirmando(false)} className="text-gray-400 dark:text-zinc-500">No</button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmando(true)}
            disabled={ocupado || fija}
            title={fija ? 'El sistema usa esta etapa: no se puede borrar' : 'Borrar la etapa'}
            aria-label="Borrar la etapa"
            className={boton}
          >
            <Ic n="trash" className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

function TabEmbudo() {
  const { etapas, cargando, recargar } = useEtapas()
  const [cantidades, setCantidades] = useState({})
  const [nueva, setNueva] = useState({ nombre: '', color: '#8b8fe8', tipo: 'abierta' })
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState(null) // { tipo: 'ok' | 'error', texto }

  // Cuántos leads hay en cada etapa (para no borrar una que tiene gente)
  useEffect(() => {
    if (!supabase) return
    let vivo = true
    Promise.all(etapas.map(e =>
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('estado', e.clave).then(r => [e.clave, r.count ?? 0])
    )).then(pares => { if (vivo) setCantidades(Object.fromEntries(pares)) })
    return () => { vivo = false }
  }, [etapas])

  async function ejecutar(accion, textoOk) {
    setOcupado(true)
    setMensaje(null)
    try {
      const r = await accion()
      if (r?.error) throw r.error
      await recargar()
      if (textoOk) setMensaje({ tipo: 'ok', texto: textoOk })
    } catch (e) {
      setMensaje({ tipo: 'error', texto: `No se pudo guardar: ${e?.message || 'error de conexión'}. ¿Está aplicada la migración del embudo?` })
    }
    setOcupado(false)
  }

  const cambiar = (clave, cambios) => ejecutar(() => embudoApi.update(clave, cambios))

  function mover(indice, delta) {
    const a = etapas[indice]
    const b = etapas[indice + delta]
    if (!a || !b) return
    ejecutar(async () => {
      await embudoApi.update(a.clave, { orden: b.orden })
      return embudoApi.update(b.clave, { orden: a.orden })
    })
  }

  function borrar(etapa) {
    const cant = cantidades[etapa.clave] || 0
    if (cant > 0) {
      setMensaje({ tipo: 'error', texto: `«${etapa.nombre}» tiene ${cant} ${cant === 1 ? 'lead' : 'leads'}. Movelos a otra etapa antes de borrarla.` })
      return
    }
    ejecutar(() => embudoApi.delete(etapa.clave), 'Etapa borrada')
  }

  function agregar() {
    const nombre = nueva.nombre.trim()
    if (!nombre) return
    let clave = slugEtapa(nombre) || 'etapa'
    while (etapas.some(e => e.clave === clave)) clave += '_2'
    const ultimaEnCurso = Math.max(0, ...etapas.filter(e => e.tipo !== 'perdida').map(e => e.orden))
    ejecutar(async () => {
      // La etapa nueva va antes de las perdidas, que quedan siempre al final
      for (const e of etapas.filter(x => x.tipo === 'perdida')) await embudoApi.update(e.clave, { orden: e.orden + 1 })
      return embudoApi.create({ clave, nombre, color: nueva.color, tipo: nueva.tipo, orden: ultimaEnCurso + 1 })
    }, 'Etapa agregada')
    setNueva({ nombre: '', color: nueva.color, tipo: 'abierta' })
  }

  return (
    <div className="dash-card mb-5 p-6">
      {SECTION.title('Etapas del embudo de ventas')}
      <p className="mb-5 max-w-[720px] text-xs leading-relaxed text-gray-500 dark:text-zinc-400">
        Son las columnas de Leads. Podés cambiar el nombre y el color, subir o bajar cada etapa y agregar las que necesites.
        El tipo define cómo se cuenta en el Dashboard: <strong>En curso</strong> es una consulta abierta; <strong>Ganada</strong> es una venta cerrada
        (se cuenta una sola vez, la primera vez que un lead llega a una etapa ganada, aunque después pase por otras); <strong>Perdida</strong> es
        un lead que no compró y se oculta con el filtro «Leads activos».
      </p>

      {mensaje && (
        <p className={`mb-4 rounded-xl px-4 py-2.5 text-sm font-medium ${mensaje.tipo === 'ok'
          ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400'
          : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'}`}>
          {mensaje.texto}
        </p>
      )}

      {cargando ? (
        <p className="text-sm text-gray-400 dark:text-zinc-500">Cargando etapas...</p>
      ) : (
        <div className="grid gap-2">
          {etapas.map((e, i) => (
            <FilaEtapa
              key={e.clave}
              etapa={e}
              indice={i}
              total={etapas.length}
              fija={CLAVES_FIJAS.includes(e.clave)}
              cantidad={cantidades[e.clave]}
              ocupado={ocupado}
              alCambiar={cambiar}
              alMover={mover}
              alBorrar={borrar}
            />
          ))}
        </div>
      )}

      <div className="mt-6 border-t border-gray-100 pt-5 dark:border-white/[0.07]">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">Agregar una etapa</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="color"
            value={nueva.color}
            onChange={e => setNueva(p => ({ ...p, color: e.target.value }))}
            aria-label="Color de la etapa nueva"
            className="h-9 w-10 cursor-pointer rounded-lg border border-gray-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-800"
          />
          <input
            type="text"
            value={nueva.nombre}
            onChange={e => setNueva(p => ({ ...p, nombre: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') agregar() }}
            placeholder="Nombre de la etapa"
            aria-label="Nombre de la etapa nueva"
            className={`${CLASE_CAMPO} min-w-[180px] flex-1`}
          />
          <select
            value={nueva.tipo}
            onChange={e => setNueva(p => ({ ...p, tipo: e.target.value }))}
            aria-label="Tipo de la etapa nueva"
            className={`${CLASE_CAMPO} w-[170px]`}
          >
            {TIPOS_ETAPA.filter(x => x.id !== 'perdida').map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
          <button
            onClick={agregar}
            disabled={ocupado || !nueva.nombre.trim()}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            Agregar
          </button>
        </div>
        <p className="mt-3 text-[11.5px] text-gray-400 dark:text-zinc-500">
          Nueva consulta, Ya pagó y Perdido son etapas fijas: el sistema las usa (ahí entran los leads nuevos, ahí pasa un lead al convertirlo en cliente y ahí van los que no compraron). Se les puede cambiar el nombre y el color, pero no borrarlas.
        </p>
      </div>
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

  const TABS = [
    { id: 'sitio', label: 'Sitio público' },
    { id: 'accesos', label: 'Accesos' },
    { id: 'conceptos', label: 'Conceptos' },
    { id: 'respuestas', label: 'Respuestas rápidas' },
    { id: 'asistente', label: 'Asistente' },
    { id: 'embudo', label: 'Embudo' },
  ]

  return (
    <div className={tab === 'sitio' ? 'max-w-[720px]' : 'max-w-[960px]'}>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Configuración</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">Sitio público, accesos, roles y conceptos del panel.</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 inline-flex max-w-full flex-wrap gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-white/[0.06]" role="tablist">
        {TABS.map(x => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              tab === x.id
                ? 'bg-gray-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {tab === 'accesos' && <TabAccesos />}
      {tab === 'conceptos' && <TabConceptos />}
      {tab === 'respuestas' && <TabRespuestasRapidas />}
      {tab === 'asistente' && <TabAsistente />}
      {tab === 'embudo' && <TabEmbudo />}

      {tab === 'sitio' && (
        <>
      {/* 1. Hero */}
      <div className="dash-card mb-5 p-6">
        <div className="mb-1">{SECTION.title('Banner principal (Hero)')}</div>
        <p className="mb-5 text-xs text-gray-400 dark:text-zinc-500">
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
      <div className="dash-card mb-5 p-6">
        <div className="mb-5">{SECTION.title('Paleta de colores')}</div>
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
      <div className="dash-card mb-5 p-6">
        <div className="mb-5">{SECTION.title('Contacto y redes')}</div>
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
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-brand-600 px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-500 dark:hover:bg-brand-600"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>

        <button
          onClick={handleReset}
          className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Restablecer defaults
        </button>

        {status === 'ok' && (
          <span className="text-sm font-semibold text-green-600 dark:text-green-400">Guardado correctamente</span>
        )}
        {status === 'error' && (
          <span className="text-sm font-semibold text-red-600 dark:text-red-400">Error: ¿Supabase conectado?</span>
        )}
      </div>

      {/* Nota Supabase */}
      <div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 px-[18px] py-3.5 dark:border-amber-900 dark:bg-amber-950/30">
        <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
          <strong>¿Los cambios no persisten?</strong> Necesitás conectar Supabase. Corré el siguiente SQL en el <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="font-semibold underline">SQL Editor de Supabase</a>:<br />
          <code className="mt-2 block whitespace-pre rounded-lg bg-zinc-900 px-3.5 py-2.5 text-xs text-amber-100">{`create table if not exists site_config (
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
