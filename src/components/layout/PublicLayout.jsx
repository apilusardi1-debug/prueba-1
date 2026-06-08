import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext.jsx'
import { useSiteConfig } from '../../context/SiteConfigContext.jsx'
import { languages } from '../../lib/i18n.js'

const C = {
  amarillo: '#f6c31b',
  crema:    '#fff9e5',
  teal:     '#18c5e6',
  oscuro:   '#1c1208',
}

const NAV_MAIN = [
  { to: '/paquetes',    label: 'PAQUETES AÉREOS' },
  { to: '/excursiones', label: 'EXCURSIONES' },
  { to: '/hoteles',     label: 'HOTELES & POSADAS' },
  { to: '/traslados',   label: 'TRASLADOS' },
]

export default function PublicLayout() {
  const { pathname } = useLocation()
  const { t, lang, changeLang } = useLang()
  const { config } = useSiteConfig()
  const [menuOpen, setMenuOpen] = useState(false)

  const allLinks = [
    ...NAV_MAIN,
    { to: '/destinos',    label: t('nav_destinations') },
    { to: '/marea',       label: t('nav_tides') },
    { to: '/nosotros',    label: t('nav_about') },
    { to: '/mis-reservas', label: t('nav_my_bookings') },
  ]

  const pillStyle = (active) => ({
    border: `1.5px solid ${C.amarillo}`,
    color: active ? C.oscuro : C.amarillo,
    background: active ? C.amarillo : 'transparent',
    fontWeight: 700,
    padding: '6px 16px',
    borderRadius: 999,
    fontSize: '0.72rem',
    letterSpacing: '0.06em',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s',
  })

  const rightBtnStyle = {
    background: C.amarillo,
    color: C.oscuro,
    fontWeight: 700,
    padding: '7px 16px',
    borderRadius: 999,
    fontSize: '0.72rem',
    letterSpacing: '0.06em',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    border: 'none',
    cursor: 'pointer',
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: C.crema }}>

      {/* ── Header ───────────────────────────────────────────────── */}
      <header style={{ backgroundColor: C.crema, borderBottom: `1px solid rgba(246,195,27,0.3)`, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menú"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 5 }}
          >
            {menuOpen ? (
              <span style={{ fontSize: '1.2rem', color: C.teal, lineHeight: 1 }}>✕</span>
            ) : (
              <>
                <span style={{ display: 'block', width: 22, height: 2.5, background: C.teal, borderRadius: 2 }} />
                <span style={{ display: 'block', width: 22, height: 2.5, background: C.teal, borderRadius: 2 }} />
                <span style={{ display: 'block', width: 22, height: 2.5, background: C.teal, borderRadius: 2 }} />
              </>
            )}
          </button>

          {/* Logo */}
          <Link to="/" style={{ flexShrink: 0, textDecoration: 'none' }}>
            <img
              src="https://media.canva.com/v2/image-resize/format:PNG/height:133/quality:100/uri:ifs%3A%2F%2FM%2F5d20c91a-75a5-4e35-83d7-cf63cc5d962e/watermark:F/width:200?csig=AAAAAAAAAAAAAAAAAAAAAAz0Pc6CmnLRCkmUqhgjQFjNYR-bwXLLZt1XYD_B6-Oj&exp=1780900932&osig=AAAAAAAAAAAAAAAAAAAAAPG6RDyIwdZt4Z645t3j3fZEgfJyUGqkvUgjtlKOsCmH&signer=media-rpc&x-canva-quality=thumbnail"
              alt="Dream Tours"
              style={{ height: 48, width: 'auto', objectFit: 'contain', display: 'block' }}
              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }}
            />
            <div style={{ display: 'none' }}>
              <span style={{ fontFamily: '"Pacifico", cursive', fontSize: '1.3rem', color: C.oscuro }}>
                Dream<span style={{ color: C.teal }}>Tours</span>
              </span>
            </div>
          </Link>

          {/* Nav pills — center (desktop) */}
          <nav style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}
            className="hidden-mobile">
            <style>{`@media(max-width:900px){.hidden-mobile{display:none!important}}`}</style>
            {NAV_MAIN.map(({ to, label }) => {
              const active = pathname === to || pathname.startsWith(to + '/')
              return (
                <Link key={to} to={to}
                  style={pillStyle(active)}
                  onMouseEnter={e => { e.currentTarget.style.background = C.amarillo; e.currentTarget.style.color = C.oscuro }}
                  onMouseLeave={e => { e.currentTarget.style.background = active ? C.amarillo : 'transparent'; e.currentTarget.style.color = active ? C.oscuro : C.amarillo }}
                >
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 'auto' }}>
            {/* Idioma */}
            <select value={lang} onChange={(e) => changeLang(e.target.value)}
              style={{ ...rightBtnStyle, appearance: 'none', paddingRight: 24, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%231c1208'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
              {languages.map((l) => (
                <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
              ))}
            </select>

            {/* Contactanos */}
            <a
              href={`https://wa.me/${config.whatsapp}?text=Hola!%20Me%20interesa%20viajar%20al%20Nordeste%20Brasilero`}
              target="_blank" rel="noopener noreferrer"
              style={rightBtnStyle}
            >
              CONTACTANOS
            </a>

            {/* Mis reservas */}
            <Link to="/mis-reservas" style={rightBtnStyle}>
              MIS RESERVAS
            </Link>
          </div>
        </div>

        {/* Menú mobile */}
        {menuOpen && (
          <div style={{ backgroundColor: C.crema, borderTop: `1px solid rgba(246,195,27,0.3)`, padding: '12px 20px 20px' }}>
            {allLinks.map(({ to, label }) => (
              <Link key={to} to={to}
                onClick={() => setMenuOpen(false)}
                style={{ display: 'block', padding: '10px 0', fontSize: '0.9rem', fontWeight: 600, color: C.oscuro, textDecoration: 'none', borderBottom: `1px solid rgba(246,195,27,0.2)` }}
              >
                {label}
              </Link>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1"><Outlet /></main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer style={{ backgroundColor: C.oscuro, color: '#fff9e5' }} className="py-12">
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 32 }}>
          <div>
            <img
              src="/logo.png.jpeg"
              alt="Dream Tours"
              style={{ height: 48, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)', marginBottom: 8 }}
              onError={(e) => { e.target.style.display = 'none' }}
            />
            <p style={{ fontFamily: '"Pacifico", cursive', fontSize: '1.1rem', color: C.amarillo }}>Dream Tours</p>
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,249,229,0.6)', marginTop: 4 }}>{t('footer_tagline')}</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 32px', alignContent: 'flex-start' }}>
            {allLinks.slice(0, 7).map(({ to, label }) => (
              <Link key={to} to={to} style={{ fontSize: '0.82rem', color: 'rgba(255,249,229,0.65)', textDecoration: 'none' }}>{label}</Link>
            ))}
            <Link to="/login" style={{ fontSize: '0.82rem', color: 'rgba(255,249,229,0.65)', textDecoration: 'none' }}>{t('footer_team')}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
