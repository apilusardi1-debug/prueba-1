import { useState, useEffect, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { crmMetricasApi, tarifasMensajeApi } from '../../lib/supabase.js'

const PERIODOS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
]

// Los límites se calculan en la hora local del navegador: "hoy" empieza a la
// medianoche de quien mira el panel, no a la de UTC. La semana va de lunes a hoy.
function rangoPeriodo(periodo) {
  const ahora = new Date()
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1)
  let desde = hoy
  if (periodo === 'semana') desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7))
  if (periodo === 'mes') desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  return { desde, hasta: manana }
}

function formatoDuracion(seg) {
  if (seg == null) return '—'
  const s = Math.round(Number(seg))
  if (s < 60) return `${s} s`
  const min = Math.round(s / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h < 24) return `${h} h ${String(m).padStart(2, '0')} min`
  return `${Math.floor(h / 24)} d ${h % 24} h`
}

function formatoReales(v) {
  return Number(v || 0).toLocaleString('es-AR', { style: 'currency', currency: 'BRL' })
}

function formatoFecha(d) {
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function Tarjeta({ titulo, valor, detalle, claseValor }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm dark:shadow-black/20 border border-gray-100 dark:border-zinc-800">
      <p className="text-sm text-gray-500 dark:text-zinc-400 font-medium mb-2">{titulo}</p>
      <p className={`text-3xl font-bold ${claseValor || 'text-gray-900 dark:text-zinc-100'}`}>{valor}</p>
      {detalle && <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1.5 leading-relaxed">{detalle}</p>}
    </div>
  )
}

export default function MetricasCRM({ esAdmin }) {
  const [periodo, setPeriodo] = useState('hoy')
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [tarifas, setTarifas] = useState([])
  const [mostrarTarifas, setMostrarTarifas] = useState(false)
  const pedidoActual = useRef(0)

  const rango = rangoPeriodo(periodo)

  async function cargar() {
    const pedido = ++pedidoActual.current
    setCargando(true)
    const { desde, hasta } = rangoPeriodo(periodo)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bahia'
    const { data, error: err } = await crmMetricasApi.get(desde.toISOString(), hasta.toISOString(), tz)
    if (pedido !== pedidoActual.current) return
    setError(!!err || !data)
    setDatos(err ? null : data)
    setCargando(false)
  }

  useEffect(() => { cargar() }, [periodo])

  useEffect(() => {
    tarifasMensajeApi.getAll().then(({ data }) => setTarifas(data || []))
  }, [])

  async function guardarTarifa(cobro, texto) {
    const valor = parseFloat(String(texto).replace(',', '.'))
    if (Number.isNaN(valor) || valor < 0) return
    const { data } = await tarifasMensajeApi.update(cobro, valor)
    if (data) {
      setTarifas(prev => prev.map(t => t.cobro === cobro ? data : t))
      cargar()
    }
  }

  function descargarCSV() {
    if (!datos) return
    const num = n => String(n ?? '').replace('.', ',')
    const filas = [
      ['Reporte CRM - Dream Tours'],
      ['Periodo', PERIODOS.find(p => p.id === periodo).label, `${formatoFecha(rango.desde)} a ${formatoFecha(new Date(rango.hasta.getTime() - 1))}`],
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
      ['Consultas sin responder', datos.respuesta.sin_responder],
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

  const costo = datos?.costo
  const pagos = costo ? Object.entries(costo.detalle || {}).filter(([cobro]) => cobro !== 'servicio') : []
  const cantidadPagos = pagos.reduce((s, [, v]) => s + v.cantidad, 0)
  const gratis = costo?.detalle?.servicio?.cantidad || 0
  const serie = (datos?.por_dia || []).map(d => ({
    ...d,
    etiqueta: new Date(d.dia + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' }),
  }))

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">CRM y mensajes</h2>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
            {formatoFecha(rango.desde)}{periodo !== 'hoy' && ` a ${formatoFecha(new Date(rango.hasta.getTime() - 1))}`}
            {periodo === 'semana' && ' (lunes a hoy)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 dark:bg-zinc-800 rounded-xl p-1">
            {PERIODOS.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriodo(p.id)}
                className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${
                  periodo === p.id
                    ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-sm'
                    : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={descargarCSV}
            disabled={!datos || cargando}
            className="text-sm font-medium px-3.5 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
          >
            Descargar reporte
          </button>
        </div>
      </div>

      {error && !cargando && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl p-5">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">No se pudieron cargar las métricas</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Falta correr la migración 20260920100000_crm_metricas.sql en Supabase, o hay un problema de conexión.</p>
        </div>
      )}

      {!error && (
        <div className={`transition-opacity ${cargando ? 'opacity-50' : ''}`}>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Tarjeta
              titulo="Conversaciones nuevas"
              valor={datos?.conversaciones_nuevas ?? '—'}
              detalle={datos && `${datos.conversaciones_activas} con actividad en el período`}
            />
            <Tarjeta
              titulo="Mensajes recibidos"
              valor={datos?.mensajes_entrantes ?? '—'}
              detalle={datos && `${datos.mensajes_humanos} respuestas humanas · ${datos.mensajes_bot} del asistente automático`}
            />
            <Tarjeta
              titulo="Tiempo de respuesta humana"
              valor={formatoDuracion(datos?.respuesta.promedio_seg)}
              detalle={datos && (datos.respuesta.respondidos > 0
                ? `Promedio de ${datos.respuesta.respondidos} consultas · mediana ${formatoDuracion(datos.respuesta.mediana_seg)} · ${datos.respuesta.sin_responder} sin responder`
                : `Sin consultas respondidas · ${datos.respuesta.sin_responder} sin responder`)}
            />
            <Tarjeta
              titulo="Leads cerrados"
              valor={datos?.leads.cerrados ?? '—'}
              claseValor="text-green-600 dark:text-green-400"
              detalle={datos && `Pasaron a Reservado en el período · ${datos.leads.nuevos} leads nuevos`}
            />
            <Tarjeta
              titulo="Leads perdidos"
              valor={datos?.leads.perdidos ?? '—'}
              claseValor="text-red-500 dark:text-red-400"
              detalle={datos && `Pasaron a Perdido en el período · ${datos.leads.abiertos} abiertos ahora`}
            />
            <Tarjeta
              titulo="Gasto estimado en mensajes"
              valor={costo ? formatoReales(costo.total) : '—'}
              claseValor="text-orange-500 dark:text-orange-400"
              detalle={datos && `${cantidadPagos} plantillas pagas · ${gratis} mensajes de servicio sin costo`}
            />
          </div>

          {serie.length > 1 && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm dark:shadow-black/20 mt-4 p-5">
              <p className="font-semibold text-gray-800 dark:text-zinc-200 text-sm mb-3">Actividad por día</p>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={serie} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af33" vertical={false} />
                    <XAxis dataKey="etiqueta" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: '#9ca3af22' }} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="conversaciones_nuevas" name="Conversaciones nuevas" fill="#002147" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="mensajes_entrantes" name="Mensajes recibidos" fill="#d9a83a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="mt-3">
            <button
              onClick={() => setMostrarTarifas(v => !v)}
              className="text-xs font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
            >
              {mostrarTarifas ? 'Ocultar' : 'Ver'} cómo se calcula el gasto
            </button>
            {mostrarTarifas && (
              <div className="mt-2 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5">
                <p className="text-xs text-gray-500 dark:text-zinc-400 mb-3 leading-relaxed">
                  Es una estimación: cada mensaje enviado se multiplica por la tarifa de su tipo. Las respuestas libres dentro de las 24 horas
                  posteriores al mensaje del cliente (servicio) no se cobran; las plantillas sí. Solo cuenta lo enviado desde que se activó este registro.
                  Lo que vale es la factura de Meta.
                </p>
                <div className="divide-y divide-gray-50 dark:divide-zinc-800">
                  {tarifas.map(t => (
                    <div key={t.cobro} className="flex items-center gap-3 py-2">
                      <span className="flex-1 text-sm text-gray-700 dark:text-zinc-300">{t.nombre}</span>
                      {esAdmin ? (
                        <label className="flex items-center gap-1 text-sm text-gray-500 dark:text-zinc-400">
                          R$
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={Number(t.valor)}
                            key={`${t.cobro}-${t.valor}`}
                            onBlur={e => { if (Number(e.target.value) !== Number(t.valor)) guardarTarifa(t.cobro, e.target.value) }}
                            className="w-20 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-400"
                          />
                          por mensaje
                        </label>
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-zinc-400">{formatoReales(t.valor)} por mensaje</span>
                      )}
                    </div>
                  ))}
                </div>
                {!esAdmin && <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-2">Solo un usuario Admin puede cambiar las tarifas.</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
