import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'

const navItems = [
  { path: '/admin',                   label: 'Dashboard',       icon: '📊' },
  { path: '/admin/leads',             label: 'Leads',           icon: '🎯' },
  { path: '/admin/clientes',          label: 'Clientes',        icon: '👥' },
  { path: '/admin/reservas',          label: 'Reservas',        icon: '📋' },
  { path: '/admin/excursiones',       label: 'Excursiones',     icon: '🗺️' },
  { path: '/admin/agenda',            label: 'Agenda',          icon: '📅' },
  { path: '/admin/configuracion',     label: 'Configuración',   icon: '⚙️' },
]

export default function AdminLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

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

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ path, label, icon }) => {
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
