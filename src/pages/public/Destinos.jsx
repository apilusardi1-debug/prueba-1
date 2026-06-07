import { Link } from 'react-router-dom'
import { destinos, excursiones, formatPrecio } from '../../data/mockData.js'
import { useLang } from '../../context/LanguageContext.jsx'

export default function Destinos() {
  const { t } = useLang()

  return (
    <div style={{ backgroundColor: '#f9f3e3', minHeight: '100vh' }}>
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-10">
          <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.2em', color: '#b07420', textTransform: 'uppercase', marginBottom: 8 }}>Brasil</p>
          <h1 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 900, fontSize: 'clamp(2rem,4vw,3rem)', color: '#1C1208', lineHeight: 1.1, marginBottom: 8 }}>
            {t('nav_destinations')}
          </h1>
          <p style={{ color: '#1C1208AA', fontSize: '1rem' }}>Nordeste Brasileiro — los mejores destinos de playa de Brasil</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {destinos.map((d) => {
            const paquetesDestino = excursiones.filter((e) => e.destino === d.nombre && e.categoria === 'paquetes')
            const desde = paquetesDestino.length > 0 ? Math.min(...paquetesDestino.map((e) => e.precio)) : null

            return (
              <Link
                key={d.id}
                to={`/destinos/${d.id}`}
                className="group overflow-hidden transition-all"
                style={{ background: 'white', borderRadius: 20, border: '1px solid #e8d09a', textDecoration: 'none', display: 'block' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow='0 8px 30px rgba(28,18,8,0.1)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow='none'}
              >
                <div className="relative overflow-hidden" style={{ height: 220 }}>
                  <img
                    src={d.imagen}
                    alt={d.nombre}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(28,18,8,0.75) 0%, transparent 55%)' }} />
                  <div style={{ position: 'absolute', bottom: 16, left: 16, color: 'white' }}>
                    <p style={{ fontSize: '2rem', lineHeight: 1, marginBottom: 4 }}>{d.icono}</p>
                    <h2 style={{ fontFamily: '"Playfair Display", serif', fontWeight: 900, fontSize: '1.3rem', color: '#f9f3e3', lineHeight: 1.1 }}>{d.nombre}</h2>
                    <p style={{ fontSize: '0.72rem', color: '#e8d09acc', marginTop: 2 }}>{d.estado}</p>
                  </div>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  <p style={{ fontSize: '0.85rem', color: '#1C1208AA', marginBottom: 14, lineHeight: 1.5 }}>{d.descripcion}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e8d09a', paddingTop: 12 }}>
                    {desde ? (
                      <span style={{ fontSize: '0.85rem', color: '#b07420', fontWeight: 700 }}>
                        Desde {formatPrecio(desde, 'USD')}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.82rem', color: '#1C120888' }}>Consultá disponibilidad</span>
                    )}
                    <span style={{ fontSize: '0.8rem', color: '#b07420', fontWeight: 600 }}>Ver paquetes →</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
