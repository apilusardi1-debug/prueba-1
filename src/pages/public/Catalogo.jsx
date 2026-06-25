import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { excursionesApi, normalizarExcursion } from '../../lib/supabase.js'
import { formatPrecio } from '../../data/mockData.js'
import { useLang } from '../../context/LanguageContext.jsx'

const C = {
  bg: '#f4f5f7',
  white: '#ffffff',
  navy: '#002147',
  navyMuted: 'rgba(0,33,71,0.55)',
  navyLight: 'rgba(0,33,71,0.07)',
  gold: '#a8720a',
  teal: '#0891b2',
  border: 'rgba(0,33,71,0.1)',
}

export default function Catalogo({ categoria }) {
  const { t } = useLang()
  const [excursiones, setExcursiones] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [destinoFiltro, setDestinoFiltro] = useState('')
  const [hovered, setHovered] = useState(null)

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      try {
        const { data, error } = await excursionesApi.getAll()
        if (!error && data) setExcursiones(data.map(normalizarExcursion))
      } catch (_) {}
      setLoading(false)
    }
    cargar()
  }, [])

  const filtrados = excursiones.filter((ex) => {
    const matchCat = !categoria || ex.categoria === categoria
    const matchDest = !destinoFiltro || ex.destino === destinoFiltro
    const matchBusq = !busqueda || ex.nombre.toLowerCase().includes(busqueda.toLowerCase()) || ex.destino?.toLowerCase().includes(busqueda.toLowerCase())
    return matchCat && matchDest && matchBusq
  })

  const destinosUnicos = [...new Set(excursiones.filter(e => !categoria || e.categoria === categoria).map(e => e.destino).filter(Boolean))]

  const tituloLabel = categoria === 'paquetes' ? 'Paquetes aéreos' : categoria === 'excursiones' ? 'Excursiones' : 'Catálogo'

  if (loading) return (
    <div style={{ backgroundColor: C.bg, minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: `3px solid ${C.border}`, borderTopColor: C.navy, borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: C.navyMuted, fontSize: '0.9rem', fontWeight: 500 }}>Cargando paquetes…</p>
      </div>
    </div>
  )

  return (
    <div style={{ backgroundColor: C.bg, minHeight: '100vh', paddingBottom: '80px' }}>

      {/* ── Header ──────────────────────────────── */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: '80px 24px 36px' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
          {/* Back button */}
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', marginBottom: '24px', color: C.navy, fontSize: '13px', fontFamily: "'Helvetica Neue', sans-serif", textDecoration: 'none', fontWeight: 600, background: C.navyLight, border: `1px solid ${C.border}`, borderRadius: '999px', padding: '7px 16px 7px 12px', transition: 'background 0.2s, box-shadow 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,33,71,0.13)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,33,71,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = C.navyLight; e.currentTarget.style.boxShadow = 'none' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Volver al inicio
          </Link>
          <p style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: '11px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.teal, marginBottom: '12px' }}>
            DreamTours · Nordeste Brasilero
          </p>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: 'clamp(2rem, 4.5vw, 3.2rem)', color: C.navy, lineHeight: 1.1, marginBottom: '10px', letterSpacing: '-0.02em' }}>
            {tituloLabel}
          </h1>
          <p style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", fontSize: '15px', color: C.navyMuted, lineHeight: 1.6 }}>
            Encontrá tu próximo viaje al Nordeste Brasilero
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '32px 24px 0' }}>

        {/* ── Filtros ──────────────────────────── */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '200px' }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: C.navyMuted, fontSize: '16px', pointerEvents: 'none' }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="Buscar por destino o nombre..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: '10px', padding: '11px 16px 11px 40px', fontSize: '14px', background: C.white, color: C.navy, outline: 'none', boxSizing: 'border-box', fontFamily: "'Helvetica Neue', sans-serif" }}
            />
          </div>

          {/* Destination pills */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['', ...destinosUnicos].map((d) => {
              const active = destinoFiltro === d
              return (
                <button key={d || 'todos'} onClick={() => setDestinoFiltro(d)}
                  style={{
                    padding: '9px 18px', borderRadius: '999px', fontSize: '13px', fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.18s', fontFamily: "'Helvetica Neue', sans-serif",
                    border: active ? 'none' : `1.5px solid ${C.border}`,
                    background: active ? C.navy : C.white,
                    color: active ? C.white : C.navyMuted,
                    boxShadow: active ? '0 2px 12px rgba(0,33,71,0.18)' : 'none',
                  }}>
                  {d || 'Todos'}
                </button>
              )
            })}
          </div>
        </div>

        {/* Contador */}
        {filtrados.length > 0 && (
          <p style={{ fontSize: '13px', color: C.navyMuted, marginBottom: '20px', fontFamily: "'Helvetica Neue', sans-serif" }}>
            {filtrados.length} {filtrados.length === 1 ? 'paquete' : 'paquetes'} encontrados
          </p>
        )}

        {/* ── Grid ─────────────────────────────── */}
        {filtrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px', color: C.navyMuted }}>
            <p style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔍</p>
            <p style={{ fontSize: '1rem' }}>No hay paquetes que coincidan con tu búsqueda.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
            {filtrados.map((ex) => (
              <div key={ex.id}
                onMouseEnter={() => setHovered(ex.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: C.white, borderRadius: '16px', overflow: 'hidden',
                  border: `1px solid ${C.border}`,
                  boxShadow: hovered === ex.id ? '0 16px 48px rgba(0,33,71,0.13)' : '0 2px 12px rgba(0,33,71,0.06)',
                  transform: hovered === ex.id ? 'translateY(-4px)' : 'translateY(0)',
                  transition: 'all 0.28s cubic-bezier(0.25,0.46,0.45,0.94)',
                  display: 'flex', flexDirection: 'column',
                }}>

                {/* Image */}
                <div style={{ position: 'relative', height: '220px', overflow: 'hidden', flexShrink: 0 }}>
                  <img
                    src={ex.imagen || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80'}
                    alt={ex.nombre}
                    onError={e => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80' }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform: hovered === ex.id ? 'scale(1.04)' : 'scale(1)', transition: 'transform 0.6s ease' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,33,71,0.35) 100%)' }} />

                  {/* Destination badge */}
                  <span style={{
                    position: 'absolute', top: '14px', left: '14px',
                    background: 'rgba(0,33,71,0.75)', backdropFilter: 'blur(8px)',
                    color: 'rgba(255,255,255,0.92)', fontSize: '10px', fontWeight: 700,
                    padding: '5px 12px', borderRadius: '999px', letterSpacing: '0.14em',
                    textTransform: 'uppercase', fontFamily: "'Helvetica Neue', sans-serif",
                  }}>{ex.destino}</span>

                  {/* Últimos cupos */}
                  {ex.cuposDisponibles <= 3 && (
                    <span style={{
                      position: 'absolute', top: '14px', right: '14px',
                      background: '#dc2626', color: 'white', fontSize: '10px', fontWeight: 700,
                      padding: '5px 12px', borderRadius: '999px', letterSpacing: '0.06em',
                      fontFamily: "'Helvetica Neue', sans-serif",
                    }}>¡Últimos {ex.cuposDisponibles}!</span>
                  )}
                </div>

                {/* Body */}
                <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: '1.15rem', color: C.navy, marginBottom: '8px', lineHeight: 1.3 }}>
                    {ex.nombre}
                  </h3>
                  <p style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", fontSize: '13.5px', color: C.navyMuted, marginBottom: '18px', flex: 1, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {ex.descripcion}
                  </p>

                  {/* Meta */}
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ fontSize: '13px', color: C.navyMuted }}>⏱</span>
                      <span style={{ fontSize: '12.5px', color: C.navyMuted, fontFamily: "'Helvetica Neue', sans-serif", fontWeight: 500 }}>{ex.duracion}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ fontSize: '13px', color: C.navyMuted }}>👥</span>
                      <span style={{ fontSize: '12.5px', color: C.navyMuted, fontFamily: "'Helvetica Neue', sans-serif", fontWeight: 500 }}>{ex.cuposDisponibles} cupos</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: '18px' }}>
                    <div>
                      <p style={{ fontSize: '11px', color: C.navyMuted, fontFamily: "'Helvetica Neue', sans-serif", marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>desde</p>
                      <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: '1.35rem', color: C.gold }}>
                        {formatPrecio(ex.precio, ex.moneda)}
                      </span>
                    </div>
                    <Link to={`/excursiones/${ex.id}`}
                      style={{
                        background: C.navy, color: C.white,
                        padding: '10px 20px', borderRadius: '8px',
                        fontSize: '13px', fontWeight: 600, textDecoration: 'none',
                        fontFamily: "'Helvetica Neue', sans-serif",
                        letterSpacing: '0.02em', transition: 'background 0.18s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background='#003580'}
                      onMouseLeave={e => e.currentTarget.style.background=C.navy}>
                      Ver detalle
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
