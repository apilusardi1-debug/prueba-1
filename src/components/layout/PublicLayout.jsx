import { Link, Outlet, useLocation } from 'react-router-dom'

export default function PublicLayout() {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-brand-700">
            🌍 Turismo Patagonia
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link
              to="/excursiones"
              className={`hover:text-brand-600 transition-colors ${pathname.startsWith('/excursiones') ? 'text-brand-600' : 'text-gray-600'}`}
            >
              Excursiones
            </Link>
            <Link
              to="/mis-reservas"
              className={`hover:text-brand-600 transition-colors ${pathname === '/mis-reservas' ? 'text-brand-600' : 'text-gray-600'}`}
            >
              Mis reservas
            </Link>
            <a
              href="https://wa.me/5491100000000"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-full text-sm transition-colors"
            >
              WhatsApp
            </a>
          </nav>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-400 text-sm py-8 mt-16">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between gap-4">
          <div>
            <p className="text-white font-semibold mb-1">Turismo Patagonia</p>
            <p>Las mejores excursiones de Argentina</p>
          </div>
          <div className="flex gap-6">
            <Link to="/excursiones" className="hover:text-white transition-colors">Excursiones</Link>
            <Link to="/mis-reservas" className="hover:text-white transition-colors">Mis reservas</Link>
            <Link to="/login" className="hover:text-white transition-colors">Equipo</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
