import { useState, useEffect, useRef } from 'react'
import { excursionesApi, normalizarExcursion, subirImagen } from '../../lib/supabase.js'
import { formatPrecio } from '../../data/mockData.js'

const EMPTY = {
  nombre: '', destino: '', categoria: 'excursiones', precio: '',
  cupos: '', duracion: '', dificultad: '', descripcion: '', imagen: '', fechas: '', incluye: '', opcionales: '',
  hora_salida: '8:00 AM', hora_regreso: '6:00 PM', opcionales_imagen: ''
}

export default function Excursiones() {
  const [excursiones, setExcursiones] = useState([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [subiendoImg, setSubiendoImg] = useState(false)
  const [subiendoOpcionalesImg, setSubiendoOpcionalesImg] = useState(false)
  const [editando, setEditando] = useState(null) // null | 'nuevo' | id
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [aBorrar, setABorrar] = useState(null) // excursión pendiente de confirmar eliminación
  const fileRef = useRef()
  const opcionalesFileRef = useRef()

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
      hora_salida: ex.hora_salida || '8:00 AM',
      hora_regreso: ex.hora_regreso || '6:00 PM',
      precio: String(ex.precio || ''),
      cupos: String(ex.cupos || ''),
      imagen: ex.imagen || '',
      fechas: (ex.fechas || []).join(', '),
      incluye: (ex.incluye || []).join(', '),
      opcionales: (ex.opcionales || []).join(', '),
      opcionales_imagen: ex.opcionales_imagen || '',
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

  async function handleOpcionalesImagen(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendoOpcionalesImg(true)
    const { url, error } = await subirImagen(archivo)
    if (error) setError('Error al subir imagen: ' + error)
    else setForm(p => ({ ...p, opcionales_imagen: url }))
    setSubiendoOpcionalesImg(false)
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
      hora_salida: form.hora_salida.trim() || '8:00 AM',
      hora_regreso: form.hora_regreso.trim() || '6:00 PM',
      descripcion: form.descripcion.trim(),
      imagen: form.imagen.trim(),
      precio: parseInt(form.precio) || 0,
      cupos,
      cupos_disponibles: cupos,
      fechas: form.fechas.split(',').map(f => f.trim()).filter(Boolean),
      incluye: form.incluye.split(',').map(f => f.trim()).filter(Boolean),
      opcionales: form.opcionales.split(',').map(f => f.trim()).filter(Boolean),
      opcionales_imagen: form.opcionales_imagen.trim(),
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

  async function eliminar() {
    if (!aBorrar) return
    try {
      await excursionesApi.delete(aBorrar.id)
      setExcursiones(prev => prev.filter(e => e.id !== aBorrar.id))
    } catch (_) {}
    setABorrar(null)
  }

  if (loading) return <div className="p-8 text-gray-400 dark:text-zinc-600">Cargando excursiones...</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Excursiones</h1>
          <p className="text-gray-400 dark:text-zinc-500 text-sm">{excursiones.length} excursiones activas</p>
        </div>
        <button
          onClick={abrirNuevo}
          className="bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
        >
          + Nueva excursión
        </button>
      </div>

      {excursiones.length === 0 && (
        <div className="text-center py-20 text-gray-400 dark:text-zinc-600">
          <p className="text-4xl mb-3">🌊</p>
          <p>No hay excursiones. Creá la primera.</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {excursiones.map((ex) => (
          <div key={ex.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm dark:shadow-black/20 overflow-hidden">
            {ex.imagen && (
              <img src={ex.imagen} alt={ex.nombre} className="w-full h-24 object-cover" />
            )}
            <div className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-[10px] text-brand-600 dark:text-brand-400 font-semibold uppercase tracking-wider truncate">{ex.destino}</p>
                <span className="text-[10px] text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full shrink-0">{ex.categoria}</span>
              </div>
              <h3 className="font-bold text-sm text-gray-900 dark:text-zinc-100 mb-1 truncate">{ex.nombre}</h3>
              <p className="text-[10px] text-gray-400 dark:text-zinc-500 mb-2">{ex.duracion} · {ex.dificultad}</p>
              <div className="flex items-center justify-between mb-2 gap-1">
                <span className="font-bold text-xs text-brand-700 dark:text-brand-400 truncate">{formatPrecio(ex.precio, ex.moneda)}</span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${ex.cuposDisponibles <= 3 ? 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400' : 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400'}`}>
                  {ex.cuposDisponibles}/{ex.cupos}
                </span>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => abrirEditar(ex)}
                  className="flex-1 border border-gray-200 dark:border-zinc-700 hover:border-brand-400 dark:hover:border-brand-500 text-gray-600 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 py-1 rounded-lg text-[11px] font-medium transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => setABorrar(ex)}
                  className="border border-red-100 dark:border-red-900 hover:border-red-300 dark:hover:border-red-700 text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400 px-2 py-1 rounded-lg text-[11px] transition-colors"
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
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl dark:shadow-black/40 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg mb-5 text-gray-900 dark:text-zinc-100">{editando === 'nuevo' ? 'Nueva excursión' : 'Editar excursión'}</h2>

            {error && <p className="text-xs text-red-500 dark:text-red-400 mb-4 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-lg">{error}</p>}

            <div className="space-y-3 text-sm">
              {/* Imagen */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Imagen</label>
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
                    className="w-full border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-lg py-6 text-gray-400 dark:text-zinc-500 text-sm hover:border-brand-400 dark:hover:border-brand-500 hover:text-brand-500 dark:hover:text-brand-400 transition-colors disabled:opacity-50"
                  >
                    {subiendoImg ? '⏳ Subiendo...' : '📷 Subir imagen desde tu dispositivo'}
                  </button>
                )}
              </div>

              {/* Archivo de opcionales (menu/actividades) para el link de WhatsApp */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Archivo de opcionales (imagen o PDF con el menú/actividades, se manda como link por WhatsApp)</label>
                <input ref={opcionalesFileRef} type="file" accept="image/*,application/pdf" onChange={handleOpcionalesImagen} className="hidden" />
                {form.opcionales_imagen ? (
                  <div className="relative">
                    {form.opcionales_imagen.toLowerCase().endsWith('.pdf') ? (
                      <div className="w-full h-32 flex items-center justify-center gap-2 rounded-lg bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 text-sm">
                        📄 PDF cargado
                      </div>
                    ) : (
                      <img src={form.opcionales_imagen} alt="preview opcionales" className="w-full h-32 object-cover rounded-lg" />
                    )}
                    <button
                      type="button"
                      onClick={() => { setForm(p => ({ ...p, opcionales_imagen: '' })); if (opcionalesFileRef.current) opcionalesFileRef.current.value = '' }}
                      className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg"
                    >✕ Quitar</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => opcionalesFileRef.current?.click()}
                    disabled={subiendoOpcionalesImg}
                    className="w-full border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-lg py-6 text-gray-400 dark:text-zinc-500 text-sm hover:border-brand-400 dark:hover:border-brand-500 hover:text-brand-500 dark:hover:text-brand-400 transition-colors disabled:opacity-50"
                  >
                    {subiendoOpcionalesImg ? '⏳ Subiendo...' : '📎 Subir imagen o PDF de opcionales'}
                  </button>
                )}
              </div>

              {[
                { key: 'nombre', label: 'Nombre *' },
                { key: 'destino', label: 'Destino *' },
                { key: 'duracion', label: 'Duración (ej: 6 horas)' },
                { key: 'dificultad', label: 'Dificultad (ej: Baja, Media, Alta)' },
                { key: 'hora_salida', label: 'Hora de salida (ej: 7:00 AM)' },
                { key: 'hora_regreso', label: 'Hora de regreso estimada (ej: 6:00 PM)' },
                { key: 'precio', label: 'Precio (R$)' },
                { key: 'cupos', label: 'Cupos totales' },
                { key: 'fechas', label: 'Fechas (separadas por coma: 2025-08-10, 2025-08-17)' },
                { key: 'incluye', label: 'Incluye (separado por coma: Vuelo ida y vuelta, Hotel, Desayuno)' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">{label}</label>
                  <input
                    type="text"
                    value={form[key]}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Categoría</label>
                <select
                  value={form.categoria}
                  onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  <option value="excursiones">Excursiones</option>
                  <option value="paquetes">Paquetes aéreos</option>
                  <option value="traslados">Traslados</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">Descripción</label>
                <textarea
                  rows={3}
                  value={form.descripcion}
                  onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditando(null)} className="flex-1 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando} className="flex-1 bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar eliminación */}
      {aBorrar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={() => setABorrar(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl dark:shadow-black/40 w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center mb-4 mx-auto">
              <svg className="w-6 h-6 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-center font-bold text-base text-gray-900 dark:text-zinc-100 mb-1">¿Eliminar excursión?</h3>
            <p className="text-center text-sm text-gray-400 dark:text-zinc-500 mb-6">
              "{aBorrar.nombre}" se va a eliminar y no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setABorrar(null)} className="flex-1 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                Cancelar
              </button>
              <button onClick={eliminar} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
