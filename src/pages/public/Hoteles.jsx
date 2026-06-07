import { useLang } from '../../context/LanguageContext.jsx'
import { destinos } from '../../data/mockData.js'

// Mock de hoteles — reemplazar con datos reales de Supabase
const hoteles = [
  { id: 'h1', nombre: 'Pousada Tabapitanga', destino: 'Porto de Galinhas', estrellas: 4, precio: 180, imagen: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80', tipo: 'Pousada', descripcion: 'Frente al mar, a pasos de las piscinas naturales. Desayuno incluido.' },
  { id: 'h2', nombre: 'Hotel Salinas Maragogi', destino: 'Maragogi', estrellas: 5, precio: 320, imagen: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80', tipo: 'Resort', descripcion: 'Resort all-inclusive con acceso directo a la playa y los arrecifes.' },
  { id: 'h3', nombre: 'Pousada do Bosque', destino: 'Pipa', estrellas: 3, precio: 95, imagen: 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800&q=80', tipo: 'Pousada', descripcion: 'En el corazón de Pipa, ambiente relajado y jardín tropical.' },
  { id: 'h4', nombre: 'Ocean Palace Beach Resort', destino: 'Natal', estrellas: 5, precio: 280, imagen: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80', tipo: 'Resort', descripcion: 'El mejor resort de Natal con vistas al mar y piscinas infinitas.' },
  { id: 'h5', nombre: 'Pousada Maravilha', destino: 'Fernando de Noronha', estrellas: 5, precio: 650, imagen: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80', tipo: 'Pousada Boutique', descripcion: 'La pousada más exclusiva de Noronha. Vistas únicas al archipiélago.' },
  { id: 'h6', nombre: 'Hotel Jatiúca', destino: 'Maceió', estrellas: 4, precio: 150, imagen: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80', tipo: 'Hotel', descripcion: 'Frente a la Laguna de Jatiúca, uno de los hoteles más elegantes de Maceió.' },
]

function Estrellas({ n }) {
  return <span className="text-yellow-400 text-xs">{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>
}

export default function Hoteles() {
  const { t } = useLang()

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">{t('nav_hotels')}</h1>
      <p className="text-gray-500 mb-10">Las mejores pousadas, hoteles y resorts del Nordeste Brasilero</p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {hoteles.map((h) => (
          <div key={h.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col">
            <div className="relative">
              <img src={h.imagen} alt={h.nombre} className="w-full h-48 object-cover" />
              <span className="absolute top-3 left-3 bg-white text-xs font-semibold text-gray-700 px-2 py-1 rounded-full shadow-sm">
                {h.tipo}
              </span>
            </div>
            <div className="p-4 flex flex-col flex-1">
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-bold text-gray-900">{h.nombre}</h3>
              </div>
              <Estrellas n={h.estrellas} />
              <p className="text-xs text-brand-600 font-medium mt-1 mb-2">{h.destino}</p>
              <p className="text-sm text-gray-500 flex-1 mb-4">{h.descripcion}</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Desde</p>
                  <p className="font-bold text-brand-700">USD {h.precio}<span className="text-xs text-gray-400 font-normal">/noche</span></p>
                </div>
                <a
                  href={`https://wa.me/5491100000000?text=Hola!%20Me%20interesa%20el%20${encodeURIComponent(h.nombre)}%20en%20${encodeURIComponent(h.destino)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Consultar
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
