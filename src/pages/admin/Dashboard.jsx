import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { excursionesApi, leadsApi, clientesApi, reservasApi, movimientosApi, propuestasApi, normalizarExcursion } from '../../lib/supabase.js'
import { formatPrecio } from '../../data/mockData.js'
import { etiquetaInteres } from '../../../supabase/functions/_shared/interes.ts'
import Ic from '../../components/admin/dashboard/Ic.jsx'
import { useEtapas, etapaDe, claveVisible, estiloFondoEtapa, clavesDeEntrada } from '../../lib/embudo.js'
import {
  useMetricasCRM, Encabezado,
  TarjetaSinResponder, TarjetaTiempoRespuesta, TarjetaActividad, TarjetaGasto,
} from '../../components/admin/dashboard/CRMCards.jsx'

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
    <div className="min-w-[140px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/15 dark:bg-zinc-900 dark:shadow-black/40">
      <p className="mb-1.5 font-semibold text-gray-700 dark:text-zinc-200">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-500 dark:text-zinc-400">{p.name}</span>
          <span className="ml-auto font-semibold text-gray-800 dark:text-white">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

function GraficoMensualExcursiones({ datos }) {
  const hayDatos = datos.some(fila => RANKING_EXCURSIONES.some(r => fila[r.key] > 0))

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-[260px] flex-1 text-gray-300 dark:text-zinc-700">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={datos} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <defs>
              {RANKING_EXCURSIONES.map(r => (
                <linearGradient key={r.key} id={`grad-${r.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={r.color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={r.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="currentColor" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="mes" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
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
        <p className="-mt-8 text-center text-sm text-gray-400 dark:text-zinc-600">Sin reservas todavía este año para estas excursiones.</p>
      )}
      <div className="mt-2 flex items-center justify-center gap-6">
        {RANKING_EXCURSIONES.map(r => (
          <div key={r.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
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

/* ─── Piezas de la pantalla ─────────────────────────────────────── */
function StatCard({ icon, label, value, hint, to }) {
  return (
    <Link to={to} className="dash-card relative block px-[18px] py-4 transition-all hover:shadow-md dark:hover:border-white/20">
      <p className="pr-11 text-[11.5px] font-semibold text-gray-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 whitespace-nowrap text-[22px] font-extrabold tracking-tight text-gray-900 dark:text-white">{value}</p>
      <p className="mt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">{hint}</p>
      <span className="absolute right-3.5 top-3.5 grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 dark:border dark:border-white/10 dark:from-zinc-700 dark:to-zinc-800 dark:text-zinc-100">
        <Ic n={icon} />
      </span>
    </Link>
  )
}

function GaugePropuestas({ estados, total }) {
  const cerradas = estados.find(e => e.key === 'cerrada')
  const arco = 'M20 100 A80 80 0 0 1 180 100'
  let acumulado = 0
  return (
    <div className="relative mx-auto my-auto w-full max-w-[250px]">
      <svg viewBox="0 0 200 112" role="img" aria-label={`Propuestas: ${estados.map(e => `${e.cantidad} ${e.label.toLowerCase()}`).join(', ')}`} className="block w-full">
        <path d={arco} pathLength="100" fill="none" strokeWidth="15" className="stroke-gray-100 dark:stroke-white/10" />
        {estados.map(e => {
          const largo = (e.cantidad / total) * 100
          const inicio = acumulado
          acumulado += largo
          if (largo <= 0) return null
          return (
            <path key={e.key} d={arco} pathLength="100" fill="none" stroke={e.color} strokeWidth="15"
              strokeDasharray={`${Math.max(largo - 1.6, 0.1)} 200`} strokeDashoffset={-inicio} />
          )
        })}
      </svg>
      <div className="absolute inset-x-0 bottom-[8%] text-center">
        <b className="block text-[34px] font-extrabold leading-none tracking-tight text-gray-900 dark:text-white">{Math.round(cerradas.pct)}%</b>
        <span className="text-[11px] text-gray-500 dark:text-zinc-400">de las propuestas se cerraron</span>
      </div>
    </div>
  )
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
  const [periodo, setPeriodo] = useState('semana')
  const metricas = useMetricasCRM(periodo)
  const { etapas } = useEtapas()

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

  const entradas = clavesDeEntrada(etapas)
  const leadsNuevos = leads.filter(l => entradas.includes(l.estado)).length
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

  const nombre = String(session.nombre || session.email || '').split(' ')[0]
  const pendientesCRM = metricas.datos?.respuesta?.pendientes?.cantidad
  const pl = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

  return (
    <div className="space-y-4 md:space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-1.5 max-w-3xl text-sm text-gray-500 dark:text-zinc-400">
          Bienvenido de nuevo, <b className="text-gray-800 dark:text-white">{nombre}</b>.{' '}
          Hoy hay{' '}
          {pendientesCRM != null && (<><b className="text-gray-800 dark:text-white">{pl(pendientesCRM, 'consulta esperando', 'consultas esperando')}</b> respuesta y </>)}
          <b className="text-gray-800 dark:text-white">{pl(reservasPendientes, 'reserva', 'reservas')}</b> por confirmar.{' '}
          <Link to="/admin/crm/whatsapp" className="font-semibold text-brand-600 hover:underline dark:text-zinc-100">Abrir el CRM</Link>
        </p>
      </div>

      {metricas.error && !metricas.cargando && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">No se pudieron cargar las métricas del CRM</p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Falta correr la migración de métricas en Supabase, o hay un problema de conexión.</p>
        </div>
      )}

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard icon="wallet" label="Ingresos totales" value={formatPrecio(ingresosTotales)} hint="Movimientos confirmados" to="/admin/finanzas" />
        <StatCard icon="cash" label="Salidas totales" value={formatPrecio(salidasTotales)} hint="Movimientos confirmados" to="/admin/finanzas" />
        <StatCard icon="target" label="Leads nuevos" value={leadsNuevos} hint="Sin contactar" to="/admin/leads" />
        <StatCard icon="cal" label="Reservas pendientes" value={reservasPendientes} hint="Sin confirmar" to="/admin/reservas" />
        <StatCard icon="users" label="Clientes" value={clientes.length} hint="Registrados" to="/admin/clientes" />
        <StatCard icon="gear" label="Costos operativos" value={formatPrecio(costosOperativosMes)} hint="Del mes, según chofer por reserva" to="/admin/reservas" />
      </div>

      {/* Atención al cliente: espera, tiempo de respuesta, propuestas */}
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-[1.25fr_1fr_1fr] md:gap-5">
        <div className="lg:col-span-2 2xl:col-span-1"><TarjetaSinResponder datos={metricas.datos} cargando={metricas.cargando} /></div>
        <TarjetaTiempoRespuesta datos={metricas.datos} cargando={metricas.cargando} periodo={periodo} />

        <div className="dash-card flex flex-col">
          <Encabezado titulo="Propuestas" sub="Enviadas, cerradas y rechazadas" />
          {totalPropuestas === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400 dark:text-zinc-600">Sin propuestas todavía.</p>
          ) : (
            <>
              <div className="flex flex-1 items-center py-3"><GaugePropuestas estados={estadosPropuesta} total={totalPropuestas} /></div>
              <div className="grid grid-cols-3 gap-2">
                {estadosPropuesta.map(e => (
                  <div key={e.key} className="rounded-xl bg-gray-50 px-2 py-2 text-center dark:bg-white/[0.04]">
                    <b className="block text-[17px] font-extrabold text-gray-900 dark:text-white">{e.cantidad}</b>
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-zinc-400">
                      <i className="h-[7px] w-[7px] rounded-full" style={{ background: e.color }} />{e.label}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Reservas por mes + actividad del CRM */}
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr] 2xl:grid-cols-[1.9fr_1fr] md:gap-5">
        <div className="dash-card flex flex-col">
          <Encabezado titulo="Reservas por mes y excursión" sub="Del año en curso" />
          <div className="mt-3 flex-1"><GraficoMensualExcursiones datos={serieMensual} /></div>
        </div>
        <TarjetaActividad metricas={metricas} periodo={periodo} setPeriodo={setPeriodo} />
      </div>

      {/* Leads y movimientos */}
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr] 2xl:grid-cols-[1.9fr_1fr] md:gap-5">
        <div className="dash-card">
          <Encabezado
            titulo="Leads recientes"
            sub={`${leadsNuevos} ${leadsNuevos === 1 ? 'lead nuevo' : 'leads nuevos'} sin contactar`}
            derecha={<Link to="/admin/leads" className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/[0.08]">Ver todos</Link>}
          />
          {leadsRecientes.length === 0 ? (
            <p className="py-6 text-sm text-gray-400 dark:text-zinc-600">Sin leads todavía.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-[10.5px] font-bold uppercase tracking-wider text-gray-400 dark:border-white/[0.07] dark:text-zinc-500">
                    <th className="px-2.5 py-2">Lead</th>
                    <th className="px-2.5 py-2">Interés</th>
                    <th className="px-2.5 py-2">Estado</th>
                    <th className="px-2.5 py-2">Ingreso</th>
                    <th className="px-2.5 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {leadsRecientes.map(lead => {
                    const etapa = etapaDe(etapas, claveVisible(etapas, lead.estado))
                    return (
                      <tr key={lead.id} className="border-b border-gray-50 last:border-0 dark:border-white/[0.04]">
                        <td className="px-2.5 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-gray-200 to-gray-300 text-xs font-extrabold text-gray-700 dark:from-zinc-600 dark:to-zinc-800 dark:text-white">
                              {(lead.nombre || '?')[0].toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[12.5px] font-bold text-gray-900 dark:text-white">{lead.nombre}</p>
                              <p className="text-[11px] text-gray-400 dark:text-zinc-500">{lead.whatsapp}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5 text-[12.5px] text-gray-700 dark:text-zinc-200">{etiquetaInteres(lead) || '—'}</td>
                        <td className="px-2.5 py-2.5">
                          {etapa && (
                            <span className="inline-flex max-w-[190px] items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-gray-800 dark:text-zinc-100" style={estiloFondoEtapa(etapa.color)}>
                              <i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: etapa.color }} />
                              <span className="truncate">{etapa.nombre}</span>
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-2.5 text-[12.5px] text-gray-500 dark:text-zinc-400">{formatFechaRelativa(lead.created_at)}</td>
                        <td className="px-2.5 py-2.5 text-right">
                          <a
                            href={`https://wa.me/${lead.whatsapp}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Abrir WhatsApp de ${lead.nombre}`}
                            className="inline-grid h-[30px] w-[30px] place-items-center rounded-[10px] bg-green-50 text-green-600 transition-colors hover:bg-green-100 dark:bg-green-500/15 dark:text-green-400 dark:hover:bg-green-500/25"
                          >
                            <Ic n="chat" className="h-4 w-4" />
                          </a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="dash-card">
          <Encabezado
            titulo="Movimientos recientes"
            sub="Últimos ingresos y egresos"
            derecha={<Link to="/admin/finanzas" className="text-xs font-semibold text-brand-600 hover:underline dark:text-zinc-200">Ver todos</Link>}
          />
          {movimientosRecientes.length === 0 ? (
            <p className="py-6 text-sm text-gray-400 dark:text-zinc-600">Sin movimientos todavía.</p>
          ) : (
            <div className="mt-3">
              {movimientosRecientes.map((m, i) => (
                <div key={m.id} className="relative flex items-center gap-3 py-2.5">
                  {i < movimientosRecientes.length - 1 && <span className="absolute left-[15px] top-10 -bottom-2 w-px bg-gray-200 dark:bg-white/10" />}
                  <span className={`relative z-10 grid h-[31px] w-[31px] shrink-0 place-items-center rounded-full ${
                    m.tipo === 'ingreso' ? 'bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-400' : 'bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-400'
                  }`}>
                    <Ic n={m.tipo === 'ingreso' ? 'up' : 'down'} className="h-[15px] w-[15px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-bold text-gray-900 dark:text-white">{m.concepto}</p>
                    <p className="text-[11px] text-gray-400 dark:text-zinc-500">{formatFechaRelativa(m.created_at)}</p>
                  </div>
                  <p className={`whitespace-nowrap text-[12.5px] font-extrabold ${m.tipo === 'ingreso' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                    {m.tipo === 'ingreso' ? '+' : '-'} {formatPrecio(m.monto, m.moneda)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cupos y gasto */}
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr] md:gap-5">
        <div className="dash-card">
          <Encabezado
            titulo="Cupos disponibles"
            sub="Ocupación de cada excursión"
            derecha={<Link to="/admin/excursiones" className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/[0.08]">Gestionar</Link>}
          />
          {excursiones.length === 0 && <p className="py-6 text-sm text-gray-400 dark:text-zinc-600">Sin excursiones todavía.</p>}
          <div className="mt-2">
            {excursiones.map(ex => {
              const pct = ex.cupos > 0 ? Math.round(((ex.cupos - ex.cuposDisponibles) / ex.cupos) * 100) : 0
              return (
                <div key={ex.id} className="py-2.5">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <p className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-gray-800 dark:text-white">{ex.nombre}</p>
                    <p className="shrink-0 text-[11.5px] text-gray-500 dark:text-zinc-400">{ex.cuposDisponibles} libre{ex.cuposDisponibles !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                    <div
                      className={`h-1.5 rounded-full ${pct >= 80 ? 'bg-gradient-to-r from-red-400 to-red-500' : pct >= 50 ? 'bg-gradient-to-r from-amber-300 to-amber-400' : 'bg-gradient-to-r from-emerald-400 to-emerald-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <TarjetaGasto
          datos={metricas.datos}
          cargando={metricas.cargando}
          periodo={periodo}
          esAdmin={session.role === 'admin'}
          alCambiarTarifa={metricas.recargar}
        />
      </div>
    </div>
  )
}
