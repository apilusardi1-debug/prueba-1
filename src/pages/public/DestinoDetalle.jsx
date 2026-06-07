import { useParams, Link } from 'react-router-dom'
import { destinos, excursiones, formatPrecio } from '../../data/mockData.js'
import { useLang } from '../../context/LanguageContext.jsx'

export default function DestinoDetalle() {
  const { id } = useParams()
  const { t } = useLang()
  const destino = destinos.find((d) => d.id === id)

  if (!destino) {
    return (
      <div className="text-center py-24">
        <p className="text-5xl mb-4">📍</p>
        <p className="text-xl font-semibold text-gray-700">Destino no encontrado</p>
        <Link to="/destinos" className="mt-4 inline-block text-brand-600 hover:underline">← Volver a destinos</Link>
      </div>
    )
  }

  const paquetesDestino = excursiones.filter((e) => e.destino === destino.nombre && e.categoria === 'paquetes')
  const excursionesDestino = excursiones.filter((e) => e.destino === destino.nombre && e.categoria === 'excursiones')

  return (
    <div>
      {/* Hero del destino */}
      <div
        className="relative h-72 bg-cover bg-center flex items-end"
        style={{ backgroundImage: `url(${destino.imagen})` }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 pb-8 text-white">
          <Link to="/destinos" className="text-sm text-gray-300 hover:text-white mb-3 inline-block">
            ← {t('nav_destinations')}
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{destino.icono}</span>
            <div>
              <h1 className="text-3xl font-black">{destino.nombre}</h1>
              <p className="text-gray-300">{destino.estado} · Brasil</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">
        <p className="text-gray-600 text-lg mb-10 max-w-2xl">{destino.descripcion}</p>

        {/* Paquetes */}
        {paquetesDestino.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-bold mb-5">✈️ {t('nav_packages')}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {paquetesDestino.map((ex) => (
                <Link key={ex.id} to={`/excursiones/${ex.id}`} className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <img src={ex.imagen} alt={ex.nombre} className="w-full h-40 object-cover" />
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 mb-1">{ex.nombre}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">{ex.descripcion}</p>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-brand-700">{formatPrecio(ex.precio, ex.moneda)}</span>
                      <span className="text-xs text-gray-400">{ex.duracion}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Excursiones */}
        {excursionesDestino.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-bold mb-5">🤿 {t('nav_excursions')}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {excursionesDestino.map((ex) => (
                <Link key={ex.id} to={`/excursiones/${ex.id}`} className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <img src={ex.imagen} alt={ex.nombre} className="w-full h-40 object-cover" />
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 mb-1">{ex.nombre}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">{ex.descripcion}</p>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-brand-700">{formatPrecio(ex.precio, ex.moneda)}</span>
                      <span className="text-xs text-gray-400">{ex.duracion}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {paquetesDestino.length === 0 && excursionesDestino.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🏖️</p>
            <p>Próximamente paquetes para {destino.nombre}.</p>
            <a
              href="https://wa.me/5491100000000"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 bg-green-500 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-green-600 transition-colors"
            >
              💬 Consultá disponibilidad
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
