import { Link } from 'react-router-dom'
import { excursiones, leads, clientes, reservas, formatPrecio, estadosLead } from '../../data/mockData.js'

function StatCard({ icon, label, value, sub, to }) {
  const content = (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{icon}</span>
        <span className="text-sm text-gray-500 font-medium">{label}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
  return to ? <Link to={to}>{content}</Link> : content
}

export default function Dashboard() {
  const session = JSON.parse(localStorage.getItem('admin_session') || '{}')
  const leadsNuevos = leads.filter((l) => l.estado === 'nuevo').length
  const reservasPendientes = reservas.filter((r) => r.estado === 'pendiente').length
  const ingresoTotal = reservas.filter((r) => r.estado === 'confirmada').reduce((sum, r) => sum + r.pagado, 0)
  const cuposOcupados = excursiones.reduce((sum, e) => sum + (e.cupos - e.cuposDisponibles), 0)

  const leadsRecientes = [...leads].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Bienvenido, {session.email}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon="🎯" label="Leads nuevos" value={leadsNuevos} sub="Sin contactar" to="/admin/leads" />
        <StatCard icon="📋" label="Reservas pendientes" value={reservasPendientes} sub="Sin confirmar" to="/admin/reservas" />
        <StatCard icon="👥" label="Clientes activos" value={clientes.filter((c) => c.estado !== 'inactivo').length} sub="Registrados" to="/admin/clientes" />
        <StatCard icon="💰" label="Ingresos confirmados" value={formatPrecio(ingresoTotal)} sub="Pagos recibidos" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Leads recientes */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Leads recientes</h2>
            <Link to="/admin/leads" className="text-xs text-brand-600 hover:underline">Ver todos</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {leadsRecientes.map((lead) => {
              const estado = estadosLead[lead.estado]
              return (
                <div key={lead.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{lead.nombre}</p>
                    <p className="text-xs text-gray-400">{lead.excursionInteres}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estado.color}`}>
                      {estado.label}
                    </span>
                    <a
                      href={`https://wa.me/${lead.whatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-500 hover:text-green-600 text-lg"
                      title="WhatsApp"
                    >
                      💬
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Excursiones con pocos cupos */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Cupos disponibles</h2>
            <Link to="/admin/excursiones" className="text-xs text-brand-600 hover:underline">Gestionar</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {excursiones.map((ex) => {
              const pct = Math.round(((ex.cupos - ex.cuposDisponibles) / ex.cupos) * 100)
              return (
                <div key={ex.id} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-800 truncate flex-1 mr-2">{ex.nombre}</p>
                    <p className="text-xs text-gray-400 shrink-0">{ex.cuposDisponibles} libre{ex.cuposDisponibles !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${pct >= 80 ? 'bg-red-400' : pct >= 50 ? 'bg-yellow-400' : 'bg-green-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
