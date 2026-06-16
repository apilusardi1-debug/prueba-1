import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'

const navItems = [
  { path: '/admin',             label: 'Dashboard',     icon: '📊' },
  { path: '/admin/reservas',    label: 'Reservas',      icon: '📋' },
  { path: '/admin/excursiones', label: 'Excursiones',   icon: '🗺️' },
  { path: '/admin/agenda',      label: 'Agenda',        icon: '📅' },
  { path: '/admin/equipo',      label: 'Equipo',        icon: '👤' },
  { path: '/admin/configuracion', label: 'Configuración', icon: '⚙️' },
]

const crmItems = [
  { path: '/admin/leads',           label: 'Leads',     icon: '🎯' },
  { path: '/admin/clientes',        label: 'Clientes',  icon: '👥' },
  { path: '/admin/crm/whatsapp',    label: 'WhatsApp',  icon: '💬' },
]

export default function AdminLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const enCRM = crmItems.some(i => pathname.startsWith(i.path))
  const [crmAbierto, setCrmAbierto] = useState(enCRM || true)

  function handleLogout() {
    localStorage.removeItem('admin_session')
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 text-white flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Panel interno</p>
          <p className="font-bold text-lg">DREAMSTOUR</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {/* Dashboard */}
          <Link
            to="/admin"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === '/admin'
                ? 'bg-brand-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <span>📊</span> Dashboard
          </Link>

          {/* CRM Group */}
          <div>
            <button
              onClick={() => setCrmAbierto(v => !v)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                enCRM ? 'bg-brand-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span>🤝</span>
              <span className="flex-1 text-left">CRM</span>
              <span className="text-xs">{crmAbierto ? '▾' : '▸'}</span>
            </button>

            {crmAbierto && (
              <div className="ml-3 mt-1 space-y-1">
                {crmItems.map(({ path, label, icon }) => {
                  const active = pathname === path || pathname.startsWith(path + '/')
                  return (
                    <Link
                      key={path}
                      to={path}
                      className={`flex items-center gap-3 pl-4 pr-3 py-2 rounded-lg text-sm transition-colors ${
                        active
                          ? 'bg-gray-700 text-white'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      <span>{icon}</span>
                      {label}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Resto de items */}
          {navItems.slice(1).map(({ path, label, icon }) => {
            const active = pathname === path
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span>{icon}</span>
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-3 py-4 border-t border-gray-700">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            🌐 Ver sitio público
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors mt-1"
          >
            🚪 Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
