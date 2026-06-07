import { useParams, Link } from 'react-router-dom'
import { excursiones, formatPrecio } from '../../data/mockData.js'
import { useLang } from '../../context/LanguageContext.jsx'

export default function ExcursionDetalle() {
  const { id } = useParams()
  const { t } = useLang()
  const ex = excursiones.find((e) => e.id === id)

  if (!ex) {
    return (
      <div className="text-center py-24">
        <p className="text-5xl mb-4">🗺️</p>
        <p className="text-xl font-semibold text-gray-700">Paquete no encontrado</p>
        <Link to="/paquetes" className="mt-4 inline-block text-brand-600 hover:underline">
          {t('detail_back')}
        </Link>
      </div>
    )
  }

  const backTo = ex.categoria === 'paquetes' ? '/paquetes' : '/excursiones'

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <Link to={backTo} className="text-sm text-brand-600 hover:underline mb-6 inline-block">
        {t('detail_back')}
      </Link>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Imagen */}
        <div>
          <img src={ex.imagen} alt={ex.nombre} className="w-full h-72 object-cover rounded-2xl shadow" />
          {ex.incluye?.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">{t('detail_includes')}</p>
              <div className="flex flex-wrap gap-2">
                {ex.incluye.map((item) => (
                  <span key={item} className="bg-green-50 text-green-700 text-xs font-medium px-3 py-1 rounded-full border border-green-200">
                    ✓ {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <span className="text-sm text-brand-600 font-semibold uppercase tracking-wider">{ex.destino}</span>
          <h1 className="text-3xl font-bold mt-1 mb-3">{ex.nombre}</h1>
          <p className="text-gray-600 mb-6">{ex.descripcion}</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">{t('detail_duration')}</p>
              <p className="font-semibold">⏱ {ex.duracion}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">{t('detail_difficulty')}</p>
              <p className="font-semibold">🎯 {ex.dificultad}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">{t('detail_spots')}</p>
              <p className={`font-semibold ${ex.cuposDisponibles <= 3 ? 'text-red-600' : 'text-gray-800'}`}>
                👥 {ex.cuposDisponibles} / {ex.cupos}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">{t('detail_category')}</p>
              <p className="font-semibold capitalize">🏷️ {ex.categoria}</p>
            </div>
          </div>

          {/* Fechas */}
          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-700 mb-2">{t('detail_next_dates')}</p>
            <div className="flex flex-wrap gap-2">
              {ex.fechas.map((f) => (
                <span key={f} className="bg-brand-50 text-brand-700 text-sm font-medium px-3 py-1 rounded-lg border border-brand-200">
                  {new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">{t('detail_per_person')}</p>
              <p className="text-3xl font-bold text-brand-700">{formatPrecio(ex.precio, ex.moneda)}</p>
            </div>
            <Link
              to={`/reservar/${ex.id}`}
              className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-8 py-3 rounded-xl transition-colors"
            >
              {t('detail_book')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
