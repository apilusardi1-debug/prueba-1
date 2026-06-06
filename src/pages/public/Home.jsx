import { Link } from 'react-router-dom'
import { excursiones, formatPrecio } from '../../data/mockData.js'

export default function Home() {
  const destacadas = excursiones.slice(0, 3)

  return (
    <div>
      {/* Hero */}
      <section
        className="relative h-[70vh] flex items-center justify-center text-white text-center bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1600&q=80')" }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 max-w-2xl px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Descubrí la Patagonia como nunca antes
          </h1>
          <p className="text-lg text-gray-200 mb-8">
            Excursiones únicas con guías especializados. Naturaleza, aventura y cultura en un solo lugar.
          </p>
          <Link
            to="/excursiones"
            className="bg-brand-500 hover:bg-brand-600 text-white font-semibold px-8 py-3 rounded-full text-lg transition-colors"
          >
            Ver excursiones
          </Link>
        </div>
      </section>

      {/* Categorías rápidas */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { icon: '🏔️', label: 'Aventura', val: 'aventura' },
            { icon: '🌿', label: 'Naturaleza', val: 'naturaleza' },
            { icon: '🏛️', label: 'Cultural', val: 'cultural' },
            { icon: '🍷', label: 'Gastronómico', val: 'gastronomico' },
            { icon: '⛵', label: 'Acuático', val: 'acuatico' },
          ].map(({ icon, label, val }) => (
            <Link
              key={val}
              to={`/excursiones?categoria=${val}`}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all border border-gray-100"
            >
              <span className="text-3xl">{icon}</span>
              <span className="text-sm font-medium text-gray-700">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Excursiones destacadas */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold mb-6">Excursiones destacadas</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {destacadas.map((ex) => (
            <Link key={ex.id} to={`/excursiones/${ex.id}`} className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow border border-gray-100">
              <img
                src={ex.imagen}
                alt={ex.nombre}
                className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="p-4">
                <span className="text-xs text-brand-600 font-semibold uppercase tracking-wider">{ex.destino}</span>
                <h3 className="font-bold text-gray-900 mt-1 mb-2">{ex.nombre}</h3>
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{ex.descripcion}</p>
                <div className="flex items-center justify-between">
                  <span className="text-brand-700 font-bold">{formatPrecio(ex.precio)}</span>
                  <span className="text-xs text-gray-400">{ex.duracion}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link
            to="/excursiones"
            className="border border-brand-500 text-brand-600 hover:bg-brand-50 px-6 py-2.5 rounded-full font-medium transition-colors"
          >
            Ver todas las excursiones →
          </Link>
        </div>
      </section>

      {/* CTA WhatsApp */}
      <section className="bg-green-50 py-12">
        <div className="max-w-2xl mx-auto text-center px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">¿Tenés alguna duda?</h2>
          <p className="text-gray-600 mb-6">Hablá directamente con nuestro equipo por WhatsApp.</p>
          <a
            href="https://wa.me/5491100000000?text=Hola!%20Me%20interesa%20saber%20más%20sobre%20sus%20excursiones"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-7 py-3 rounded-full transition-colors"
          >
            💬 Escribinos por WhatsApp
          </a>
        </div>
      </section>
    </div>
  )
}
