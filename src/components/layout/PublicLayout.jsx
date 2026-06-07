import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext.jsx'
import { useSiteConfig } from '../../context/SiteConfigContext.jsx'
import { languages } from '../../lib/i18n.js'

export default function PublicLayout() {
  const { pathname } = useLocation()
  const { t, lang, changeLang } = useLang()
  const { config } = useSiteConfig()
  const [menuOpen, setMenuOpen] = useState(false)

  const navLinks = [
    { to: '/paquetes',    label: t('nav_packages') },
    { to: '/destinos',    label: t('nav_destinations') },
    { to: '/excursiones', label: t('nav_excursions') },
    { to: '/hoteles',     label: t('nav_hotels') },
    { to: '/marea',       label: t('nav_tides') },
    { to: '/nosotros',    label: t('nav_about') },
    { to: '/mis-reservas', label: t('nav_my_bookings') },
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f9f3e3' }}>
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-amber-200" style={{ backgroundColor: '#f9f3e3' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0">
            <img
              src="/logo.png"
              alt="Dream Tours"
              style={{ height: 56, width: 'auto', objectFit: 'contain', display: 'block' }}
              onError={(e) => {
                // Si el logo no existe, muestra el texto como fallback
                e.target.style.display = 'none'
                e.target.nextSibling.style.display = 'block'
              }}
            />
            <div style={{ display: 'none' }}>
              <p style={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 900, fontSize: '1.4rem', lineHeight: 1, color: '#1C1208', letterSpacing: '-0.02em' }}>
                DREAM<span style={{ color: '#b07420' }}>TOURS</span>
              </p>
              <p style={{ fontSize: '0.6rem', letterSpacing: '0.2em', color: '#b07420', fontWeight: 500, textTransform: 'uppercase', marginTop: 2 }}>
                Creadores de Sueños
              </p>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-5" style={{ fontSize: '0.82rem', fontWeight: 500 }}>
            {navLinks.map(({ to, label }) => (
              <Link key={to} to={to}
                style={{ color: pathname.startsWith(to) ? '#b07420' : '#1C1208CC', transition: 'color 0.15s', whiteSpace: 'nowrap' }}
                onMouseEnter={e => e.target.style.color='#b07420'}
                onMouseLeave={e => e.target.style.color = pathname.startsWith(to) ? '#b07420' : '#1C1208CC'}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <select value={lang} onChange={(e) => changeLang(e.target.value)}
              style={{ background: 'transparent', border: '1px solid #d9a83a', borderRadius: 999, padding: '6px 12px', fontSize: '0.8rem', color: '#1C1208', cursor: 'pointer' }}>
              {languages.map((l) => (
                <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
              ))}
            </select>

            <a href={`https://wa.me/${config.whatsapp}`} target="_blank" rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium transition-colors"
              style={{ background: '#1C1208', color: '#f9f3e3' }}>
              💬 WhatsApp
            </a>

            <button className="lg:hidden p-2" style={{ color: '#1C120880' }} onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="lg:hidden border-t px-6 py-4 space-y-1" style={{ backgroundColor: '#f9f3e3', borderColor: '#e8d09a' }}>
            {navLinks.map(({ to, label }) => (
              <Link key={to} to={to} onClick={() => setMenuOpen(false)}
                className="block py-2.5 text-sm border-b" style={{ color: '#1C1208CC', borderColor: '#f2e4c0' }}>
                {label}
              </Link>
            ))}
            <a href={`https://wa.me/${config.whatsapp}`} target="_blank" rel="noopener noreferrer"
              className="block pt-3 text-sm font-medium" style={{ color: '#16a34a' }}>💬 WhatsApp</a>
          </div>
        )}
      </header>

      <main className="flex-1"><Outlet /></main>

      <footer style={{ backgroundColor: '#1C1208', color: '#f2e4c0' }} className="py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-8">
          <div>
            <img
              src="/logo.png"
              alt="Dream Tours"
              style={{ height: 52, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)', marginBottom: 6 }}
              onError={(e) => { e.target.style.display = 'none' }}
            />
            <p style={{ fontFamily: '"Playfair Display", serif', fontWeight: 900, fontSize: '1.2rem', color: '#f9f3e3' }}>DREAM TOURS</p>
            <p className="text-sm mt-1" style={{ color: '#e8d09a' }}>{t('footer_tagline')}</p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            {navLinks.slice(0, 6).map(({ to, label }) => (
              <Link key={to} to={to} className="text-sm transition-colors" style={{ color: '#e8d09a' }}>{label}</Link>
            ))}
            <Link to="/login" className="text-sm" style={{ color: '#e8d09a' }}>{t('footer_team')}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
