import { useState, useEffect, useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext.jsx'
import { useSiteConfig } from '../../context/SiteConfigContext.jsx'
import { languages } from '../../lib/i18n.js'

const NAV_LINKS = [
  { to: '/paquetes',    label: 'Paquetes Aéreos',  icon: 'flight' },
  { to: '/excursiones', label: 'Excursiones',       icon: 'explore' },
  { to: '/hoteles',     label: 'Hoteles & Posadas', icon: 'hotel' },
  { to: '/traslados',   label: 'Traslados',         icon: 'directions_car' },
  { to: '/destinos',    label: 'Destinos',          icon: 'map' },
  { to: '/marea',       label: 'Tabla de Marea',    icon: 'waves' },
  { to: '/nosotros',    label: 'Nosotros',          icon: 'group' },
  { to: '/mis-reservas',label: 'Mis Reservas',      icon: 'confirmation_number' },
]

const FOOTER_LINKS = [
  { to: '/',            label: 'Inicio' },
  { to: '/paquetes',    label: 'Paquetes' },
  { to: '/excursiones', label: 'Paseos' },
  { to: '/nosotros',    label: 'Quiénes somos?' },
]

export default function PublicLayout() {
  const { lang, changeLang } = useLang()
  const { config } = useSiteConfig()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [langDropdownOpen, setLangDropdownOpen] = useState(false)
  const langDropdownRef = useRef(null)
  const { pathname } = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setDrawerOpen(false) }, [pathname])

  useEffect(() => {
    function handleClickOutside(e) {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target)) {
        setLangDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const iconColor = scrolled ? '#002147' : 'white'

  return (
    <div className="min-h-screen bg-surface overflow-x-hidden">

      {/* Header */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 backdrop-blur-md ${scrolled ? 'bg-white/95 shadow-md' : 'bg-transparent'}`}>
        <div className="flex justify-between items-center px-margin-mobile md:px-margin-desktop py-5">
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Link to="/" aria-label="Inicio" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4px", lineHeight: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/>
                <path d="M9 21V12h6v9"/>
              </svg>
            </Link>
            <button onClick={() => setDrawerOpen(true)} aria-label="Menú" style={{ display: "flex", alignItems: "center", padding: "4px", background: "none", border: "none", cursor: "pointer" }}>
              <span className="material-symbols-outlined" style={{ color: iconColor, fontSize: "22px", lineHeight: 1 }}>menu</span>
            </button>
          </div>
          <Link to="/" aria-label="Inicio" className="flex-shrink-0">
            <img src="/logo.png" alt="DreamTours" className="h-16 w-auto object-contain"
              style={{ filter: scrolled ? 'none' : 'brightness(0) invert(1)' }}
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }} />
            <span style={{ display: 'none', fontFamily: '"Playfair Display", Georgia, serif', fontSize: '1.5rem', fontWeight: 700, color: scrolled ? '#002147' : 'white' }}>
              DreamTours
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {/* Language selector */}
            <div className="relative" ref={langDropdownRef}>
              <button
                onClick={() => setLangDropdownOpen(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full font-label-lg text-label-lg text-white transition-all duration-200 hover:opacity-90"
                style={{ backgroundColor: scrolled ? '#002147' : 'rgba(26, 56, 90, 0.85)' }}
              >
                <span>{languages.find(l => l.code === lang)?.flag}</span>
                <span className="hidden sm:inline">{languages.find(l => l.code === lang)?.label}</span>
                <span style={{ fontSize: "10px", lineHeight: 1, marginLeft: "2px", opacity: 0.8 }}>▾</span>
              </button>
              {langDropdownOpen && (
                <div className="absolute right-0 mt-2 bg-white rounded-xl shadow-lg border border-surface-variant/30 overflow-hidden z-50 min-w-[140px]">
                  {languages.map(l => (
                    <button key={l.code}
                      onClick={() => { changeLang(l.code); setLangDropdownOpen(false) }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-deep-ocean font-label-lg text-label-lg hover:bg-surface-container-low transition-colors">
                      <span>{l.flag}</span> {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Contactanos */}
            <a href={`https://wa.me/${config?.whatsapp || ''}?text=Hola!%20Me%20interesa%20viajar%20al%20Nordeste%20Brasilero`}
              target="_blank" rel="noopener noreferrer"
              className="hidden md:flex items-center px-4 py-2 rounded-full font-label-lg text-label-lg text-white whitespace-nowrap transition-all duration-200 hover:opacity-90"
              style={{ backgroundColor: scrolled ? '#002147' : 'rgba(32, 67, 97, 0.9)' }}>
              Contactanos
            </a>
            {/* Mis Reservas */}
            <Link to="/mis-reservas"
              className="hidden md:flex items-center px-4 py-2 rounded-full font-label-lg text-label-lg text-white whitespace-nowrap transition-all duration-200 hover:opacity-90"
              style={{ backgroundColor: scrolled ? '#002147' : 'rgba(32, 67, 97, 0.9)' }}>
              Mis Reservas
            </Link>
          </div>
        </div>
      </header>

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[100] flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-72 bg-white shadow-2xl flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-5 border-b border-surface-variant">
              <img src="/logo.png" alt="DreamTours" className="h-14 w-auto object-contain"
                onError={e => { e.target.style.display = 'none' }} />
              <button onClick={() => setDrawerOpen(false)} className="p-1">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-2">
              {NAV_LINKS.map(({ to, label, icon }) => (
                <Link key={to} to={to}
                  className={`flex items-center gap-4 px-6 py-4 transition-colors ${pathname === to ? 'text-deep-ocean bg-surface-container-low font-semibold' : 'text-on-surface-variant hover:text-deep-ocean hover:bg-surface-container-low'}`}>
                  <span className="material-symbols-outlined text-[20px]">{icon}</span>
                  <span className="font-label-lg text-label-lg">{label}</span>
                  <span className="material-symbols-outlined text-[16px] ml-auto opacity-40">chevron_right</span>
                </Link>
              ))}
            </nav>
            <div className="px-6 py-5 border-t border-surface-variant">
              <select value={lang} onChange={e => changeLang(e.target.value)}
                className="w-full border border-surface-variant rounded-lg px-3 py-2 text-sm text-on-surface-variant bg-white">
                {languages.map(l => (
                  <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="pb-16 md:pb-0"><Outlet /></main>

      {/* Footer */}
      <footer className="bg-deep-ocean w-full py-16 mt-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-center px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          {/* Nav links */}
          <nav className="flex flex-col items-center md:items-start gap-4">
            {FOOTER_LINKS.map(({ to, label }) => {
              const active = pathname === to
              return (
                <Link key={to} to={to}
                  className={`font-label-lg text-label-lg uppercase tracking-wide pb-1 border-b-2 transition-colors ${active ? 'text-white border-hero-yellow' : 'text-sand-beige/80 border-transparent hover:text-white'}`}>
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* Tagline central */}
          <div className="flex flex-col items-center text-center">
            <h2 className="font-display-hero uppercase text-white leading-none"
              style={{ fontSize: 'clamp(1.5rem, 3.2vw, 2.25rem)', letterSpacing: '0.01em' }}>
              Hace realidad el viaje
            </h2>
            <p className="font-script-hero text-hero-sky"
              style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)', lineHeight: 1, marginTop: '-0.05em' }}>
              de tus sueños
            </p>
          </div>

          {/* Logo + redes */}
          <div className="flex flex-col items-center md:items-end gap-5">
            <img src="/logo.png" alt="DreamTours" className="h-24 md:h-28 w-auto object-contain"
              style={{ filter: 'brightness(0) invert(1)' }}
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }} />
            <span style={{ display: 'none', fontFamily: '"Playfair Display", Georgia, serif', fontSize: '1.5rem', fontWeight: 700, color: 'white' }}>
              DreamTours
            </span>
            <div className="flex items-center gap-5">
              <a href={config?.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                className="text-sand-beige/80 hover:text-white transition-colors">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="4" width="16" height="16" rx="4" />
                  <circle cx="12" cy="12" r="3" />
                  <line x1="16.5" y1="7.5" x2="16.5" y2="7.501" />
                </svg>
              </a>
              <a href={config?.tiktok_url} target="_blank" rel="noopener noreferrer" aria-label="TikTok"
                className="text-sand-beige/80 hover:text-white transition-colors">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 7.917v4.034a9.948 9.948 0 0 1 -5 -1.951v6.5a6.5 6.5 0 1 1 -8 -6.326v4.326a2.5 2.5 0 1 0 4 2v-13.5h4.083a6.005 6.005 0 0 0 4.917 4.917z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
        <div className="px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto mt-12 pt-6 border-t border-surface-variant/20">
          <p className="text-sm text-sand-beige/60 text-center">© 2025 DreamTours. Tu agencia especializada en el Nordeste de Brasil.</p>
        </div>
      </footer>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 w-full z-50 bg-white border-t border-surface-variant/30 md:hidden">
        <div className="flex justify-around items-center h-16 px-2">
          <Link to="/" className="flex flex-col items-center justify-center w-full h-full text-deep-ocean">
            <span className="material-symbols-outlined mb-0.5 text-[22px]" style={{ fontVariationSettings: '"FILL" 1' }}>home</span>
            <span className="text-[10px] font-semibold">Inicio</span>
          </Link>
          <Link to="/destinos" className="flex flex-col items-center justify-center w-full h-full text-on-surface-variant hover:text-deep-ocean">
            <span className="material-symbols-outlined mb-0.5 text-[22px]">explore</span>
            <span className="text-[10px]">Destinos</span>
          </Link>
          <Link to="/excursiones" className="flex flex-col items-center justify-center w-full h-full text-on-surface-variant hover:text-deep-ocean">
            <span className="material-symbols-outlined mb-0.5 text-[22px]">directions_boat</span>
            <span className="text-[10px]">Tours</span>
          </Link>
          <a href={`https://wa.me/${config?.whatsapp || ''}?text=Hola!%20Quiero%20info`}
            target="_blank" rel="noopener noreferrer"
            className="flex flex-col items-center justify-center w-full h-full text-on-surface-variant hover:text-deep-ocean">
            <span className="material-symbols-outlined mb-0.5 text-[22px]">chat</span>
            <span className="text-[10px]">Contacto</span>
          </a>
        </div>
      </nav>

    </div>
  )
}
