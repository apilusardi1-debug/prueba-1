import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useLang } from '../../context/LanguageContext.jsx'
import { languages } from '../../lib/i18n.js'

export default function PublicLayout() {
  const { pathname } = useLocation()
  const { t, lang, changeLang } = useLang()
  const [menuOpen, setMenuOpen] = useState(false)

  const navLinks = [
    { to: '/paquetes',   label: t('nav_packages') },
    { to: '/destinos',   label: t('nav_destinations') },
    { to: '/excursiones', label: t('nav_excursions') },
    { to: '/hoteles',    label: t('nav_hotels') },
    { to: '/marea',      label: t('nav_tides') },
    { to: '/nosotros',   label: t('nav_about') },
    { to: '/mis-reservas', label: t('nav_my_bookings') },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="text-xl font-black text-brand-700 tracking-tight shrink-0">
            ✈️ DREAMSTOUR
          </Link>

          {/* Nav desktop */}
          <nav className="hidden lg:flex items-center gap-5 text-sm font-medium">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`hover:text-brand-600 transition-colors whitespace-nowrap ${pathname.startsWith(to) ? 'text-brand-600' : 'text-gray-600'}`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Derecha: idioma + WhatsApp */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Selector de idioma */}
            <div className="relative">
              <select
                value={lang}
                onChange={(e) => changeLang(e.target.value)}
                className="appearance-none bg-gray-50 border border-gray-200 text-sm rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:ring-2 focus:ring-brand-400 cursor-pointer"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
            </div>

            <a
              href="https://wa.me/5491100000000"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
            >
              💬 {t('nav_whatsapp')}
            </a>

            {/* Hamburger mobile */}
            <button
              className="lg:hidden p-2 text-gray-600 hover:text-gray-900"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Menú mobile */}
        {menuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 px-4 py-3 space-y-2">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className="block py-2 text-sm text-gray-700 hover:text-brand-600 border-b border-gray-50"
              >
                {label}
              </Link>
            ))}
            <a
              href="https://wa.me/5491100000000"
              target="_blank"
              rel="noopener noreferrer"
              className="block py-2 text-sm text-green-600 font-medium"
            >
              💬 WhatsApp
            </a>
          </div>
        )}
      </header>

      {/* Contenido */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 text-sm py-10 mt-16">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between gap-6">
          <div>
            <p className="text-white font-black text-lg mb-1">✈️ DREAMSTOUR</p>
            <p>{t('footer_tagline')}</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {navLinks.slice(0, 6).map(({ to, label }) => (
              <Link key={to} to={to} className="hover:text-white transition-colors">{label}</Link>
            ))}
            <Link to="/login" className="hover:text-white transition-colors">{t('footer_team')}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
