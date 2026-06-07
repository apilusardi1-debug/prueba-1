import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { destinos, formatPrecio } from '../../data/mockData.js'
import { excursionesApi, normalizarExcursion } from '../../lib/supabase.js'
import { useLang } from '../../context/LanguageContext.jsx'
import { useSiteConfig } from '../../context/SiteConfigContext.jsx'

export default function Home() {
  const { t } = useLang()
  const { config } = useSiteConfig()
  const [destacados, setDestacados] = useState([])

  useEffect(() => {
    async function cargar() {
      try {
        const { data } = await excursionesApi.getAll()
        if (data) {
          const paquetes = data.map(normalizarExcursion).filter(e => e.categoria === 'paquetes').slice(0, 3)
          setDestacados(paquetes)
        }
      } catch (_) {}
    }
    cargar()
  }, [])

  const categoriaLinks = [
    { icon: '✈️', labelKey: 'cat_packages',   to: '/paquetes' },
    { icon: '📍', labelKey: 'cat_destinations', to: '/destinos' },
    { icon: '🤿', labelKey: 'cat_excursions',  to: '/excursiones' },
    { icon: '🏨', labelKey: 'cat_hotels',      to: '/hoteles' },
    { icon: '🚐', labelKey: 'cat_transfers',   to: '/traslados' },
  ]

  return (
    <div>
      {/* Hero */}
      <section
        className="relative flex items-end justify-start text-white bg-cover bg-center"
        style={{ minHeight: '88vh', backgroundImage: `url('${config.hero_imagen}')` }}
      >
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(28,18,8,0.85) 0%, rgba(28,18,8,0.3) 50%, transparent 100%)' }} />
        <div className="relative z-10 max-w-7xl mx-auto px-6 pb-16 md:pb-24 w-full">
          <p style={{ fontFamily: '"DM Sans", sans-serif', letterSpacing: '0.25em', fontSize: '0.7rem', color: '#d9a83a', fontWeight: 600, textTransform: 'uppercase', marginBottom: '1rem' }}>
            Nordeste Brasilero
          </p>
          <h1 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 900, fontSize: 'clamp(2.8rem, 7vw, 5.5rem)', lineHeight: 1.0, color: '#f9f3e3', maxWidth: '14ch', marginBottom: '1.5rem' }}>
            {t('hero_title')}
          </h1>
          <p style={{ fontSize: '1.1rem', color: '#f2e4c0cc', maxWidth: '42ch', marginBottom: '2.5rem', fontWeight: 300 }}>
            {t('hero_subtitle')}
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/paquetes"
              style={{ background: 'var(--cp, #b07420)', color: '#f9f3e3', fontWeight: 700, padding: '14px 36px', borderRadius: 999, fontSize: '0.95rem', transition: 'background 0.15s', display: 'inline-block', textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.background='var(--cp-dark, #8a581e)'}
              onMouseLeave={e => e.currentTarget.style.background='var(--cp, #b07420)'}
            >
              {config.hero_cta} →
            </Link>
            <a
              href={`https://wa.me/${config.whatsapp}?text=Hola!%20Me%20interesa%20viajar%20al%20Nordeste%20Brasilero`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ border: '1.5px solid #f9f3e3aa', color: '#f9f3e3', fontWeight: 600, padding: '14px 36px', borderRadius: 999, fontSize: '0.95rem', transition: 'all 0.15s', display: 'inline-block', textDecoration: 'none' }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(249,243,227,0.15)' }}
              onMouseLeave={e => { e.currentTarget.style.background='transparent' }}
            >
              💬 WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Categorías */}
      <section style={{ backgroundColor: '#f9f3e3', borderBottom: '1px solid #e8d09a' }}>
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {categoriaLinks.map(({ icon, labelKey, to }) => (
              <Link
                key={to}
                to={to}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl text-center transition-all"
                style={{ background: 'white', border: '1px solid #e8d09a', textDecoration: 'none' }}
                onMouseEnter={e => { e.currentTarget.style.background='#f2e4c0'; e.currentTarget.style.borderColor='#d9a83a' }}
                onMouseLeave={e => { e.currentTarget.style.background='white'; e.currentTarget.style.borderColor='#e8d09a' }}
              >
                <span style={{ fontSize: '1.6rem' }}>{icon}</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#1C1208CC', lineHeight: 1.3 }}>{t(labelKey)}</span>
              </Link>
            ))}
          </div>

          {/* Banners secundarios */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            {[
              {
                to: '/marea',
                icon: '🌊',
                label: 'Tabla de Marea',
                sub: 'Planificá tus excursiones acuáticas',
                bg: 'linear-gradient(135deg, #1a4e6e 0%, #1e7a8a 100%)',
              },
              {
                to: '/nosotros',
                icon: 'ℹ️',
                label: 'Sobre nosotros',
                sub: 'Conocé al equipo de Dream Tours',
                bg: 'linear-gradient(135deg, #3b2a1a 0%, #6b4423 100%)',
              },
            ].map(({ to, icon, label, sub, bg }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-4 p-5 rounded-2xl transition-all"
                style={{ background: bg, textDecoration: 'none' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.9' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
              >
                <span style={{ fontSize: '2rem' }}>{icon}</span>
                <div>
                  <p style={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, fontSize: '1rem', color: '#f9f3e3', lineHeight: 1.2 }}>{label}</p>
                  <p style={{ fontSize: '0.72rem', color: '#f9f3e3aa', marginTop: 3 }}>{sub}</p>
                </div>
                <span style={{ marginLeft: 'auto', color: '#f9f3e3aa', fontSize: '1.2rem' }}>→</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Destinos */}
      <section style={{ backgroundColor: '#f9f3e3' }} className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.2em', color: '#b07420', textTransform: 'uppercase', marginBottom: 8 }}>Explore</p>
              <h2 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 900, fontSize: 'clamp(1.8rem,3.5vw,2.5rem)', color: '#1C1208', lineHeight: 1.1 }}>{t('nav_destinations')}</h2>
            </div>
            <Link to="/destinos" style={{ fontSize: '0.82rem', color: '#b07420', fontWeight: 600, textDecoration: 'none' }}>Ver todos →</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {destinos.map((d) => (
              <Link
                key={d.id}
                to={`/destinos/${d.id}`}
                className="group relative overflow-hidden rounded-2xl"
                style={{ aspectRatio: '3/4', display: 'block', textDecoration: 'none' }}
              >
                <img src={d.imagen} alt={d.nombre} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(28,18,8,0.8) 0%, transparent 55%)' }} />
                <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                  <p style={{ fontSize: '1.3rem', lineHeight: 1 }}>{d.icono}</p>
                  <p style={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.2, marginTop: 4 }}>{d.nombre}</p>
                  <p style={{ fontSize: '0.68rem', color: '#e8d09acc', marginTop: 2 }}>{d.estado}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Paquetes destacados */}
      <section style={{ backgroundColor: '#f2e4c0' }} className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.2em', color: '#b07420', textTransform: 'uppercase', marginBottom: 8 }}>Destacados</p>
              <h2 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 900, fontSize: 'clamp(1.8rem,3.5vw,2.5rem)', color: '#1C1208', lineHeight: 1.1 }}>{t('nav_packages')}</h2>
            </div>
            <Link to="/paquetes" style={{ fontSize: '0.82rem', color: '#b07420', fontWeight: 600, textDecoration: 'none' }}>Ver todos →</Link>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {destacados.map((ex) => (
              <Link
                key={ex.id}
                to={`/excursiones/${ex.id}`}
                className="group overflow-hidden transition-all"
                style={{ background: '#f9f3e3', borderRadius: 20, border: '1px solid #e8d09a', textDecoration: 'none', display: 'block' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow='0 8px 30px rgba(28,18,8,0.12)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow='none'}
              >
                <div className="relative overflow-hidden" style={{ height: 220 }}>
                  <img
                    src={ex.imagen}
                    alt={ex.nombre}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {ex.cuposDisponibles <= 3 && (
                    <span style={{ position: 'absolute', top: 12, right: 12, background: '#c0392b', color: 'white', fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: 999 }}>
                      ¡Últimos {ex.cuposDisponibles}!
                    </span>
                  )}
                  <div style={{ position: 'absolute', top: 12, left: 12, background: '#1C1208CC', color: '#f2e4c0', fontSize: '0.68rem', fontWeight: 600, padding: '4px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {ex.destino}
                  </div>
                </div>
                <div className="p-5">
                  <h3 style={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, fontSize: '1.1rem', color: '#1C1208', marginBottom: 6 }}>{ex.nombre}</h3>
                  <p style={{ fontSize: '0.82rem', color: '#1C1208AA', marginBottom: 16, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ex.descripcion}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e8d09a', paddingTop: 12 }}>
                    <span style={{ fontFamily: '"Playfair Display", serif', fontWeight: 900, fontSize: '1.2rem', color: '#b07420' }}>{formatPrecio(ex.precio, ex.moneda)}</span>
                    <span style={{ fontSize: '0.75rem', color: '#1C1208AA' }}>⏱ {ex.duracion}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA dark */}
      <section style={{ backgroundColor: '#1C1208', color: '#f9f3e3' }} className="py-20">
        <div className="max-w-2xl mx-auto text-center px-4">
          <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.25em', color: '#d9a83a', textTransform: 'uppercase', marginBottom: 16 }}>Viajá con nosotros</p>
          <h2 style={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 900, fontSize: 'clamp(1.8rem,4vw,2.8rem)', color: '#f9f3e3', lineHeight: 1.15, marginBottom: 16 }}>
            ¿Querés armar tu viaje a medida?
          </h2>
          <p style={{ color: '#e8d09a99', fontSize: '1rem', marginBottom: 36, fontWeight: 300 }}>
            Hablá directamente con nuestro equipo por WhatsApp.
          </p>
          <a
            href={`https://wa.me/${config.whatsapp}?text=Hola!%20Me%20interesa%20viajar%20al%20Nordeste%20Brasilero`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--cp, #b07420)', color: '#f9f3e3', fontWeight: 700, padding: '16px 40px', borderRadius: 999, fontSize: '1rem', transition: 'background 0.15s', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.background='var(--cp-dark, #8a581e)'}
            onMouseLeave={e => e.currentTarget.style.background='var(--cp, #b07420)'}
          >
            💬 Escribinos por WhatsApp
          </a>
        </div>
      </section>
    </div>
  )
}
