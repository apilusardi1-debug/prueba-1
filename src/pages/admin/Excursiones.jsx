import { useState, useEffect, useRef } from 'react'
import { excursionesApi, normalizarExcursion, subirImagen } from '../../lib/supabase.js'
import { formatPrecio } from '../../data/mockData.js'

const EMPTY = {
  nombre: '', destino: '', categoria: 'excursiones', precio: '',
  cupos: '', duracion: '', dificultad: '', descripcion: '', imagen: '', fechas: '', incluye: ''
}

export default function Excursiones() {
  const [excursiones, setExcursiones] = useState([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [subiendoImg, setSubiendoImg] = useState(false)
  const [editando, setEditando] = useState(null) // null | 'nuevo' | id
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)
    try {
      const { data, error } = await excursionesApi.getAll()
      if (!error && data) setExcursiones(data.map(normalizarExcursion))
    } catch (_) {}
    setLoading(false)
  }

  function abrirNuevo() {
    setForm(EMPTY)
    setError(null)
    setEditando('nuevo')
  }

  function abrirEditar(ex) {
    setForm({
      nombre: ex.nombre || '',
      destino: ex.destino || '',
      categoria: ex.categoria || 'excursiones',
      duracion: ex.duracion || '',
      dificultad: ex.dificultad || '',
      precio: String(ex.precio || ''),
      cupos: String(ex.cupos || ''),
      imagen: ex.imagen || '',
      fechas: (ex.fechas || []).join(', '),
      incluye: (ex.incluye || []).join(', '),
      descripcion: ex.descripcion || '',
    })
    setError(null)
    setEditando(ex.id)
  }

  async function handleImagen(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendoImg(true)
    const { url, error } = await subirImagen(archivo)
    if (error) setError('Error al subir imagen: ' + error)
    else setForm(p => ({ ...p, imagen: url }))
    setSubiendoImg(false)
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.destino.trim()) {
      setError('Nombre y destino son obligatorios.')
      return
    }
    setGuardando(true)
    setError(null)
    const cupos = parseInt(form.cupos) || 0
    const datos = {
      nombre: form.nombre.trim(),
      destino: form.destino.trim(),
      categoria: form.categoria,
      duracion: form.duracion.trim(),
      dificultad: form.dificultad.trim(),
      descripcion: form.descripcion.trim(),
      imagen: form.imagen.trim(),
      precio: parseInt(form.precio) || 0,
      cupos,
      cupos_disponibles: cupos,
      fechas: form.fechas.split(',').map(f => f.trim()).filter(Boolean),
      incluye: form.incluye.split(',').map(f => f.trim()).filter(Boolean),
      activa: true,
    }

    try {
      if (editando === 'nuevo') {
        const { data, error } = await excursionesApi.create(datos)
        if (error) throw error
        if (data) setExcursiones(prev => [...prev, normalizarExcursion(data)])
      } else {
        const { data, error } = await excursionesApi.update(editando, datos)
        if (error) throw error
        if (data) setExcursiones(prev => prev.map(e => e.id === editando ? normalizarExcursion(data) : e))
      }
      setEditando(null)
    } catch (e) {
      setError('Error al guardar: ' + (e.message || 'intentá de nuevo'))
    }
    setGuardando(false)
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta excursión? Esta acción no se puede deshacer.')) return
    try {
      await excursionesApi.delete(id)
      setExcursiones(prev => prev.filter(e => e.id !== id))
    } catch (_) {}
  }

  if (loading) return <div className="p-8 text-gray-400">Cargando excursiones...</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Excursiones</h1>
          <p className="text-gray-400 text-sm">{excursiones.length} excursiones activas</p>
        </div>
        <button
          onClick={abrirNuevo}
          className="bg-brand-600 hover:bg-brand-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
        >
          + Nueva excursión
        </button>
      </div>

      {excursiones.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🌊</p>
          <p>No hay excursiones. Creá la primera.</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {excursiones.map((ex) => (
          <div key={ex.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {ex.imagen && (
              <img src={ex.imagen} alt={ex.nombre} className="w-full h-36 object-cover" />
            )}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs text-brand-600 font-semibold uppercase tracking-wider">{ex.destino}</p>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{ex.categoria}</span>
              </div>
              <h3 className="font-bold text-gray-900 mb-1">{ex.nombre}</h3>
              <p className="text-xs text-gray-400 mb-3">{ex.duracion} · {ex.dificultad}</p>
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-brand-700">{formatPrecio(ex.precio, ex.moneda)}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ex.cuposDisponibles <= 3 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                  {ex.cuposDisponibles}/{ex.cupos} cupos
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => abrirEditar(ex)}
                  className="flex-1 border border-gray-200 hover:border-brand-400 text-gray-600 hover:text-brand-600 py-1.5 rounded-lg text-xs font-medium transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => eliminar(ex.id)}
                  className="border border-red-100 hover:border-red-300 text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg text-xs transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {editando !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={() => setEditando(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg mb-5">{editando === 'nuevo' ? 'Nueva excursión' : 'Editar excursión'}</h2>

            {error && <p className="text-xs text-red-500 mb-4 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="space-y-3 text-sm">
              {/* Imagen */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Imagen</label>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImagen} className="hidden" />
                {form.imagen ? (
                  <div className="relative">
                    <img src={form.imagen} alt="preview" className="w-full h-32 object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => { setForm(p => ({ ...p, imagen: '' })); if (fileRef.current) fileRef.current.value = '' }}
                      className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg"
                    >✕ Quitar</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={subiendoImg}
                    className="w-full border-2 border-dashed border-gray-200 rounded-lg py-6 text-gray-400 text-sm hover:border-brand-400 hover:text-brand-500 transition-colors disabled:opacity-50"
                  >
                    {subiendoImg ? '⏳ Subiendo...' : '📷 Subir imagen desde tu dispositivo'}
                  </button>
                )}
              </div>

              {[
                { key: 'nombre', label: 'Nombre *' },
                { key: 'destino', label: 'Destino *' },
                { key: 'duracion', label: 'Duración (ej: 6 horas)' },
                { key: 'dificultad', label: 'Dificultad (ej: Baja, Media, Alta)' },
                { key: 'precio', label: 'Precio (USD)' },
                { key: 'cupos', label: 'Cupos totales' },
                { key: 'fechas', label: 'Fechas (separadas por coma: 2025-08-10, 2025-08-17)' },
                { key: 'incluye', label: 'Incluye (separado por coma: Vuelo ida y vuelta, Hotel, Desayuno)' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input
                    type="text"
                    value={form[key]}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
                <select
                  value={form.categoria}
                  onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  <option value="excursiones">Excursiones</option>
                  <option value="paquetes">Paquetes aéreos</option>
                  <option value="traslados">Traslados</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                <textarea
                  rows={3}
                  value={form.descripcion}
                  onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditando(null)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando} className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
