import { useState, useEffect } from 'react'
import { vendedoresApi } from '../../lib/supabase.js'

const EMPTY = { nombre: '', whatsapp: '' }

export default function Vendedores() {
  const [vendedores, setVendedores] = useState([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [editando, setEditando] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await vendedoresApi.getAll()
    setVendedores(data || [])
    setCargando(false)
  }

  function abrirNuevo() {
    setForm(EMPTY)
    setEditando(null)
    setMostrarForm(true)
  }

  function abrirEditar(v) {
    setForm({ nombre: v.nombre, whatsapp: v.whatsapp })
    setEditando(v.id)
    setMostrarForm(true)
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.whatsapp.trim()) return
    if (editando) {
      await vendedoresApi.update(editando, form)
    } else {
      await vendedoresApi.create(form)
    }
    setMostrarForm(false)
    cargar()
  }

  async function toggleActivo(v) {
    await vendedoresApi.update(v.id, { activo: !v.activo })
    cargar()
  }

  const filtrados = vendedores.filter((v) =>
    v.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    v.whatsapp.includes(busqueda)
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendedores</h1>
          <p className="text-gray-400 text-sm">{vendedores.length} vendedores registrados</p>
        </div>
        <button
          onClick={abrirNuevo}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          + Agregar vendedor
        </button>
      </div>

      <div className="mb-5">
        <input
          type="text"
          placeholder="Buscar por nombre o WhatsApp..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full max-w-md border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>

      {cargando ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">💼</p>
          <p>No hay vendedores registrados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtrados.map((v) => (
            <div key={v.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">💼 {v.nombre}</p>
                <p className="text-xs text-gray-400 mt-1">{v.whatsapp}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button onClick={() => toggleActivo(v)} className={`text-xs font-medium px-2.5 py-1 rounded-full ${v.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                  {v.activo ? 'Activo' : 'Inactivo'}
                </button>
                <div className="flex items-center gap-3">
                  <a href={`https://wa.me/${v.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:text-green-600">💬</a>
                  <button onClick={() => abrirEditar(v)} className="text-brand-500 hover:text-brand-700 text-xs font-medium">Editar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {mostrarForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setMostrarForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">{editando ? 'Editar vendedor' : 'Nuevo vendedor'}</h2>
              <button onClick={() => setMostrarForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Nombre completo</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="Ej: Sofía López"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">WhatsApp (con código de país)</label>
                <input
                  type="text"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="Ej: 5491112345678"
                />
              </div>
            </div>
            <button
              onClick={guardar}
              className="mt-5 w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              {editando ? 'Guardar cambios' : 'Agregar vendedor'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
