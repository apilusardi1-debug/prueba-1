import { useState, useRef, useEffect } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { SidebarProvider, useSidebar } from '../../context/SidebarContext'
import { tieneAcceso } from '../../lib/roles.js'
import { supabase, conversacionesApi } from '../../lib/supabase.js'
import { useAvisosMensajes } from '../../lib/avisosMensajes.js'
import MenuAvisos from './MenuAvisos.jsx'
import AvisosCarteles from './AvisosCarteles.jsx'

function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  useEffect(() => {
    const html = document.documentElement
    if (dark) { html.classList.add('dark'); localStorage.setItem('theme', 'dark') }
    else { html.classList.remove('dark'); localStorage.setItem('theme', 'light') }
  }, [dark])
  return [dark, setDark]
}

/* ─── Iconos SVG ────────────────────────────────────────────────── */
const Icon = {
  Dashboard: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  CRM: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Leads: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
    </svg>
  ),
  Clientes: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  WhatsApp: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Reservas: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  Excursiones: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 11 22 2 13 21 11 13 3 11"/>
    </svg>
  ),
  Agenda: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Hospedajes: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Videos: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  ),
  Nuevo: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Paquetes: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73z"/>
      <polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/>
    </svg>
  ),
  Generador: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
    </svg>
  ),
  Enviadas: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  Cerradas: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  Equipo: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Finanzas: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  Config: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  Chevron: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  Menu: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  Close: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Globe: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  Logout: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  Dots: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
      <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
    </svg>
  ),
}

/* ─── Navegación ────────────────────────────────────────────────── */
const NAV = [
  { path: '/admin', label: 'Dashboard', icon: Icon.Dashboard, exact: true },
  { path: '/admin/clientes', label: 'Clientes', icon: Icon.Clientes },
  {
    label: 'CRM', icon: Icon.CRM,
    sub: [
      { path: '/admin/leads',        label: 'Embudo de paquetes', icon: Icon.Leads, exact: true },
      { path: '/admin/leads/paseos', label: 'Embudo de paseos',   icon: Icon.Leads },
      { path: '/admin/crm/whatsapp', label: 'WhatsApp',  icon: Icon.WhatsApp },
    ],
  },
  { path: '/admin/reservas',    label: 'Reservas',    icon: Icon.Reservas },
  { path: '/admin/excursiones', label: 'Excursiones', icon: Icon.Excursiones },
  { path: '/admin/agenda',      label: 'Agenda',      icon: Icon.Agenda },
  {
    label: 'Hospedajes', icon: Icon.Hospedajes,
    sub: [
      { path: '/admin/hospedajes',          label: 'Listado',            icon: Icon.Hospedajes, exact: true },
      { path: '/admin/hospedajes/nuevo',    label: 'Nuevo hospedaje',    icon: Icon.Nuevo },
    ],
  },
  { path: '/admin/videos',      label: 'Videos',      icon: Icon.Videos },
  {
    label: 'Paquetes', icon: Icon.Paquetes,
    sub: [
      { path: '/admin/paquetes/clientes',  label: 'Clientes',            icon: Icon.Clientes },
      { path: '/admin/paquetes/generador', label: 'Generador propuesta', icon: Icon.Generador },
      { path: '/admin/paquetes/enviadas',  label: 'Propuestas enviadas', icon: Icon.Enviadas },
      { path: '/admin/paquetes/cerradas',  label: 'Propuestas cerradas', icon: Icon.Cerradas },
    ],
  },
  { path: '/admin/finanzas',    label: 'Finanzas',    icon: Icon.Finanzas },
  { path: '/admin/equipo',      label: 'Equipo',      icon: Icon.Equipo },
  { path: '/admin/configuracion', label: 'Configuración', icon: Icon.Config },
]

/* ─── Sidebar ───────────────────────────────────────────────────── */
function Sidebar() {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered, toggleMobileSidebar } = useSidebar()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // En el celular, tocar un ítem del menú tiene que cerrarlo: si no, el cajón se queda
  // abierto tapando la pantalla a la que se acaba de navegar.
  const cerrarSiMobile = () => { if (isMobileOpen) toggleMobileSidebar() }
  const subMenuRefs = useRef({})
  const [subHeights, setSubHeights] = useState({})
  const [openSub, setOpenSub] = useState(null)
  const [pendientesWhatsapp, setPendientesWhatsapp] = useState(0)
  const visible = isExpanded || isHovered || isMobileOpen

  // Conversaciones sin leer del CRM — visible en el menú aunque no estés en esa página
  useEffect(() => {
    function contar(convs) {
      setPendientesWhatsapp((convs || []).filter(c => c.no_leidos > 0).length)
    }
    conversacionesApi.getAll().then(({ data }) => contar(data))

    if (!supabase) return
    const channel = supabase
      .channel('nav-conversaciones-pendientes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones' }, () => {
        conversacionesApi.getAll().then(({ data }) => contar(data))
      })
      .subscribe()

    return () => channel.unsubscribe()
  }, [])

  // Cantidad de conversaciones sin leer en el título de la pestaña: se ve aunque
  // el panel esté en segundo plano
  useEffect(() => {
    const sinNumero = () => document.title.replace(/^\(\d+\)\s*/, '')
    document.title = pendientesWhatsapp > 0 ? `(${pendientesWhatsapp}) ${sinNumero()}` : sinNumero()
    return () => { document.title = sinNumero() }
  }, [pendientesWhatsapp])

  const rol = JSON.parse(localStorage.getItem('admin_session') || '{}').role
  const navVisible = NAV
    .map(item => {
      if (item.sub) {
        const sub = item.sub.filter(s => tieneAcceso(rol, s.path))
        return sub.length ? { ...item, sub } : null
      }
      return tieneAcceso(rol, item.path) ? item : null
    })
    .filter(Boolean)

  function isActive(path, exact) {
    return exact ? pathname === path : pathname === path || pathname.startsWith(path + '/')
  }

  // Abrir automáticamente el sub que contiene la ruta activa
  useEffect(() => {
    navVisible.forEach((item, i) => {
      if (item.sub?.some(s => pathname.startsWith(s.path))) {
        setOpenSub(i)
      }
    })
  }, [pathname])

  // Medir altura de submenús para animación
  useEffect(() => {
    if (openSub !== null && subMenuRefs.current[openSub]) {
      setSubHeights(p => ({
        ...p,
        [openSub]: subMenuRefs.current[openSub].scrollHeight,
      }))
    }
  }, [openSub, visible])

  function toggleSub(i) {
    setOpenSub(prev => (prev === i ? null : i))
    if (subMenuRefs.current[i]) {
      setSubHeights(p => ({ ...p, [i]: subMenuRefs.current[i].scrollHeight }))
    }
  }

  function logout() {
    localStorage.removeItem('admin_session')
    navigate('/login')
  }

  return (
    <aside
      className={`fixed top-0 left-0 h-screen z-50 bg-white dark:bg-zinc-950 border-r border-gray-200 dark:border-zinc-800 flex flex-col transition-all duration-300 ease-in-out
        ${visible ? 'w-[290px]' : 'w-[90px]'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo */}
      <div className={`flex items-center py-6 px-5 border-b border-gray-100 dark:border-zinc-800 ${!visible ? 'justify-center' : ''}`}>
        {visible ? (
          <div className="w-full">
            <img src="/logo-panel.png" alt="Dream Tours" className="mx-auto hidden h-auto w-[132px] dark:block" />
            <div className="dark:hidden">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">Panel interno</p>
              <p className="text-lg font-bold text-gray-900">DREAMTOURS</p>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <span className="text-white dark:text-zinc-900 font-bold text-sm">D</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-5 px-4">
        {visible && (
          <p className="text-[11px] font-semibold text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-3 px-1">Menú</p>
        )}
        {!visible && <div className="flex justify-center mb-3"><Icon.Dots /></div>}

        <ul className="space-y-1">
          {navVisible.map((item, i) => {
            if (item.sub) {
              const parentActive = item.sub.some(s => pathname.startsWith(s.path))
              const isOpen = openSub === i

              return (
                <li key={i}>
                  <button
                    onClick={() => toggleSub(i)}
                    className={`menu-item group w-full ${!visible ? 'justify-center' : ''} ${
                      parentActive ? 'menu-item-active' : 'menu-item-inactive'
                    }`}
                  >
                    <span className={`relative size-6 flex-shrink-0 ${parentActive ? 'menu-item-icon-active' : 'menu-item-icon-inactive'}`}>
                      <item.icon />
                      {item.label === 'CRM' && pendientesWhatsapp > 0 && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
                      )}
                    </span>
                    {visible && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.label === 'CRM' && pendientesWhatsapp > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                            {pendientesWhatsapp}
                          </span>
                        )}
                        <Icon.Chevron className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-brand-500' : 'text-gray-400'}`} />
                      </>
                    )}
                  </button>

                  {visible && (
                    <div
                      ref={el => { subMenuRefs.current[i] = el }}
                      className="overflow-hidden transition-all duration-300 ease-in-out"
                      style={{ height: isOpen ? `${subHeights[i] || 0}px` : '0px' }}
                    >
                      <ul className="mt-1 ml-3 space-y-1 border-l border-gray-100 dark:border-zinc-800 pl-3">
                        {item.sub.map(s => (
                          <li key={s.path}>
                            <Link
                              to={s.path}
                              onClick={cerrarSiMobile}
                              className={`menu-dropdown-item ${
                                isActive(s.path, s.exact) ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'
                              }`}
                            >
                              <span className="size-4 flex-shrink-0"><s.icon /></span>
                              <span className="flex-1">{s.label}</span>
                              {s.path === '/admin/crm/whatsapp' && pendientesWhatsapp > 0 && (
                                <span className="bg-red-500 text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                                  {pendientesWhatsapp}
                                </span>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              )
            }

            const active = isActive(item.path, item.exact)
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={cerrarSiMobile}
                  className={`menu-item group ${!visible ? 'justify-center' : ''} ${
                    active ? 'menu-item-active' : 'menu-item-inactive'
                  }`}
                >
                  <span className={`size-6 flex-shrink-0 ${active ? 'menu-item-icon-active' : 'menu-item-icon-inactive'}`}>
                    <item.icon />
                  </span>
                  {visible && <span>{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 dark:border-zinc-800 px-4 py-4 space-y-1">
        <Link
          to="/"
          onClick={cerrarSiMobile}
          className={`menu-item menu-item-inactive ${!visible ? 'justify-center' : ''}`}
        >
          <span className="size-6 flex-shrink-0 menu-item-icon-inactive"><Icon.Globe /></span>
          {visible && <span>Ver sitio público</span>}
        </Link>
        <button
          onClick={logout}
          className={`menu-item menu-item-inactive w-full ${!visible ? 'justify-center' : ''}`}
        >
          <span className="size-6 flex-shrink-0 menu-item-icon-inactive"><Icon.Logout /></span>
          {visible && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  )
}

/* ─── Header ────────────────────────────────────────────────────── */
function Header({ dark, setDark, avisos, puedeAvisos }) {
  const { toggleSidebar, toggleMobileSidebar } = useSidebar()
  const { pathname } = useLocation()

  function handleToggle() {
    if (window.innerWidth >= 1024) toggleSidebar()
    else toggleMobileSidebar()
  }

  function getTitle() {
    if (pathname === '/admin') return 'Dashboard'
    if (pathname.startsWith('/admin/leads/paseos')) return 'Embudo de paseos'
    if (pathname.startsWith('/admin/leads')) return 'Embudo de paquetes'
    if (pathname.startsWith('/admin/clientes')) return 'Clientes'
    if (pathname.startsWith('/admin/crm/whatsapp')) return 'WhatsApp'
    if (pathname.startsWith('/admin/reservas')) return 'Reservas'
    if (pathname.startsWith('/admin/excursiones')) return 'Excursiones'
    if (pathname.startsWith('/admin/agenda')) return 'Agenda'
    if (pathname.startsWith('/admin/hospedajes/nuevo')) return 'Nuevo hospedaje'
    if (pathname.startsWith('/admin/hospedajes')) return 'Hospedajes'
    if (pathname.startsWith('/admin/videos')) return 'Videos'
    if (pathname.startsWith('/admin/paquetes/clientes')) return 'Clientes de Paquetes'
    if (pathname.startsWith('/admin/paquetes/generador')) return 'Generador de Propuesta'
    if (pathname.startsWith('/admin/paquetes/enviadas')) return 'Propuestas Enviadas'
    if (pathname.startsWith('/admin/paquetes/cerradas')) return 'Propuestas Cerradas'
    if (pathname.startsWith('/admin/finanzas')) return 'Finanzas'
    if (pathname.startsWith('/admin/equipo')) return 'Equipo'
    if (pathname.startsWith('/admin/configuracion')) return 'Configuración'
    return 'Panel'
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 flex items-center px-4 py-3 gap-4 lg:px-6 transition-colors">
      <button
        onClick={handleToggle}
        className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
      >
        <span className="size-5"><Icon.Menu /></span>
      </button>

      <h1 className="text-base font-semibold text-gray-800 dark:text-zinc-100">{getTitle()}</h1>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Avisos de mensajes nuevos del CRM (sonido y notificación) */}
        {puedeAvisos && <MenuAvisos avisos={avisos} />}

        {/* Toggle dark mode */}
        <button
          onClick={() => setDark(!dark)}
          title={dark ? 'Modo claro' : 'Modo oscuro'}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
        >
          {dark ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>

        <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center">
          <span className="text-white dark:text-zinc-900 text-xs font-semibold">A</span>
        </div>
      </div>
    </header>
  )
}

/* ─── Backdrop mobile ───────────────────────────────────────────── */
function Backdrop() {
  const { isMobileOpen, toggleMobileSidebar } = useSidebar()
  if (!isMobileOpen) return null
  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 lg:hidden"
      onClick={toggleMobileSidebar}
    />
  )
}

/* ─── Layout principal ──────────────────────────────────────────── */
function LayoutContent() {
  const { isExpanded, isHovered } = useSidebar()
  const [dark, setDark] = useDarkMode()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // El CRM de WhatsApp es una app de chat: en el celular no le podemos restar espacio con el
  // margen que sí tiene el resto de las pantallas del panel. De lg (1024px) para arriba queda
  // exactamente igual que siempre.
  const esWhatsApp = pathname.startsWith('/admin/crm/whatsapp')
  const puedeAvisos = tieneAcceso(JSON.parse(localStorage.getItem('admin_session') || '{}').role, '/admin/crm/whatsapp')
  const avisos = useAvisosMensajes({ habilitado: puedeAvisos, navigate })
  const abrirCartel = c => {
    navigate(`/admin/crm/whatsapp?phone=${c.whatsapp}`)
    avisos.cerrarCartel(c.id)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 admin-ui transition-colors">
      <Sidebar />
      <Backdrop />
      {puedeAvisos && <AvisosCarteles carteles={avisos.carteles} alCerrar={avisos.cerrarCartel} alAbrir={abrirCartel} />}
      <div className={`transition-all duration-300 ease-in-out ${esWhatsApp ? 'flex h-dvh flex-col overflow-hidden' : ''} ${
        isExpanded || isHovered ? 'lg:ml-[290px]' : 'lg:ml-[90px]'
      }`}>
        <Header dark={dark} setDark={setDark} avisos={avisos} puedeAvisos={puedeAvisos} />
        {/* El CRM de WhatsApp necesita la pantalla fija: el header y la lista de conversaciones
            quedan quietos, y solo se mueve la lista o los mensajes cuando se hace scroll ahí
            adentro (nunca la página entera). Por eso acá "main" no scrollea: queda del alto
            justo que sobra (flex-1 + min-h-0) y WhatsApp.jsx maneja el scroll de cada columna. */}
        <main className={esWhatsApp
          ? 'min-h-0 flex-1 overflow-hidden lg:mx-auto lg:w-full lg:max-w-screen-2xl lg:p-6'
          : 'p-4 md:p-6 max-w-screen-2xl mx-auto'}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  )
}
