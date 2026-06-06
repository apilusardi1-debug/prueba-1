import { useState } from 'react'
import { excursiones as initialExcursiones, formatPrecio } from '../../data/mockData.js'

const EMPTY = { nombre: '', destino: '', categoria: '', precio: '', cupos: '', duracion: '', dificultad: '', descripcion: '', imagen: '', fechas: '' }

export default function Excursiones() {
  const [excursiones, setExcursiones] = useState(initialExcursiones)
  const [editando, setEditando] = useState(null) // null | 'nuevo' | id
  const [form, setForm] = useState(EMPTY)

  function abrirNuevo() {
    setForm(EMPTY)
    setEditando('nuevo')
  }

  function abrirEditar(ex) {
    setForm({ ...ex, fechas: ex.fechas.join(', '), precio: String(ex.precio), cupos: String(ex.cupos) })
    setEditando(ex.id)
  }

  function guardar() {
    const datos = {
      ...form,
      precio: parseInt(form.precio) || 0,
      cupos: parseInt(form.cupos) || 0,
      cuposDisponibles: parseInt(form.cupos) || 0,
      fechas: form.fechas.split(',').map((f) => f.trim()).filter(Boolean),
      incluye: [],
    }
    if (editando === 'nuevo') {
      setExcursiones((prev) => [...prev, { ...datos, id: Date.now().toString() }])
    } else {
      setExcursiones((prev) => prev.map((e) => e.id === editando ? { ...e, ...datos } : e))
    }
    setEditando(null)
  }

  function eliminar(id) {
    if (confirm('¿Eliminar esta excursión?')) {
      setExcursiones((prev) => prev.filter((e) => e.id !== id))
    }
  }

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

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {excursiones.map((ex) => (
          <div key={ex.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {ex.imagen && (
              <img src={ex.imagen} alt={ex.nombre} className="w-full h-36 object-cover" />
            )}
            <div className="p-4">
              <p className="text-xs text-brand-600 font-semibold uppercase tracking-wider mb-1">{ex.destino}</p>
              <h3 className="font-bold text-gray-900 mb-1">{ex.nombre}</h3>
              <p className="text-xs text-gray-400 mb-3">{ex.duracion} · {ex.dificultad}</p>
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-brand-700">{formatPrecio(ex.precio)}</span>
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

      {/* Modal de edición */}
      {editando !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={() => setEditando(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg mb-5">{editando === 'nuevo' ? 'Nueva excursión' : 'Editar excursión'}</h2>
            <div className="space-y-3 text-sm">
              {[
                { key: 'nombre', label: 'Nombre *' },
                { key: 'destino', label: 'Destino *' },
                { key: 'categoria', label: 'Categoría' },
                { key: 'duracion', label: 'Duración (ej: 8 horas)' },
                { key: 'dificultad', label: 'Dificultad' },
                { key: 'precio', label: 'Precio (ARS)' },
                { key: 'cupos', label: 'Cupos totales' },
                { key: 'imagen', label: 'URL de imagen' },
                { key: 'fechas', label: 'Fechas (separadas por coma: 2024-08-10, 2024-08-17)' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input
                    type="text"
                    value={form[key]}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                <textarea
                  rows={3}
                  value={form.descripcion}
                  onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditando(null)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={guardar} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
