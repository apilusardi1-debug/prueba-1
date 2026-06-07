import { Link } from 'react-router-dom'
import { excursiones, destinos, formatPrecio } from '../../data/mockData.js'
import { useLang } from '../../context/LanguageContext.jsx'

export default function Home() {
  const { t } = useLang()
  const destacados = excursiones.filter((e) => e.categoria === 'paquetes').slice(0, 3)

  const categoriaLinks = [
    { icon: '✈️', labelKey: 'cat_packages',     to: '/paquetes' },
    { icon: '📍', labelKey: 'cat_destinations',  to: '/destinos' },
    { icon: '🤿', labelKey: 'cat_excursions',    to: '/excursiones' },
    { icon: '🏨', labelKey: 'cat_hotels',        to: '/hoteles' },
    { icon: '🌊', labelKey: 'cat_tides',         to: '/marea' },
    { icon: 'ℹ️', labelKey: 'cat_about',         to: '/nosotros' },
  ]

  return (
    <div>
      {/* Hero */}
      <section
        className="relative h-[75vh] flex items-center justify-center text-white text-center bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=80')" }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 max-w-2xl px-4">
          <p className="text-brand-300 font-semibold uppercase tracking-widest text-sm mb-3">DREAMSTOUR</p>
          <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
            {t('hero_title')}
          </h1>
          <p className="text-lg text-gray-200 mb-8">
            {t('hero_subtitle')}
          </p>
          <Link
            to="/paquetes"
            className="bg-brand-500 hover:bg-brand-600 text-white font-bold px-8 py-3.5 rounded-full text-lg transition-colors shadow-lg"
          >
            {t('hero_cta')} →
          </Link>
        </div>
      </section>

      {/* Categorías */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {categoriaLinks.map(({ icon, labelKey, to }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all border border-gray-100 text-center"
            >
              <span className="text-2xl">{icon}</span>
              <span className="text-xs font-medium text-gray-700 leading-tight">{t(labelKey)}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Destinos */}
      <section className="max-w-6xl mx-auto px-4 pb-12">
        <h2 className="text-2xl font-bold mb-6">{t('nav_destinations')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {destinos.map((d) => (
            <Link
              key={d.id}
              to={`/destinos/${d.id}`}
              className="group relative overflow-hidden rounded-2xl aspect-square"
            >
              <img src={d.imagen} alt={d.nombre} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                <p className="text-lg">{d.icono}</p>
                <p className="font-bold text-sm leading-tight">{d.nombre}</p>
                <p className="text-xs text-gray-300">{d.estado}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Paquetes destacados */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold mb-6">{t('nav_packages')}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {destacados.map((ex) => (
              <Link key={ex.id} to={`/excursiones/${ex.id}`} className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow border border-gray-100">
                <div className="relative overflow-hidden">
                  <img
                    src={ex.imagen}
                    alt={ex.nombre}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {ex.cuposDisponibles <= 3 && (
                    <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      ¡Últimos {ex.cuposDisponibles}!
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <span className="text-xs text-brand-600 font-semibold uppercase tracking-wider">{ex.destino}</span>
                  <h3 className="font-bold text-gray-900 mt-1 mb-2">{ex.nombre}</h3>
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{ex.descripcion}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-brand-700 font-bold">{formatPrecio(ex.precio, ex.moneda)}</span>
                    <span className="text-xs text-gray-400">{ex.duracion}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link
              to="/paquetes"
              className="border border-brand-500 text-brand-600 hover:bg-brand-50 px-6 py-2.5 rounded-full font-medium transition-colors"
            >
              Ver todos los paquetes →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA WhatsApp */}
      <section className="bg-green-50 py-14">
        <div className="max-w-2xl mx-auto text-center px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">¿Querés armar tu viaje a medida?</h2>
          <p className="text-gray-600 mb-6">Hablá directamente con nuestro equipo por WhatsApp.</p>
          <a
            href="https://wa.me/5491100000000?text=Hola!%20Me%20interesa%20viajar%20al%20Nordeste%20Brasilero"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold px-8 py-3.5 rounded-full transition-colors shadow-md"
          >
            💬 Escribinos por WhatsApp
          </a>
        </div>
      </section>
    </div>
  )
}
