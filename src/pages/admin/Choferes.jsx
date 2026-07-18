import { useState, useEffect } from 'react'
import { choferesApi } from '../../lib/supabase.js'

const EMPTY = { nombre: '', whatsapp: '' }

export default function Choferes() {
  const [choferes, setChoferes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [editando, setEditando] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await choferesApi.getAll()
    setChoferes(data || [])
    setCargando(false)
  }

  function abrirNuevo() {
    setForm(EMPTY)
    setEditando(null)
    setMostrarForm(true)
  }

  function abrirEditar(c) {
    setForm({ nombre: c.nombre, whatsapp: c.whatsapp })
    setEditando(c.id)
    setMostrarForm(true)
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.whatsapp.trim()) return
    if (editando) {
      await choferesApi.update(editando, form)
    } else {
      await choferesApi.create(form)
    }
    setMostrarForm(false)
    cargar()
  }

  async function toggleActivo(c) {
    await choferesApi.update(c.id, { activo: !c.activo })
    cargar()
  }

  const filtrados = choferes.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.whatsapp.includes(busqueda)
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Choferes</h1>
          <p className="text-gray-400 dark:text-zinc-500 text-sm">{choferes.length} choferes registrados</p>
        </div>
        <button
          onClick={abrirNuevo}
          className="bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          + Agregar chofer
        </button>
      </div>

      <div className="mb-5">
        <input
          type="text"
          placeholder="Buscar por nombre o WhatsApp..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full max-w-md border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>

      {cargando ? (
        <div className="text-center py-12 text-gray-400 dark:text-zinc-500">Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-zinc-500">
          <p className="text-3xl mb-2">🚗</p>
          <p>No hay choferes registrados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtrados.map((c) => (
            <div key={c.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm dark:shadow-black/20 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900 dark:text-zinc-100">🚗 {c.nombre}</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">{c.whatsapp}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button onClick={() => toggleActivo(c)} className={`text-xs font-medium px-2.5 py-1 rounded-full ${c.activo ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500'}`}>
                  {c.activo ? 'Activo' : 'Inactivo'}
                </button>
                <div className="flex items-center gap-3">
                  <a href={`https://wa.me/${c.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:text-green-600">💬</a>
                  <button onClick={() => abrirEditar(c)} className="text-brand-500 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 text-xs font-medium">Editar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {mostrarForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setMostrarForm(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl dark:shadow-black/40 p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg text-gray-900 dark:text-zinc-100">{editando ? 'Editar chofer' : 'Nuevo chofer'}</h2>
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
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">WhatsApp (con código de país)</label>
                <input
                  type="text"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="Ej: 5491112345678"
                />
              </div>
            </div>
            <button
              onClick={guardar}
              className="mt-5 w-full bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              {editando ? 'Guardar cambios' : 'Agregar chofer'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
