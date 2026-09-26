import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { crmMetricasApi, tarifasPaisApi, configCostosApi } from '../../../lib/supabase.js'
import { nivelEspera, HORAS_ALERTA_ROJA } from '../../../lib/alertasEspera.js'
import { useSincronizado } from '../../../lib/useSincronizado.js'
import Ic from './Ic.jsx'
import { useTemaOscuro } from './useTemaOscuro.js'

export const PERIODOS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
]
const CONTEXTO = {
  hoy: 'Semana en curso, con hoy destacado',
  semana: 'Semana en curso, de lunes a hoy',
  mes: 'Mes en curso, día por día',
}

// Los límites se calculan en la hora local del navegador: "hoy" empieza a la
// medianoche de quien mira el panel, no a la de UTC. La semana va de lunes a hoy.
export function rangoPeriodo(periodo) {
  const ahora = new Date()
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1)
  let desde = hoy
  if (periodo === 'semana') desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7))
  if (periodo === 'mes') desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  return { desde, hasta: manana }
}

function partesDuracion(seg) {
  if (seg == null) return null
  const s = Math.round(Number(seg))
  if (s < 60) return [[s, 's']]
  const min = Math.round(s / 60)
  if (min < 60) return [[min, 'min']]
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h < 24) return m ? [[h, 'h'], [m, 'min']] : [[h, 'h']]
  const d = Math.floor(h / 24)
  const hh = h % 24
  return hh ? [[d, 'd'], [hh, 'h']] : [[d, 'd']]
}

export function formatoDuracion(seg) {
  const partes = partesDuracion(seg)
  return partes ? partes.map(([v, u], i) => (i && u === 'min' ? String(v).padStart(2, '0') : v) + ' ' + u).join(' ') : '—'
}

function horasCortas(seg) {
  if (seg == null) return '—'
  return seg < 3600 ? `${Math.max(1, Math.round(seg / 60))} min` : `${Math.floor(seg / 3600)} h`
}

// pt-BR y no es-AR: con es-AR el navegador escribe "BRL 0,34" en vez de "R$ 0,34"
export function formatoReales(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const fmt = n => Number(n || 0).toLocaleString('es-AR')
const formatoFecha = d => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })

function formatoCuando(iso) {
  const d = new Date(iso)
  const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString() ? `hoy ${hora}` : `${formatoFecha(d)} ${hora}`
}

/* ─── Datos ─────────────────────────────────────────────────────── */
export function useMetricasCRM(periodo) {
  const [estado, setEstado] = useState({ datos: null, semana: null, error: false, cargando: true })
  const pedidoActual = useRef(0)

  const cargar = useCallback(async () => {
    const pedido = ++pedidoActual.current
    setEstado(e => ({ ...e, cargando: true }))
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bahia'
    const pedir = p => {
      const { desde, hasta } = rangoPeriodo(p)
      return crmMetricasApi.get(desde.toISOString(), hasta.toISOString(), tz)
    }
    // En "Hoy" un solo día no da para un gráfico: se pide también la semana como contexto
    const [principal, semana] = await Promise.all([pedir(periodo), periodo === 'hoy' ? pedir('semana') : null])
    if (pedido !== pedidoActual.current) return
    const fallo = !!principal?.error || !principal?.data
    setEstado({ datos: fallo ? null : principal.data, semana: semana?.data || null, error: fallo, cargando: false })
  }, [periodo])

  useEffect(() => { cargar() }, [cargar])
  // Un mensaje o una conversación nueva cambian estos números (tiempo de respuesta, sin
  // responder ahora...): se mantiene al día solo, sin esperar a que alguien recargue la página.
  useSincronizado(cargar, ['conversaciones', 'mensajes'])
  return { ...estado, recargar: cargar, rango: rangoPeriodo(periodo) }
}

/* ─── Piezas comunes ────────────────────────────────────────────── */
export function Encabezado({ titulo, sub, derecha }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-bold tracking-tight text-gray-900 dark:text-white">{titulo}</h2>
        {sub && <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{sub}</p>}
      </div>
      {derecha}
    </div>
  )
}

function Dato({ etiqueta, valor, clase = '' }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-500 dark:bg-white/[0.04] dark:text-zinc-400">
      <span>{etiqueta}</span>
      <b className={`whitespace-nowrap text-[13px] ${clase || 'text-gray-900 dark:text-white'}`}>{valor}</b>
    </div>
  )
}

function EtiquetaPeriodo({ periodo }) {
  return (
    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10.5px] font-bold text-gray-600 dark:bg-white/10 dark:text-zinc-300">
      {PERIODOS.find(p => p.id === periodo).label}
    </span>
  )
}

function Duracion({ seg }) {
  const partes = partesDuracion(seg)
  if (!partes) return <span>—</span>
  return (
    <>
      {partes.map(([v, u], i) => (
        <span key={u}>
          {i > 0 && ' '}
          {i > 0 && u === 'min' ? String(v).padStart(2, '0') : v}
          <small className="ml-1 mr-0.5 text-base font-bold tracking-normal text-gray-500 dark:text-zinc-400">{u}</small>
        </span>
      ))}
    </>
  )
}

/* ─── Sin responder ahora ───────────────────────────────────────── */
export function TarjetaSinResponder({ datos, cargando }) {
  const p = datos?.respuesta?.pendientes
  const maxHoras = p?.max_seg != null ? p.max_seg / 3600 : 0
  const nivel = nivelEspera(maxHoras)
  const color = nivel === 'roja' ? '#ff4d5e' : nivel === 'amarilla' ? '#ffb020' : p?.cantidad > 0 ? '#a1a1aa' : '#01b574'
  const r = 50
  const circ = 2 * Math.PI * r
  const avance = p?.cantidad > 0 ? Math.min(1, maxHoras / HORAS_ALERTA_ROJA) : 1

  return (
    <div className={`dash-card transition-opacity ${cargando ? 'opacity-60' : ''}`}>
      <Encabezado titulo="Sin responder ahora" sub="Desde que escribió el cliente hasta este momento" />
      <div className="mt-3 flex items-center gap-4">
        <div className="relative h-[122px] w-[122px] shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full">
            <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-gray-100 dark:stroke-white/10" />
            <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${circ * avance} ${circ}`} transform="rotate(-90 60 60)" />
          </svg>
          <div className="absolute inset-0 grid place-content-center text-center">
            <b className="text-2xl font-extrabold leading-none text-gray-900 dark:text-white">{p?.cantidad > 0 ? horasCortas(p.max_seg) : p ? '0' : '—'}</b>
            <span className="mt-1 text-[10px] text-gray-500 dark:text-zinc-400">{p?.cantidad > 0 ? 'la más antigua' : 'sin espera'}</span>
          </div>
        </div>
        <div className="grid flex-1 gap-2">
          <Dato etiqueta="Esperando respuesta" valor={p ? `${p.cantidad} ${p.cantidad === 1 ? 'conversación' : 'conversaciones'}` : '—'} />
          <Dato etiqueta="Espera promedio" valor={p?.cantidad > 0 ? formatoDuracion(p.promedio_seg) : '—'} />
        </div>
      </div>

      <div className="mt-3 grid gap-1.5">
        {p && p.cantidad === 0 && (
          <p className="rounded-xl bg-gray-50 px-3 py-2.5 text-xs font-medium text-green-600 dark:bg-white/[0.04] dark:text-green-400">Todas las consultas están respondidas.</p>
        )}
        {(p?.lista || []).map(x => {
          const n = nivelEspera(x.seg / 3600)
          const marco = n === 'roja' ? 'border-red-500/70 bg-red-500/10'
            : n === 'amarilla' ? 'border-amber-400/70 bg-amber-400/10'
            : 'border-transparent bg-gray-50 dark:bg-white/[0.03]'
          const colorHoras = n === 'roja' ? 'text-red-500' : n === 'amarilla' ? 'text-amber-500' : 'text-gray-900 dark:text-white'
          return (
            <div key={x.conversacion_id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${marco}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-gray-900 dark:text-white">{x.nombre || x.whatsapp}</p>
                <p className="text-[11px] text-gray-500 dark:text-zinc-400">Escribió {formatoCuando(x.desde)}</p>
              </div>
              <span className={`text-xs font-extrabold tabular-nums ${colorHoras}`}>{horasCortas(x.seg)}</span>
              <Link to={`/admin/crm/whatsapp?phone=${x.whatsapp}`} className="text-[11px] font-bold text-brand-600 hover:underline dark:text-zinc-200">Abrir</Link>
            </div>
          )
        })}
        {p && p.cantidad > (p.lista || []).length && (
          <p className="px-1 text-[11px] text-gray-400 dark:text-zinc-500">y {p.cantidad - p.lista.length} más</p>
        )}
      </div>
    </div>
  )
}

/* ─── Tiempo de respuesta humana ────────────────────────────────── */
export function TarjetaTiempoRespuesta({ datos, cargando, periodo }) {
  const r = datos?.respuesta
  return (
    <div className={`dash-card flex flex-col transition-opacity ${cargando ? 'opacity-60' : ''}`}>
      <Encabezado titulo="Tiempo de respuesta humana" sub="El asistente automático no cuenta" derecha={<EtiquetaPeriodo periodo={periodo} />} />
      <div className="mt-3 text-[40px] font-extrabold leading-none tracking-tight text-gray-900 dark:text-white">
        <Duracion seg={r?.promedio_seg} />
      </div>
      <p className="mt-1.5 text-xs text-gray-500 dark:text-zinc-400">
        {r ? (r.respondidos > 0 ? 'Promedio de consultas ya respondidas' : 'Ninguna consulta respondida todavía en el período') : ' '}
      </p>
      <div className="mt-auto grid gap-2 pt-4">
        <Dato etiqueta="Mediana" valor={formatoDuracion(r?.mediana_seg)} />
        <Dato etiqueta="Contando las que siguen sin respuesta" valor={formatoDuracion(r?.espera_promedio_seg)} clase="text-amber-500" />
        <Dato etiqueta="Consultas respondidas" valor={r ? fmt(r.respondidos) : '—'} />
        <Dato etiqueta="Sin responder" valor={r ? fmt(r.sin_responder) : '—'} clase="text-amber-500" />
      </div>
    </div>
  )
}

/* ─── CRM y mensajes (gráfico por día + indicadores) ─────────────── */
function TooltipDash({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-[150px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/15 dark:bg-zinc-900 dark:shadow-black/40">
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

function Indicador({ icono, titulo, valor, detalle, pct }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[11.5px] font-semibold text-gray-500 dark:text-zinc-400">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-[7px] bg-gray-900 text-white dark:bg-zinc-200 dark:text-zinc-900">
          <Ic n={icono} className="h-[13px] w-[13px]" />
        </span>
        {titulo}
      </div>
      <b className="mt-1.5 block text-xl font-extrabold text-gray-900 dark:text-white">{valor}</b>
      <small className="text-[10.5px] text-gray-400 dark:text-zinc-500">{detalle}</small>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-gray-400 to-gray-900 dark:from-zinc-500 dark:to-zinc-100" style={{ width: `${Math.max(0, Math.min(100, Math.round(pct || 0)))}%` }} />
      </div>
    </div>
  )
}

export function descargarReporte(datos, periodo, rango) {
  if (!datos) return
  const num = n => String(n ?? '').replace('.', ',')
  const ult = new Date(rango.hasta.getTime() - 1)
  const filas = [
    ['Reporte CRM - Dream Tours'],
    ['Periodo', PERIODOS.find(p => p.id === periodo).label, `${formatoFecha(rango.desde)} a ${formatoFecha(ult)}`],
    [],
    ['Metrica', 'Valor'],
    ['Conversaciones nuevas', datos.conversaciones_nuevas],
    ['Conversaciones con actividad', datos.conversaciones_activas],
    ['Mensajes recibidos', datos.mensajes_entrantes],
    ['Respuestas humanas enviadas', datos.mensajes_humanos],
    ['Mensajes del asistente automatico', datos.mensajes_bot],
    ['Plantillas enviadas', datos.mensajes_plantilla],
    ['Leads nuevos', datos.leads.nuevos],
    ['Leads cerrados (reservados)', datos.leads.cerrados],
    ['Leads perdidos', datos.leads.perdidos],
    ['Leads abiertos ahora', datos.leads.abiertos],
    ['Tiempo de respuesta humana - promedio (seg)', num(datos.respuesta.promedio_seg)],
    ['Tiempo de respuesta humana - mediana (seg)', num(datos.respuesta.mediana_seg)],
    ['Consultas respondidas', datos.respuesta.respondidos],
    ['Consultas sin responder (del periodo)', datos.respuesta.sin_responder],
    ['Espera promedio incluyendo las sin responder (seg)', num(datos.respuesta.espera_promedio_seg)],
    ['Esperando respuesta ahora (ultimos 7 dias)', datos.respuesta.pendientes?.cantidad],
    ['Espera mas larga ahora (seg)', num(datos.respuesta.pendientes?.max_seg)],
    ['Espera promedio de las que esperan ahora (seg)', num(datos.respuesta.pendientes?.promedio_seg)],
    ['Gasto estimado en mensajes (BRL)', num(Number(datos.costo.total).toFixed(2))],
    [],
    ['Dia', 'Conversaciones nuevas', 'Mensajes recibidos', 'Gasto estimado (BRL)'],
    ...datos.por_dia.map(d => [d.dia, d.conversaciones_nuevas, d.mensajes_entrantes, num(Number(d.gasto).toFixed(2))]),
  ]
  const csv = filas.map(f => f.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n')
  const bom = String.fromCharCode(0xFEFF)
  const url = URL.createObjectURL(new Blob([bom + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `reporte-crm-${periodo}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function TarjetaActividad({ metricas, periodo, setPeriodo }) {
  const oscuro = useTemaOscuro()
  const { datos, semana, cargando, rango } = metricas
  const esHoy = periodo === 'hoy'
  const fuente = esHoy ? semana : datos
  const serie = (fuente?.por_dia || []).map(d => ({
    ...d,
    etiqueta: new Date(d.dia + 'T12:00:00').toLocaleDateString('es-AR', esHoy || periodo === 'semana' ? { weekday: 'short' } : { day: 'numeric' }).replace('.', ''),
  }))
  const colorA = oscuro ? '#f4f4f5' : '#18181b'
  const colorB = oscuro ? '#8a8a93' : '#a1a1aa'
  const ganados = datos ? datos.leads.cerrados + datos.leads.perdidos : 0

  return (
    <div className={`dash-card transition-opacity ${cargando ? 'opacity-60' : ''}`}>
      <Encabezado
        titulo="CRM y mensajes"
        sub={CONTEXTO[periodo]}
        derecha={
          <div className="flex items-center gap-2">
            <div className="inline-flex gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-white/[0.06]" role="group" aria-label="Período">
              {PERIODOS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={periodo === p.id}
                  onClick={() => setPeriodo(p.id)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    periodo === p.id
                      ? 'bg-gray-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900'
                      : 'text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => descargarReporte(datos, periodo, rango)}
              disabled={!datos || cargando}
              title="Descargar reporte (CSV)"
              className="grid h-8 w-8 place-items-center rounded-xl border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/[0.08]"
            >
              <Ic n="dl" className="h-4 w-4" />
            </button>
          </div>
        }
      />

      <div className="mt-3 h-[190px] w-full">
        <ResponsiveContainer>
          <BarChart data={serie} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={oscuro ? '#ffffff14' : '#9ca3af33'} vertical={false} />
            <XAxis dataKey="etiqueta" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} interval={serie.length > 12 ? 2 : 0} />
            <YAxis allowDecimals={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip content={<TooltipDash />} cursor={{ fill: oscuro ? '#ffffff0d' : '#9ca3af22' }} />
            <Bar dataKey="conversaciones_nuevas" name="Conversaciones nuevas" fill={colorA} radius={[4, 4, 0, 0]} maxBarThickness={9}>
              {serie.map((_, i) => <Cell key={i} fillOpacity={esHoy && i < serie.length - 1 ? 0.35 : 1} />)}
            </Bar>
            <Bar dataKey="mensajes_entrantes" name="Mensajes recibidos" fill={colorB} radius={[4, 4, 0, 0]} maxBarThickness={9}>
              {serie.map((_, i) => <Cell key={i} fillOpacity={esHoy && i < serie.length - 1 ? 0.35 : 1} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: colorA }} />Conversaciones nuevas</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: colorB }} />Mensajes recibidos</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
        <Indicador icono="chat" titulo="Conversaciones nuevas" valor={datos ? fmt(datos.conversaciones_nuevas) : '—'}
          detalle={datos ? `${fmt(datos.conversaciones_activas)} con actividad` : ' '}
          pct={datos && datos.conversaciones_activas ? datos.conversaciones_nuevas / datos.conversaciones_activas * 100 : 0} />
        <Indicador icono="send" titulo="Mensajes recibidos" valor={datos ? fmt(datos.mensajes_entrantes) : '—'}
          detalle={datos ? `${fmt(datos.mensajes_humanos)} respuestas humanas` : ' '}
          pct={datos && datos.mensajes_entrantes ? Math.min(100, datos.mensajes_humanos / datos.mensajes_entrantes * 100 * 2) : 0} />
        <Indicador icono="check" titulo="Leads cerrados" valor={datos ? fmt(datos.leads.cerrados) : '—'}
          detalle={datos ? `${fmt(datos.leads.nuevos)} leads nuevos` : ' '}
          pct={ganados ? datos.leads.cerrados / ganados * 100 : 0} />
        <Indicador icono="down" titulo="Leads perdidos" valor={datos ? fmt(datos.leads.perdidos) : '—'}
          detalle={datos ? `${fmt(datos.leads.abiertos)} abiertos ahora` : ' '}
          pct={ganados ? datos.leads.perdidos / ganados * 100 : 0} />
      </div>
    </div>
  )
}

/* ─── Mensajes gratis del mes (cuenta regresiva por número) ────── */
const NOMBRE_NUMERO = { crm: 'CRM (WhatsApp)', operativo: 'Operativo (avisos)' }

function proximoReinicio() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
}

function FilaContador({ numero, info }) {
  const total = info?.total || 1000
  const usados = Math.min(info?.usados || 0, total)
  const disponibles = info?.disponibles ?? Math.max(0, total - usados)
  const parte = total ? usados / total : 0
  const critico = disponibles === 0
  const alerta = !critico && disponibles <= total * 0.1
  const color = critico ? 'bg-red-500' : alerta ? 'bg-amber-500' : 'bg-gray-900 dark:bg-zinc-100'
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">{NOMBRE_NUMERO[numero] || numero}</span>
        <span className={`text-xs font-bold tabular-nums ${critico ? 'text-red-500' : alerta ? 'text-amber-500' : 'text-gray-900 dark:text-white'}`}>
          {fmt(disponibles)} gratis quedan
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.round(Math.min(1, parte) * 100)}%` }} />
      </div>
      <p className="mt-1 text-[10.5px] text-gray-400 dark:text-zinc-500">{fmt(usados)} de {fmt(total)} usados este mes</p>
    </div>
  )
}

/* ─── Gasto estimado en mensajes ────────────────────────────────── */
export function TarjetaGasto({ datos, cargando, periodo, esAdmin, alCambiarTarifa }) {
  const [paises, setPaises] = useState([])
  const [cfg, setCfg] = useState(null)
  const [verTarifas, setVerTarifas] = useState(false)

  useEffect(() => {
    tarifasPaisApi.getAll()?.then(({ data }) => setPaises(data || []))
    configCostosApi.get()?.then(({ data }) => setCfg(data || null))
  }, [])

  async function guardarPais(pais, texto) {
    const valor = parseFloat(String(texto).replace(',', '.'))
    if (Number.isNaN(valor) || valor < 0) return
    const { data } = await tarifasPaisApi.update(pais, valor)
    if (data) {
      setPaises(prev => prev.map(p => p.pais === pais ? data : p))
      alCambiarTarifa?.()
    }
  }

  async function guardarCfg(campo, texto, entero = false) {
    const valor = entero ? parseInt(texto, 10) : parseFloat(String(texto).replace(',', '.'))
    if (Number.isNaN(valor) || valor < 0) return
    const { data } = await configCostosApi.update({ [campo]: valor })
    if (data) {
      setCfg(data)
      alCambiarTarifa?.()
    }
  }

  const costo = datos?.costo
  const pagas = costo?.pagos || 0
  const gratis = costo?.gratis || 0
  const total = pagas + gratis
  const parte = total ? pagas / total : 0
  const r = 38
  const circ = 2 * Math.PI * r
  const gratisMes = datos?.gratis_mes

  return (
    <div className={`dash-card transition-opacity ${cargando ? 'opacity-60' : ''}`}>
      <Encabezado titulo="Gasto estimado en mensajes" sub="En reales, según el país de cada destinatario" derecha={<EtiquetaPeriodo periodo={periodo} />} />
      <div className="mt-3 text-[38px] font-extrabold leading-none tracking-tight text-gray-900 dark:text-white">{costo ? formatoReales(costo.total) : '—'}</div>
      <div className="mt-4 flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full">
            <circle cx="50" cy="50" r={r} fill="none" strokeWidth="11" className="stroke-gray-200 dark:stroke-zinc-700" />
            <circle cx="50" cy="50" r={r} fill="none" strokeWidth="11" className="stroke-gray-900 dark:stroke-zinc-100"
              strokeDasharray={`${circ * parte} ${circ}`} transform="rotate(-90 50 50)" />
          </svg>
          <div className="absolute inset-0 grid place-content-center text-center">
            <b className="text-[15px] font-extrabold text-gray-900 dark:text-white">{Math.round(parte * 100)}%</b>
            <span className="text-[9.5px] text-gray-500 dark:text-zinc-400">pagos</span>
          </div>
        </div>
        <div className="grid flex-1 gap-2">
          <Dato etiqueta="Mensajes pagos" valor={costo ? fmt(pagas) : '—'} />
          <Dato etiqueta="Dentro de los gratis" valor={costo ? fmt(gratis) : '—'} />
        </div>
      </div>

      {gratisMes && (
        <div className="mt-4 grid gap-3 border-t border-gray-100 pt-3 dark:border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">Mensajes gratis de este mes</p>
          <FilaContador numero="crm" info={gratisMes.crm} />
          <FilaContador numero="operativo" info={gratisMes.operativo} />
          <p className="text-[10.5px] text-gray-400 dark:text-zinc-500">Se reinician el {proximoReinicio()}. Cada número de Meta tiene su propio pozo.</p>
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-gray-400 dark:text-zinc-500">
        Estimación: desde el 1/10/2026 Meta cobra por mensaje saliente según el país del destinatario, salvo los primeros {fmt(cfg?.mensajes_gratis_mes || 1000)} de cada número por mes. Lo que vale es la factura de Meta.
      </p>

      <button type="button" onClick={() => setVerTarifas(v => !v)} className="mt-2 text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-white">
        {verTarifas ? 'Ocultar' : 'Ver'} tarifas usadas para el cálculo
      </button>
      {verTarifas && (
        <div className="mt-2 divide-y divide-gray-50 rounded-xl border border-gray-100 px-3 dark:divide-white/5 dark:border-white/10">
          {paises.map(p => (
            <div key={p.pais} className="flex items-center gap-3 py-2">
              <span className="flex-1 text-xs text-gray-700 dark:text-zinc-300">{p.nombre}</span>
              {esAdmin ? (
                <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-400">
                  USD
                  <input
                    type="number" step="0.0001" min="0"
                    defaultValue={Number(p.valor_usd)}
                    key={`${p.pais}-${p.valor_usd}`}
                    onBlur={e => { if (Number(e.target.value) !== Number(p.valor_usd)) guardarPais(p.pais, e.target.value) }}
                    className="w-20 rounded-lg border border-gray-200 bg-white px-2 py-1 text-right text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  por mensaje
                </label>
              ) : (
                <span className="text-xs text-gray-500 dark:text-zinc-400">USD {Number(p.valor_usd).toFixed(4)} por mensaje</span>
              )}
            </div>
          ))}
          {cfg && (
            <div className="flex items-center gap-3 py-2">
              <span className="flex-1 text-xs text-gray-700 dark:text-zinc-300">Cotización (1 USD)</span>
              {esAdmin ? (
                <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-400">
                  R$
                  <input
                    type="number" step="0.01" min="0"
                    defaultValue={Number(cfg.usd_a_brl)}
                    key={`usd-${cfg.usd_a_brl}`}
                    onBlur={e => { if (Number(e.target.value) !== Number(cfg.usd_a_brl)) guardarCfg('usd_a_brl', e.target.value) }}
                    className="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1 text-right text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </label>
              ) : (
                <span className="text-xs text-gray-500 dark:text-zinc-400">{formatoReales(cfg.usd_a_brl)}</span>
              )}
            </div>
          )}
          {cfg && (
            <div className="flex items-center gap-3 py-2">
              <span className="flex-1 text-xs text-gray-700 dark:text-zinc-300">Gratis por número y por mes</span>
              {esAdmin ? (
                <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-400">
                  <input
                    type="number" step="1" min="0"
                    defaultValue={cfg.mensajes_gratis_mes}
                    key={`gratis-${cfg.mensajes_gratis_mes}`}
                    onBlur={e => { if (Number(e.target.value) !== cfg.mensajes_gratis_mes) guardarCfg('mensajes_gratis_mes', e.target.value, true) }}
                    className="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1 text-right text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  mensajes
                </label>
              ) : (
                <span className="text-xs text-gray-500 dark:text-zinc-400">{fmt(cfg.mensajes_gratis_mes)} mensajes</span>
              )}
            </div>
          )}
          {!esAdmin && <p className="py-2 text-[11px] text-gray-400 dark:text-zinc-500">Solo un usuario Admin puede cambiar las tarifas.</p>}
        </div>
      )}
    </div>
  )
}
