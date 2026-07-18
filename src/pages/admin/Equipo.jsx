import { useState, useEffect } from 'react'
import { choferesApi, guiasApi, vendedoresApi } from '../../lib/supabase.js'

const TABS = [
  { id: 'choferes',   label: 'Choferes',   icono: '🚗', api: choferesApi },
  { id: 'guias',      label: 'Guías',      icono: '🧭', api: guiasApi },
  { id: 'vendedores', label: 'Vendedores', icono: '💼', api: vendedoresApi },
]

const EMPTY = { nombre: '', whatsapp: '', codigo_referido: '' }

const LABELS = { choferes: 'chofer', guias: 'guía', vendedores: 'vendedor' }

export default function Equipo() {
  const [tabActiva, setTabActiva] = useState('choferes')
  const [datos, setDatos] = useState({ choferes: [], guias: [], vendedores: [] })
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [editando, setEditando] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const tab = TABS.find((t) => t.id === tabActiva)

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setCargando(true)
    const [rc, rg, rv] = await Promise.all([
      choferesApi.getAll(),
      guiasApi.getAll(),
      vendedoresApi.getAll(),
    ])
    setDatos({
      choferes:   rc.data || [],
      guias:      rg.data || [],
      vendedores: rv.data || [],
    })
    setCargando(false)
  }

  async function cargarTab() {
    const { data } = await tab.api.getAll()
    setDatos((prev) => ({ ...prev, [tabActiva]: data || [] }))
  }

  function abrirNuevo() {
    setForm(EMPTY)
    setEditando(null)
    setMostrarForm(true)
  }

  function abrirEditar(item) {
    setForm({ nombre: item.nombre, whatsapp: item.whatsapp, codigo_referido: item.codigo_referido || '' })
    setEditando(item.id)
    setMostrarForm(true)
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.whatsapp.trim()) return
    setGuardando(true)
    if (editando) {
      await tab.api.update(editando, form)
    } else {
      await tab.api.create(form)
    }
    setGuardando(false)
    setMostrarForm(false)
    cargarTab()
  }

  async function toggleActivo(item) {
    await tab.api.update(item.id, { activo: !item.activo })
    cargarTab()
  }

  const lista = datos[tabActiva] || []
  const filtrados = lista.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.whatsapp.includes(busqueda)
  )

  return (
    <div className="p-8">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Equipo</h1>
          <p className="text-gray-400 dark:text-zinc-500 text-sm">Gestioná choferes, guías y vendedores</p>
        </div>
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTabActiva(t.id); abrirNuevo() }}
              className={`text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors border ${
                tabActiva === t.id
                  ? 'bg-brand-500 dark:bg-brand-600 hover:bg-brand-600 dark:hover:bg-brand-700 text-white border-transparent'
                  : 'bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700'
              }`}
            >
              + Agregar {LABELS[t.id]}
            </button>
          ))}
        </div>
      </div>

      {/* Pestañas */}
      <div className="flex gap-2 mb-6 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-1.5 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTabActiva(t.id); setBusqueda('') }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tabActiva === t.id
                ? 'bg-brand-600 dark:bg-brand-500 text-white shadow-sm'
                : 'text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800'
            }`}
          >
            {t.icono} {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tabActiva === t.id ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500'}`}>
              {datos[t.id]?.length || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Buscador */}
      <div className="mb-5">
        <input
          type="text"
          placeholder={`Buscar ${tab.label.toLowerCase()} por nombre o WhatsApp...`}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full max-w-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>

      {/* Tarjetas */}
      {cargando ? (
        <div className="text-center py-12 text-gray-400 dark:text-zinc-600">Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-zinc-600">
          <p className="text-4xl mb-3">{tab.icono}</p>
          <p className="font-medium">No hay {tab.label.toLowerCase()} registrados.</p>
          <button onClick={abrirNuevo} className="mt-4 text-sm text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium underline">
            Agregar el primero
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtrados.map((item) => (
            <div key={item.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm px-5 py-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-zinc-100">{tab.icono} {item.nombre}</p>
                  <a
                    href={`https://wa.me/${item.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium mt-0.5 inline-flex items-center gap-1"
                  >
                    💬 {item.whatsapp}
                  </a>
                  {tabActiva === 'vendedores' && item.codigo_referido && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 bg-brand-50 dark:bg-brand-950/40 border border-brand-100 dark:border-brand-800 rounded-lg px-2.5 py-1">
                      <span className="text-xs text-gray-400 dark:text-zinc-500">Código:</span>
                      <span className="text-xs font-bold font-mono text-brand-700 dark:text-brand-400 tracking-wider">{item.codigo_referido}</span>
                    </div>
                  )}
                  {tabActiva === 'vendedores' && !item.codigo_referido && (
                    <p className="text-xs text-orange-400 dark:text-orange-400 mt-1">Sin código asignado</p>
                  )}
                </div>
                <button
                  onClick={() => toggleActivo(item)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${item.activo ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500'}`}
                >
                  {item.activo ? 'Activo' : 'Inactivo'}
                </button>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-zinc-800">
                <button
                  onClick={() => abrirEditar(item)}
                  className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium"
                >
                  ✏️ Editar
                </button>
                <a
                  href={`https://wa.me/${item.whatsapp}?text=${encodeURIComponent(`Hola ${item.nombre} 👋`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-green-500 hover:bg-green-600 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  Abrir WhatsApp
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal agregar/editar */}
      {mostrarForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setMostrarForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl dark:shadow-black/40 p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg text-gray-900 dark:text-zinc-100">
                {editando ? `Editar ${LABELS[tabActiva]}` : `Nuevo ${LABELS[tabActiva]}`}
              </h2>
              <button onClick={() => setMostrarForm(false)} className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">Nombre completo</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="Ej: Carlos Méndez"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">WhatsApp</label>
                <input
                  type="text"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="Ej: 5491112345678"
                />
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Con código de país, sin +, sin espacios. Ej: 5491112345678</p>
              </div>
              {tabActiva === 'vendedores' && (
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">
                    Código de referido <span className="text-gray-400 dark:text-zinc-500 font-normal">(único por vendedor)</span>
                  </label>
                  <input
                    type="text"
                    value={form.codigo_referido}
                    onChange={(e) => setForm({ ...form, codigo_referido: e.target.value.toUpperCase().replace(/\s/g, '') })}
                    className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-4 py-2.5 text-sm font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-brand-400"
                    placeholder="Ej: JUAN01"
                    maxLength={20}
                  />
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Sin espacios. Se convierte a mayúsculas automáticamente.</p>
                </div>
              )}
            </div>
            <button
              onClick={guardar}
              disabled={guardando}
              className="mt-5 w-full bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : `Agregar ${LABELS[tabActiva]}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
