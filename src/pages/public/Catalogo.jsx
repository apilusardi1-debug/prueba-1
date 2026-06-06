import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { excursiones, categorias, formatPrecio } from '../../data/mockData.js'

export default function Catalogo() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [busqueda, setBusqueda] = useState('')
  const categoriaActiva = searchParams.get('categoria') || ''

  const filtradas = excursiones.filter((ex) => {
    const matchCat = !categoriaActiva || ex.categoria === categoriaActiva
    const matchBusq = !busqueda || ex.nombre.toLowerCase().includes(busqueda.toLowerCase()) || ex.destino.toLowerCase().includes(busqueda.toLowerCase())
    return matchCat && matchBusq
  })

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">Todas las excursiones</h1>
      <p className="text-gray-500 mb-8">Explorá nuestras opciones y reservá tu aventura</p>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <input
          type="text"
          placeholder="Buscar por nombre o destino..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSearchParams({})}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${!categoriaActiva ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-400'}`}
          >
            Todas
          </button>
          {categorias.map((cat) => (
            <button
              key={cat}
              onClick={() => setSearchParams({ categoria: cat })}
              className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors ${categoriaActiva === cat ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-400'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtradas.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🔍</p>
          <p>No hay excursiones que coincidan con tu búsqueda.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtradas.map((ex) => (
            <div key={ex.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col">
              <div className="relative">
                <img src={ex.imagen} alt={ex.nombre} className="w-full h-48 object-cover" />
                {ex.cuposDisponibles <= 3 && (
                  <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    ¡Últimos {ex.cuposDisponibles} cupos!
                  </span>
                )}
              </div>
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-brand-600 font-semibold uppercase tracking-wider">{ex.destino}</span>
                  <span className="text-xs text-gray-400 capitalize">{ex.dificultad}</span>
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{ex.nombre}</h3>
                <p className="text-sm text-gray-500 mb-4 flex-1 line-clamp-3">{ex.descripcion}</p>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                  <span>⏱ {ex.duracion}</span>
                  <span>·</span>
                  <span>👥 {ex.cuposDisponibles} cupos</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-brand-700 font-bold text-lg">{formatPrecio(ex.precio)}</span>
                  <Link
                    to={`/excursiones/${ex.id}`}
                    className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Ver detalle
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
