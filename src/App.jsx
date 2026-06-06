import { createBrowserRouter, RouterProvider } from 'react-router-dom'

// Layouts
import PublicLayout from './components/layout/PublicLayout.jsx'
import AdminLayout from './components/layout/AdminLayout.jsx'
import ProtectedRoute from './components/layout/ProtectedRoute.jsx'

// Páginas públicas
import Home from './pages/public/Home.jsx'
import Catalogo from './pages/public/Catalogo.jsx'
import ExcursionDetalle from './pages/public/ExcursionDetalle.jsx'
import Reservar from './pages/public/Reservar.jsx'
import MisReservas from './pages/public/MisReservas.jsx'

// Páginas admin
import Login from './pages/admin/Login.jsx'
import Dashboard from './pages/admin/Dashboard.jsx'
import Leads from './pages/admin/Leads.jsx'
import Clientes from './pages/admin/Clientes.jsx'
import Reservas from './pages/admin/Reservas.jsx'
import Excursiones from './pages/admin/Excursiones.jsx'
import Agenda from './pages/admin/Agenda.jsx'

const router = createBrowserRouter([
  // ── Área pública ──────────────────────────────────────────────
  {
    element: <PublicLayout />,
    children: [
      { path: '/',                      element: <Home /> },
      { path: '/excursiones',           element: <Catalogo /> },
      { path: '/excursiones/:id',       element: <ExcursionDetalle /> },
      { path: '/reservar/:id',          element: <Reservar /> },
      { path: '/mis-reservas',          element: <MisReservas /> },
    ],
  },

  // ── Login ──────────────────────────────────────────────────────
  { path: '/login', element: <Login /> },

  // ── Área interna ───────────────────────────────────────────────
  {
    element: <ProtectedRoute><AdminLayout /></ProtectedRoute>,
    children: [
      { path: '/admin',                 element: <Dashboard /> },
      { path: '/admin/leads',           element: <Leads /> },
      { path: '/admin/clientes',        element: <Clientes /> },
      { path: '/admin/reservas',        element: <Reservas /> },
      { path: '/admin/excursiones',     element: <Excursiones /> },
      { path: '/admin/agenda',          element: <Agenda /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
