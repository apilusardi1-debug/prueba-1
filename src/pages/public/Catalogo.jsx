import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { excursiones, destinos, formatPrecio } from '../../data/mockData.js'
import { useLang } from '../../context/LanguageContext.jsx'

export default function Catalogo({ categoria }) {
  const { t } = useLang()
  const [busqueda, setBusqueda] = useState('')
  const [destinoFiltro, setDestinoFiltro] = useState('')

  const filtrados = excursiones.filter((ex) => {
    const matchCat = !categoria || ex.categoria === categoria
    const matchDest = !destinoFiltro || ex.destino === destinoFiltro
    const matchBusq = !busqueda || ex.nombre.toLowerCase().includes(busqueda.toLowerCase()) || ex.destino.toLowerCase().includes(busqueda.toLowerCase())
    return matchCat && matchDest && matchBusq
  })

  const destinosUnicos = [...new Set(excursiones.filter(e => !categoria || e.categoria === categoria).map(e => e.destino))]

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">{t('catalog_title')}</h1>
      <p className="text-gray-500 mb-8">{t('catalog_subtitle')}</p>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <input
          type="text"
          placeholder={t('catalog_search')}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setDestinoFiltro('')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${!destinoFiltro ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-400'}`}
          >
            {t('catalog_all')}
          </button>
          {destinosUnicos.map((d) => (
            <button
              key={d}
              onClick={() => setDestinoFiltro(d)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${destinoFiltro === d ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-400'}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtrados.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🔍</p>
          <p>{t('catalog_empty')}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtrados.map((ex) => (
            <div key={ex.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col">
              <div className="relative">
                <img src={ex.imagen} alt={ex.nombre} className="w-full h-48 object-cover" />
                {ex.cuposDisponibles <= 3 && (
                  <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    ¡Últimos {ex.cuposDisponibles} {t('catalog_spots')}!
                  </span>
                )}
              </div>
              <div className="p-5 flex flex-col flex-1">
                <span className="text-xs text-brand-600 font-semibold uppercase tracking-wider">{ex.destino}</span>
                <h3 className="font-bold text-gray-900 text-lg mt-1 mb-2">{ex.nombre}</h3>
                <p className="text-sm text-gray-500 mb-4 flex-1 line-clamp-3">{ex.descripcion}</p>
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
                  <span>⏱ {ex.duracion}</span>
                  <span>·</span>
                  <span>👥 {ex.cuposDisponibles} {t('catalog_spots')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-brand-700 font-bold text-lg">{formatPrecio(ex.precio, ex.moneda)}</span>
                  <Link
                    to={`/excursiones/${ex.id}`}
                    className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {t('catalog_see')}
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
