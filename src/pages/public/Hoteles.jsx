import { useLang } from '../../context/LanguageContext.jsx'

const hoteles = [
  { id: 'h1', nombre: 'Pousada Tabapitanga', destino: 'Porto de Galinhas', estrellas: 4, precio: 180, imagen: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80', tipo: 'Pousada', descripcion: 'Frente al mar, a pasos de las piscinas naturales. Desayuno incluido.' },
  { id: 'h2', nombre: 'Hotel Salinas Maragogi', destino: 'Maragogi', estrellas: 5, precio: 320, imagen: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80', tipo: 'Resort', descripcion: 'Resort all-inclusive con acceso directo a la playa y los arrecifes.' },
  { id: 'h3', nombre: 'Pousada do Bosque', destino: 'Pipa', estrellas: 3, precio: 95, imagen: 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800&q=80', tipo: 'Pousada', descripcion: 'En el corazón de Pipa, ambiente relajado y jardín tropical.' },
  { id: 'h4', nombre: 'Ocean Palace Beach Resort', destino: 'Natal', estrellas: 5, precio: 280, imagen: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80', tipo: 'Resort', descripcion: 'El mejor resort de Natal con vistas al mar y piscinas infinitas.' },
  { id: 'h5', nombre: 'Pousada Maravilha', destino: 'Fernando de Noronha', estrellas: 5, precio: 650, imagen: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80', tipo: 'Pousada Boutique', descripcion: 'La pousada más exclusiva deNoronha. Vistas únicas al archipiélago.' },
  { id: 'h6', nombre: 'Hotel Jatiúca', destino: 'Maceió', estrellas: 4, precio: 150, imagen: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80', tipo: 'Hotel', descripcion: 'Frente a la Laguna de Jatiúca, uno de los hoteles más elegantes de Maceió.' },
]

function Estrellas({ n }) {
  return <span style={{ color: '#d9a83a', fontSize: '0.85rem' }}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>
}

export default function Hoteles() {
  const { t } = useLang()

  return (
    <div style={{ backgroundColor: '#f9f3e3', minHeight: '100vh' }}>
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-10">
          <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.2em', color: '#b07420', textTransform: 'uppercase', marginBottom: 8 }}>Alojamiento</p>
          <h1 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 900, fontSize: 'clamp(2rem,4vw,3rem)', color: '#1C1208', lineHeight: 1.1, marginBottom: 8 }}>
            {t('nav_hotels')}
          </h1>
          <p style={{ color: '#1C1208AA', fontSize: '1rem' }}>Las mejores pousadas, hoteles y resorts del Nordeste Brasilero</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hoteles.map((h) => (
            <div
              key={h.id}
              className="flex flex-col overflow-hidden"
              style={{ background: 'white', borderRadius: 20, border: '1px solid #e8d09a' }}
            >
              <div className="relative overflow-hidden" style={{ height: 210 }}>
                <img src={h.imagen} alt={h.nombre} className="w-full h-full object-cover" />
                <span style={{ position: 'absolute', top: 12, left: 12, background: '#f9f3e3', color: '#1C1208', fontSize: '0.68rem', fontWeight: 700, padding: '4px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {h.tipo}
                </span>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ marginBottom: 4 }}>
                  <h3 style={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, fontSize: '1rem', color: '#1C1208' }}>{h.nombre}</h3>
                </div>
                <Estrellas n={h.estrellas} />
                <p style={{ fontSize: '0.72rem', color: '#b07420', fontWeight: 600, marginTop: 4, marginBottom: 8 }}>{h.destino}</p>
                <p style={{ fontSize: '0.83rem', color: '#1C1208AA', flex: 1, marginBottom: 16, lineHeight: 1.5 }}>{h.descripcion}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e8d09a', paddingTop: 14 }}>
                  <div>
                    <p style={{ fontSize: '0.68rem', color: '#1C120888', marginBottom: 2 }}>Desde</p>
                    <p style={{ fontFamily: '"Playfair Display", serif', fontWeight: 900, fontSize: '1.1rem', color: '#b07420' }}>
                      USD {h.precio}<span style={{ fontSize: '0.72rem', fontWeight: 400, color: '#1C120888' }}>/noche</span>
                    </p>
                  </div>
                  <a
                    href={`https://wa.me/5491100000000?text=Hola!%20Me%20interesa%20el%20${encodeURIComponent(h.nombre)}%20en%20${encodeURIComponent(h.destino)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ background: '#1C1208', color: '#f9f3e3', padding: '9px 20px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background='#b07420'}
                    onMouseLeave={e => e.currentTarget.style.background='#1C1208'}
                  >
                    Consultar
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
