import { useParams, Link } from 'react-router-dom'
import { excursiones, formatPrecio } from '../../data/mockData.js'
import { useLang } from '../../context/LanguageContext.jsx'

export default function ExcursionDetalle() {
  const { id } = useParams()
  const { t } = useLang()
  const ex = excursiones.find((e) => e.id === id)

  if (!ex) {
    return (
      <div style={{ textAlign: 'center', padding: '96px 16px', color: '#1C120899' }}>
        <p style={{ fontSize: '3rem', marginBottom: 12 }}>🗺️</p>
        <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Paquete no encontrado</p>
        <Link to="/paquetes" style={{ marginTop: 16, display: 'inline-block', color: '#b07420', textDecoration: 'none', fontWeight: 600 }}>
          {t('detail_back')}
        </Link>
      </div>
    )
  }

  const backTo = ex.categoria === 'paquetes' ? '/paquetes' : '/excursiones'

  return (
    <div style={{ backgroundColor: '#f9f3e3', minHeight: '100vh' }}>
      <div className="max-w-5xl mx-auto px-4 py-12">
        <Link to={backTo} style={{ fontSize: '0.82rem', color: '#b07420', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 28 }}>
          ← {t('detail_back')}
        </Link>

        <div className="grid md:grid-cols-2 gap-10">
          {/* Imagen */}
          <div>
            <div style={{ borderRadius: 20, overflow: 'hidden', height: 320 }}>
              <img src={ex.imagen} alt={ex.nombre} className="w-full h-full object-cover" />
            </div>
            {ex.incluye?.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1C1208CC', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{t('detail_includes')}</p>
                <div className="flex flex-wrap gap-2">
                  {ex.incluye.map((item) => (
                    <span key={item} style={{ background: '#e8f5e9', color: '#2e7d32', fontSize: '0.75rem', fontWeight: 600, padding: '5px 12px', borderRadius: 999, border: '1px solid #a5d6a7' }}>
                      ✓ {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b07420', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 8 }}>{ex.destino}</p>
            <h1 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 900, fontSize: 'clamp(1.8rem,3.5vw,2.5rem)', color: '#1C1208', lineHeight: 1.1, marginBottom: 12 }}>{ex.nombre}</h1>
            <p style={{ color: '#1C1208AA', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: 24 }}>{ex.descripcion}</p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: t('detail_duration'), value: `⏱ ${ex.duracion}` },
                { label: t('detail_difficulty'), value: `🎯 ${ex.dificultad}` },
                { label: t('detail_spots'), value: `👥 ${ex.cuposDisponibles} / ${ex.cupos}`, red: ex.cuposDisponibles <= 3 },
                { label: t('detail_category'), value: `🏷️ ${ex.categoria}` },
              ].map(({ label, value, red }) => (
                <div key={label} style={{ background: 'white', border: '1px solid #e8d09a', borderRadius: 14, padding: '12px 16px', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.65rem', color: '#1C120888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</p>
                  <p style={{ fontWeight: 700, fontSize: '0.88rem', color: red ? '#c0392b' : '#1C1208' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Fechas */}
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1C1208CC', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{t('detail_next_dates')}</p>
              <div className="flex flex-wrap gap-2">
                {ex.fechas.map((f) => (
                  <span key={f} style={{ background: 'white', border: '1px solid #d9a83a', color: '#8a581e', fontSize: '0.82rem', fontWeight: 600, padding: '6px 14px', borderRadius: 10 }}>
                    {new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e8d09a', paddingTop: 24 }}>
              <div>
                <p style={{ fontSize: '0.7rem', color: '#1C120888', marginBottom: 4 }}>{t('detail_per_person')}</p>
                <p style={{ fontFamily: '"Playfair Display", serif', fontWeight: 900, fontSize: '2rem', color: '#b07420', lineHeight: 1 }}>{formatPrecio(ex.precio, ex.moneda)}</p>
              </div>
              <Link
                to={`/reservar/${ex.id}`}
                style={{ background: '#1C1208', color: '#f9f3e3', fontWeight: 700, padding: '14px 32px', borderRadius: 14, textDecoration: 'none', fontSize: '0.95rem', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background='#b07420'}
                onMouseLeave={e => e.currentTarget.style.background='#1C1208'}
              >
                {t('detail_book')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
