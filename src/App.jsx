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
import Destinos from './pages/public/Destinos.jsx'
import DestinoDetalle from './pages/public/DestinoDetalle.jsx'
import Hoteles from './pages/public/Hoteles.jsx'
import Marea from './pages/public/Marea.jsx'
import Nosotros from './pages/public/Nosotros.jsx'

// Páginas admin
import Login from './pages/admin/Login.jsx'
import Dashboard from './pages/admin/Dashboard.jsx'
import Leads from './pages/admin/Leads.jsx'
import Clientes from './pages/admin/Clientes.jsx'
import Reservas from './pages/admin/Reservas.jsx'
import Excursiones from './pages/admin/Excursiones.jsx'
import Agenda from './pages/admin/Agenda.jsx'
import SiteConfig from './pages/admin/SiteConfig.jsx'
import Equipo from './pages/admin/Equipo.jsx'
import Hospedajes from './pages/admin/Hospedajes.jsx'
import WhatsAppCRM from './pages/admin/crm/WhatsApp.jsx'
import Finanzas from './pages/admin/Finanzas.jsx'
import ClientesPaquetes from './pages/admin/paquetes/ClientesPaquetes.jsx'
import GeneradorPropuesta from './pages/admin/paquetes/GeneradorPropuesta.jsx'
import PropuestasLista from './pages/admin/paquetes/PropuestasLista.jsx'

const router = createBrowserRouter([
  // ── Área pública ──────────────────────────────────────────────
  {
    element: <PublicLayout />,
    children: [
      { path: '/',                      element: <Home /> },
      { path: '/paquetes',              element: <Catalogo categoria="paquetes" /> },
      { path: '/excursiones',           element: <Catalogo categoria="excursiones" /> },
      { path: '/excursiones/:id',       element: <ExcursionDetalle /> },
      { path: '/reservar/:id',          element: <Reservar /> },
      { path: '/mis-reservas',          element: <MisReservas /> },
      { path: '/destinos',              element: <Destinos /> },
      { path: '/destinos/:id',          element: <DestinoDetalle /> },
      { path: '/hoteles',               element: <Hoteles /> },
      { path: '/traslados',             element: <Catalogo categoria="traslados" /> },
      { path: '/marea',                 element: <Marea /> },
      { path: '/nosotros',              element: <Nosotros /> },
    ],
  },

  // ── Login ──────────────────────────────────────────────────────
  { path: '/login', element: <Login /> },

  // ── Área interna ───────────────────────────────────────────────
  {
    element: <ProtectedRoute><AdminLayout /></ProtectedRoute>,
    children: [
      { path: '/admin',               element: <Dashboard /> },
      { path: '/admin/leads',         element: <Leads /> },
      { path: '/admin/clientes',      element: <Clientes /> },
      { path: '/admin/reservas',      element: <Reservas /> },
      { path: '/admin/excursiones',   element: <Excursiones /> },
      { path: '/admin/agenda',            element: <Agenda /> },
      { path: '/admin/hospedajes',         element: <Hospedajes /> },
      { path: '/admin/paquetes/clientes',  element: <ClientesPaquetes /> },
      { path: '/admin/paquetes/generador', element: <GeneradorPropuesta /> },
      { path: '/admin/paquetes/enviadas',  element: <PropuestasLista estado="enviada" /> },
      { path: '/admin/paquetes/cerradas',  element: <PropuestasLista estado="cerrada" /> },
      { path: '/admin/equipo',           element: <Equipo /> },
      { path: '/admin/configuracion',    element: <SiteConfig /> },
      { path: '/admin/crm/whatsapp',    element: <WhatsAppCRM /> },
      { path: '/admin/finanzas',        element: <Finanzas /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
