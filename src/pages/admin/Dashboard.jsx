import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { excursionesApi, leadsApi, clientesApi, reservasApi, movimientosApi, propuestasApi, normalizarExcursion } from '../../lib/supabase.js'
import { formatPrecio } from '../../data/mockData.js'

const ESTADOS_PROPUESTA = [
  { key: 'enviada',   label: 'Enviadas',   color: '#f59e0b' },
  { key: 'cerrada',   label: 'Cerradas',   color: '#22c55e' },
  { key: 'rechazada', label: 'Rechazadas', color: '#ef4444' },
]

function formatFechaRelativa(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const ahora = new Date()
  if (d.toDateString() === ahora.toDateString()) {
    return `Hoy, ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
  }
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function puntoCirculo(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

function pathDomo(cx, cy, r) {
  const [x0, y0] = puntoCirculo(cx, cy, r, 180)
  const [x1, y1] = puntoCirculo(cx, cy, r, 360)
  return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`
}

function GaugeMedioCirculo({ pct, color, label, sub }) {
  const size = 120, r = 46, cx = 60, cy = 58, grosor = 11
  const longitud = Math.PI * r
  const d = pathDomo(cx, cy, r)
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={72} viewBox={`0 0 ${size} 72`}>
        <path d={d} fill="none" stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" className="text-gray-100 dark:text-zinc-800" />
        <path d={d} fill="none" stroke={color} strokeWidth={grosor} strokeLinecap="round"
          strokeDasharray={longitud} strokeDashoffset={longitud * (1 - pct / 100)} />
        <text x={cx} y={cy - 2} textAnchor="middle" className="fill-gray-900 dark:fill-zinc-100" style={{ fontSize: 18, fontWeight: 700 }}>{Math.round(pct)}%</text>
      </svg>
      <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 -mt-1">{label}</p>
      <p className="text-xs text-gray-400 dark:text-zinc-500">{sub}</p>
    </div>
  )
}

const estadosLead = {
  nuevo:      { label: 'Nuevo',      color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' },
  contactado: { label: 'Contactado', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400' },
  reservado:  { label: 'Reservado',  color: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' },
  perdido:    { label: 'Perdido',    color: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' },
}

const RANKING_EXCURSIONES = [
  { key: 'maragogi',  label: 'Maragogi',     color: '#38bdf8' },
  { key: 'carneiros', label: 'Carneiros',    color: '#a78bfa' },
  { key: 'aleixo',    label: 'Santo Aleixo', color: '#fb923c' },
]

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function serieMensualExcursiones(reservas) {
  const anioActual = new Date().getFullYear()
  return MESES.map((mes, i) => {
    const fila = { mes }
    RANKING_EXCURSIONES.forEach(r => {
      fila[r.key] = reservas.filter(res => {
        if (!res.fecha) return false
        const [y, m] = res.fecha.split('-').map(Number)
        return y === anioActual && m - 1 === i && res.excursiones?.nombre?.toLowerCase().includes(r.key)
      }).length
    })
    return fila
  })
}

function TooltipExcursiones({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg dark:shadow-black/40 px-3 py-2 text-xs min-w-[140px]">
      <p className="font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-gray-500 dark:text-zinc-400">{p.name}</span>
          <span className="ml-auto font-semibold text-gray-800 dark:text-zinc-200">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

function GraficoMensualExcursiones({ datos }) {
  const hayDatos = datos.some(fila => RANKING_EXCURSIONES.some(r => fila[r.key] > 0))

  return (
    <div>
      <div className="text-gray-300 dark:text-zinc-700">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={datos} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {RANKING_EXCURSIONES.map(r => (
                <linearGradient key={r.key} id={`grad-${r.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={r.color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={r.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="currentColor" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="mes" tick={{ fill: 'currentColor', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: 'currentColor', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
            <Tooltip content={<TooltipExcursiones />} />
            {RANKING_EXCURSIONES.map(r => (
              <Area
                key={r.key}
                type="monotone"
                dataKey={r.key}
                name={r.label}
                stroke={r.color}
                strokeWidth={2.5}
                fill={`url(#grad-${r.key})`}
                dot={{ r: 3, strokeWidth: 0, fill: r.color }}
                activeDot={{ r: 5 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {!hayDatos && (
        <p className="text-center text-sm text-gray-400 dark:text-zinc-600 -mt-8">Sin reservas todavía este año para estas excursiones.</p>
      )}
      <div className="flex items-center justify-center gap-6 mt-2">
        {RANKING_EXCURSIONES.map(r => (
          <div key={r.key} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
            <span className="text-xs text-gray-500 dark:text-zinc-400">{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function limitesMesActual() {
  const hoy = new Date()
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0]
  return { desde, hasta }
}

function StatCard({ icon, label, value, sub, to, valueClass, badgeClass }) {
  const content = (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm dark:shadow-black/20 border border-gray-100 dark:border-zinc-800 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500 dark:text-zinc-400 font-medium">{label}</span>
        <span className={`w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 ${badgeClass || 'bg-gray-100 dark:bg-zinc-800'}`}>{icon}</span>
      </div>
      <p className={`text-3xl font-bold ${valueClass || 'text-gray-900 dark:text-zinc-100'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">{sub}</p>}
    </div>
  )
  return to ? <Link to={to}>{content}</Link> : content
}

export default function Dashboard() {
  const session = JSON.parse(localStorage.getItem('admin_session') || '{}')
  const [excursiones, setExcursiones] = useState([])
  const [leads, setLeads] = useState([])
  const [clientes, setClientes] = useState([])
  const [reservas, setReservas] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [propuestas, setPropuestas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      const [{ data: ex }, { data: le }, { data: cl }, { data: re }, { data: mo }, { data: pr }] = await Promise.all([
        excursionesApi.getAll(),
        leadsApi.getAll(),
        clientesApi.getAll(),
        reservasApi.getAll(),
        movimientosApi.getAll(),
        propuestasApi.getAll(),
      ])
      setExcursiones((ex || []).map(normalizarExcursion))
      setLeads(le || [])
      setClientes(cl || [])
      setReservas(re || [])
      setMovimientos(mo || [])
      setPropuestas(pr || [])
      setLoading(false)
    }
    cargar()
  }, [])

  const leadsNuevos = leads.filter(l => l.estado === 'nuevo').length
  const reservasPendientes = reservas.filter(r => r.estado === 'pendiente').length

  const ingresosTotales = movimientos
    .filter(m => m.tipo === 'ingreso' && m.estado === 'confirmado' && m.moneda === 'BRL')
    .reduce((sum, m) => sum + Number(m.monto), 0)
  const salidasTotales = movimientos
    .filter(m => m.tipo === 'egreso' && m.estado === 'confirmado' && m.moneda === 'BRL')
    .reduce((sum, m) => sum + Number(m.monto), 0)

  const { desde: desdeMes, hasta: hastaMes } = limitesMesActual()
  const costosOperativosMes = reservas
    .filter(r => r.fecha >= desdeMes && r.fecha <= hastaMes)
    .reduce((sum, r) => sum + Number(r.costo_operativo || 0), 0)

  const serieMensual = serieMensualExcursiones(reservas)

  const leadsRecientes = [...leads].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 5)

  const movimientosRecientes = [...movimientos]
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, 5)

  const totalPropuestas = propuestas.length
  const estadosPropuesta = ESTADOS_PROPUESTA.map(e => {
    const cantidad = propuestas.filter(p => p.estado === e.key).length
    return { ...e, cantidad, pct: totalPropuestas > 0 ? (cantidad / totalPropuestas) * 100 : 0 }
  })

  if (loading) return <div className="p-8 text-gray-400 dark:text-zinc-500">Cargando...</div>

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Dashboard</h1>
        <p className="text-gray-400 dark:text-zinc-500 text-sm mt-1">Bienvenido, {session.email}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard icon="🎯" label="Leads nuevos" value={leadsNuevos} sub="Sin contactar" to="/admin/leads" badgeClass="bg-blue-50 dark:bg-blue-950/40" />
        <StatCard icon="📋" label="Reservas pendientes" value={reservasPendientes} sub="Sin confirmar" to="/admin/reservas" badgeClass="bg-purple-50 dark:bg-purple-950/40" />
        <StatCard icon="👥" label="Clientes" value={clientes.length} sub="Registrados" to="/admin/clientes" badgeClass="bg-gray-100 dark:bg-zinc-800" />
        <StatCard icon="💰" label="Ingresos totales" value={formatPrecio(ingresosTotales)} sub="Movimientos confirmados" valueClass="text-green-600 dark:text-green-400" badgeClass="bg-green-50 dark:bg-green-950/40" to="/admin/finanzas" />
        <StatCard icon="📤" label="Salidas totales" value={formatPrecio(salidasTotales)} sub="Movimientos confirmados" valueClass="text-red-500 dark:text-red-400" badgeClass="bg-red-50 dark:bg-red-950/40" to="/admin/finanzas" />
        <StatCard icon="⚙️" label="Costos operativos del mes" value={formatPrecio(costosOperativosMes)} sub="Según chofer asignado por reserva" valueClass="text-orange-500 dark:text-orange-400" badgeClass="bg-orange-50 dark:bg-orange-950/40" to="/admin/reservas" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Reservas por mes y excursión */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm dark:shadow-black/20">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
            <h2 className="font-semibold text-gray-800 dark:text-zinc-200">Reservas por mes y excursión</h2>
          </div>
          <div className="p-5">
            <GraficoMensualExcursiones datos={serieMensual} />
          </div>
        </div>

        {/* Movimientos recientes */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm dark:shadow-black/20">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
            <h2 className="font-semibold text-gray-800 dark:text-zinc-200">Movimientos recientes</h2>
            <Link to="/admin/finanzas" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">Ver todos</Link>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-zinc-800">
            {movimientosRecientes.length === 0 && (
              <p className="px-5 py-6 text-sm text-gray-400 dark:text-zinc-600">Sin movimientos todavía.</p>
            )}
            {movimientosRecientes.map(m => (
              <div key={m.id} className="px-5 py-3 flex items-center gap-3">
                <span className={`w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 ${
                  m.tipo === 'ingreso' ? 'bg-green-50 dark:bg-green-950/40' : 'bg-red-50 dark:bg-red-950/40'
                }`}>
                  {m.tipo === 'ingreso' ? '💰' : '📤'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">{m.concepto}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500">{formatFechaRelativa(m.created_at)}</p>
                </div>
                <p className={`text-sm font-semibold shrink-0 ${m.tipo === 'ingreso' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                  {m.tipo === 'ingreso' ? '+' : '-'} {formatPrecio(m.monto, m.moneda)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Leads recientes */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm dark:shadow-black/20">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
            <h2 className="font-semibold text-gray-800 dark:text-zinc-200">Leads recientes</h2>
            <Link to="/admin/leads" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">Ver todos</Link>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-zinc-800">
            {leadsRecientes.length === 0 && (
              <p className="px-5 py-6 text-sm text-gray-400 dark:text-zinc-600">Sin leads todavía.</p>
            )}
            {leadsRecientes.map((lead) => {
              const estado = estadosLead[lead.estado] || estadosLead.nuevo
              return (
                <div key={lead.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">{lead.nombre}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">{lead.excursion_interes}</p>
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
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm dark:shadow-black/20">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
            <h2 className="font-semibold text-gray-800 dark:text-zinc-200">Cupos disponibles</h2>
            <Link to="/admin/excursiones" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">Gestionar</Link>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-zinc-800">
            {excursiones.length === 0 && (
              <p className="px-5 py-6 text-sm text-gray-400 dark:text-zinc-600">Sin excursiones todavía.</p>
            )}
            {excursiones.map((ex) => {
              const pct = ex.cupos > 0 ? Math.round(((ex.cupos - ex.cuposDisponibles) / ex.cupos) * 100) : 0
              return (
                <div key={ex.id} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 truncate flex-1 mr-2">{ex.nombre}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500 shrink-0">{ex.cuposDisponibles} libre{ex.cuposDisponibles !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-zinc-800 rounded-full h-1.5">
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

        {/* Propuestas: enviadas / cerradas / rechazadas */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm dark:shadow-black/20">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
            <h2 className="font-semibold text-gray-800 dark:text-zinc-200">Propuestas</h2>
            <Link to="/admin/paquetes/clientes" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">Ver todas</Link>
          </div>
          <div className="p-5">
            {totalPropuestas === 0 ? (
              <p className="text-center text-sm text-gray-400 dark:text-zinc-600 py-6">Sin propuestas todavía.</p>
            ) : (
              <div className="flex items-start justify-around">
                {estadosPropuesta.map(e => (
                  <GaugeMedioCirculo key={e.key} pct={e.pct} color={e.color} label={e.label} sub={`${e.cantidad} propuesta${e.cantidad !== 1 ? 's' : ''}`} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
