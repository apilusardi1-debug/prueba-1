import { Link } from 'react-router-dom'
import { destinos, excursiones, formatPrecio } from '../../data/mockData.js'
import { useLang } from '../../context/LanguageContext.jsx'

export default function Destinos() {
  const { t } = useLang()

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">{t('nav_destinations')}</h1>
      <p className="text-gray-500 mb-10">Nordeste Brasileiro — los mejores destinos de playa de Brasil</p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {destinos.map((d) => {
          const paquetesDestino = excursiones.filter((e) => e.destino === d.nombre && e.categoria === 'paquetes')
          const desde = paquetesDestino.length > 0 ? Math.min(...paquetesDestino.map((e) => e.precio)) : null

          return (
            <Link
              key={d.id}
              to={`/destinos/${d.id}`}
              className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-shadow"
            >
              <div className="relative overflow-hidden h-52">
                <img
                  src={d.imagen}
                  alt={d.nombre}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4 text-white">
                  <p className="text-3xl mb-1">{d.icono}</p>
                  <h2 className="text-xl font-black">{d.nombre}</h2>
                  <p className="text-xs text-gray-300">{d.estado}</p>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-3">{d.descripcion}</p>
                <div className="flex items-center justify-between">
                  {desde ? (
                    <span className="text-sm text-brand-700 font-semibold">
                      Desde {formatPrecio(desde, 'USD')}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">Consultá disponibilidad</span>
                  )}
                  <span className="text-xs text-brand-600 font-medium group-hover:underline">
                    Ver paquetes →
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
