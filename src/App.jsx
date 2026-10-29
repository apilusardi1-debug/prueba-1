import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AvisosPagina } from './components/ui/Avisos.jsx'

// Layouts
import PublicLayout from './components/layout/PublicLayout.jsx'
const AdminLayout = lazy(() => import('./components/layout/AdminLayout.jsx'))
import ProtectedRoute from './components/layout/ProtectedRoute.jsx'

// Páginas públicas
import Home from './pages/public/Home.jsx'
import Catalogo from './pages/public/Catalogo.jsx'
import ExcursionDetalle from './pages/public/ExcursionDetalle.jsx'
const Reservar = lazy(() => import('./pages/public/Reservar.jsx'))
import Destinos from './pages/public/Destinos.jsx'
import DestinoDetalle from './pages/public/DestinoDetalle.jsx'
import Hoteles from './pages/public/Hoteles.jsx'
import HotelDetalle from './pages/public/HotelDetalle.jsx'
import Marea from './pages/public/Marea.jsx'
import Nosotros from './pages/public/Nosotros.jsx'
import Privacidad from './pages/public/Privacidad.jsx'

// Link personal de guía/chofer (chat interno de operaciones): pública, sin sesión de admin
const PanelOperativo = lazy(() => import('./pages/public/PanelOperativo.jsx'))

// Páginas admin: se descargan recién cuando alguien entra al panel (lazy), así el visitante
// del sitio no baja el código del admin (PDF, gráficos, CRM). Ídem el link de guía/chofer.
const Login = lazy(() => import('./pages/admin/Login.jsx'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard.jsx'))
const Leads = lazy(() => import('./pages/admin/Leads.jsx'))
const Clientes = lazy(() => import('./pages/admin/Clientes.jsx'))
const Reservas = lazy(() => import('./pages/admin/Reservas.jsx'))
const Excursiones = lazy(() => import('./pages/admin/Excursiones.jsx'))
const Agenda = lazy(() => import('./pages/admin/Agenda.jsx'))
const ChatInterno = lazy(() => import('./pages/admin/ChatInterno.jsx'))
const SiteConfig = lazy(() => import('./pages/admin/SiteConfig.jsx'))
const AsistenteEntrenamiento = lazy(() => import('./pages/admin/AsistenteEntrenamiento.jsx'))
const Equipo = lazy(() => import('./pages/admin/Equipo.jsx'))
const Hospedajes = lazy(() => import('./pages/admin/Hospedajes.jsx'))
const Videos = lazy(() => import('./pages/admin/Videos.jsx'))
const NuevoHospedaje = lazy(() => import('./pages/admin/hospedajes/NuevoHospedaje.jsx'))
const EditarHospedaje = lazy(() => import('./pages/admin/hospedajes/EditarHospedaje.jsx'))
const WhatsAppCRM = lazy(() => import('./pages/admin/crm/WhatsApp.jsx'))
const Finanzas = lazy(() => import('./pages/admin/Finanzas.jsx'))
const ClientesPaquetes = lazy(() => import('./pages/admin/paquetes/ClientesPaquetes.jsx'))
const PlanillaViajes = lazy(() => import('./pages/admin/paquetes/PlanillaViajes.jsx'))
const GeneradorPropuesta = lazy(() => import('./pages/admin/paquetes/GeneradorPropuesta.jsx'))
const PropuestasLista = lazy(() => import('./pages/admin/paquetes/PropuestasLista.jsx'))
const Traslados = lazy(() => import('./pages/admin/Traslados.jsx'))
import TrasladosInfo from './pages/public/TrasladosInfo.jsx'
import PaquetesInfo from './pages/public/PaquetesInfo.jsx'
const Superadmin = lazy(() => import('./pages/admin/Superadmin.jsx'))
const OperacionesEnCurso = lazy(() => import('./pages/admin/OperacionesEnCurso.jsx'))
const Mensajes = lazy(() => import('./pages/admin/Mensajes.jsx'))
const ConfigAlertas = lazy(() => import('./pages/admin/ConfigAlertas.jsx'))

const router = createBrowserRouter([
  // ── Área pública ──────────────────────────────────────────────
  {
    element: <PublicLayout />,
    children: [
      { path: '/',                      element: <Home /> },
      { path: '/paquetes',              element: <PaquetesInfo /> },
      { path: '/excursiones',           element: <Catalogo categoria="excursiones" /> },
      { path: '/excursiones/:id',       element: <ExcursionDetalle /> },
      { path: '/reservar/:id',          element: <Reservar /> },
      // La consulta de reservas no existe más (los paseos se reservan por WhatsApp): links viejos van a Paseos
      { path: '/mis-reservas',          element: <Navigate to="/excursiones" replace /> },
      { path: '/destinos',              element: <Destinos /> },
      { path: '/destinos/:id',          element: <DestinoDetalle /> },
      { path: '/hoteles',               element: <Hoteles /> },
      { path: '/hoteles/:id',           element: <HotelDetalle /> },
      { path: '/traslados',             element: <TrasladosInfo /> },
      { path: '/marea',                 element: <Marea /> },
      { path: '/nosotros',              element: <Nosotros /> },
      { path: '/privacidad',            element: <Privacidad /> },
    ],
  },

  // ── Login ──────────────────────────────────────────────────────
  { path: '/login', element: <Login /> },

  // ── Chat interno (link personal de guía/chofer, sin sesión de admin) ────────
  { path: '/guia/:token',   element: <PanelOperativo tipo="guia" /> },
  { path: '/chofer/:token', element: <PanelOperativo tipo="chofer" /> },

  // ── Área interna ───────────────────────────────────────────────
  {
    element: <ProtectedRoute><AdminLayout /></ProtectedRoute>,
    children: [
      { path: '/admin',               element: <Dashboard /> },
      { path: '/admin/leads',         element: <Leads key="paquetes" embudo="paquetes" /> },
      { path: '/admin/leads/paseos',  element: <Leads key="paseos" embudo="paseos" /> },
      { path: '/admin/leads/anfitriona', element: <Leads key="anfitriona" embudo="anfitriona" /> },
      { path: '/admin/clientes',      element: <Clientes /> },
      { path: '/admin/reservas',      element: <Reservas /> },
      { path: '/admin/traslados',     element: <Traslados /> },
      { path: '/admin/excursiones',   element: <Excursiones /> },
      { path: '/admin/agenda',            element: <Agenda /> },
      { path: '/admin/operaciones/chat',  element: <ChatInterno /> },
      { path: '/admin/hospedajes',         element: <Hospedajes /> },
      { path: '/admin/hospedajes/nuevo',   element: <NuevoHospedaje /> },
      { path: '/admin/hospedajes/:id/editar', element: <EditarHospedaje /> },
      { path: '/admin/videos',            element: <Videos /> },
      { path: '/admin/paquetes/clientes',  element: <ClientesPaquetes /> },
      { path: '/admin/paquetes/planilla',  element: <PlanillaViajes /> },
      { path: '/admin/paquetes/generador', element: <GeneradorPropuesta /> },
      { path: '/admin/paquetes/enviadas',  element: <PropuestasLista estado="enviada" /> },
      { path: '/admin/paquetes/cerradas',  element: <PropuestasLista estado="cerrada" /> },
      { path: '/admin/equipo',           element: <Equipo /> },
      { path: '/admin/configuracion',    element: <SiteConfig /> },
      { path: '/admin/entrenar-asistente', element: <AsistenteEntrenamiento /> },
      { path: '/admin/alertas', element: <ConfigAlertas /> },
      { path: '/admin/superadmin', element: <Superadmin /> },
      { path: '/admin/operaciones/en-curso', element: <OperacionesEnCurso /> },
      { path: '/admin/mensajes', element: <Mensajes /> },
      { path: '/admin/crm/whatsapp',    element: <WhatsAppCRM /> },
      { path: '/admin/finanzas',        element: <Finanzas /> },
    ],
  },
])

export default function App() {
  return (
    <>
      <Suspense fallback={<div className="min-h-screen" />}>
        <RouterProvider router={router} />
      </Suspense>
      <AvisosPagina />
    </>
  )
}
