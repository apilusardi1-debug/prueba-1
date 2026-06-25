import { useState, useEffect } from 'react'
import { excursiones, reservas, formatPrecio } from '../../data/mockData.js'
import { choferesApi, guiasApi } from '../../lib/supabase.js'
import { sendWhatsApp } from '../../lib/ultramsg.js'

/* ── Helpers ──────────────────────────────────────────────────── */
const DIAS_CAL = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function formatFechaLarga(fechaStr) {
  return new Date(fechaStr + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatFechaCorta(fechaStr) {
  return new Date(fechaStr + 'T12:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function buildSalidas() {
  return excursiones.flatMap((ex) =>
    ex.fechas.map((f) => ({
      fecha: f,
      excursion: ex,
      reservas: reservas.filter(
        (r) => r.fecha === f && r.excursionId === ex.id && r.estado !== 'cancelada'
      ),
    }))
  )
}

function primerMesConDatos() {
  return new Date()
}

function getExcursionTipo(excursionId) {
  const ex = excursiones.find((e) => e.id === excursionId)
  if (!ex) return '—'
  return ex.categoria === 'paquetes' ? 'Paquete' : 'Excursión'
}

const TABS = [
  { key: 'todas',      label: 'Todas' },
  { key: 'pendiente',  label: 'Pendientes' },
  { key: 'confirmada', label: 'Confirmadas' },
  { key: 'cancelada',  label: 'Canceladas' },
]

const STATUS_CONFIG = {
  confirmada: { label: 'Confirmada', dot: 'bg-green-500',  text: 'text-green-700',  bg: 'bg-green-50',  darkText: 'dark:text-green-400',  darkBg: 'dark:bg-green-950/40' },
  pendiente:  { label: 'En Proceso', dot: 'bg-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50', darkText: 'dark:text-yellow-400', darkBg: 'dark:bg-yellow-950/40' },
  cancelada:  { label: 'Cancelada',  dot: 'bg-red-400',    text: 'text-red-700',    bg: 'bg-red-50',    darkText: 'dark:text-red-400',    darkBg: 'dark:bg-red-950/40' },
}

const HORARIOS_EXCURSION = {
  '1': { partida: '7:00 AM', regreso: '6:00 PM' },
  '2': { partida: '6:30 AM', regreso: '5:30 PM' },
  '3': { partida: '8:00 AM', regreso: '7:00 PM' },
  '4': { partida: '7:30 AM', regreso: '8:00 PM' },
  '5': { partida: '6:00 AM', regreso: '5:00 PM' },
  '6': { partida: '8:30 AM', regreso: '4:00 PM' },
  '7': { partida: '7:00 AM', regreso: '3:00 PM' },
}

const AVATAR_COLORS = ['bg-blue-500','bg-purple-500','bg-emerald-500','bg-orange-400','bg-pink-500','bg-teal-500','bg-indigo-500','bg-rose-500']

function iniciales(nombre) {
  return (nombre || '?').split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}
function avatarColor(nombre) {
  return AVATAR_COLORS[(nombre || '').charCodeAt(0) % AVATAR_COLORS.length]
}

function IconTabla() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/>
    </svg>
  )
}
function IconCalendario() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════════ */
export default function Agenda() {
  const [vista, setVista] = useState('tabla')
  const [choferes, setChoferes] = useState([])
  const [guias, setGuias] = useState([])
  const [asignaciones, setAsignaciones] = useState({})
  const [guiaAsignaciones, setGuiaAsignaciones] = useState({})
  const [modal, setModal] = useState(null)

  useEffect(() => {
    choferesApi.getAll().then(({ data, error }) => {
      if (!error) setChoferes((data || []).filter((c) => c.activo))
    })
    guiasApi.getAll().then(({ data, error }) => {
      if (!error) setGuias(data || [])
    })
  }, [])

  return (
    <div className="p-8">
      {/* Encabezado */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Agenda</h1>
          <p className="text-gray-400 dark:text-zinc-500 text-sm mt-0.5">Reservas y salidas · Dreams Tours</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Toggle vista */}
          <div className="flex items-center bg-gray-100 dark:bg-zinc-900 rounded-xl p-1 gap-1 border border-transparent dark:border-zinc-800">
            <button
              onClick={() => setVista('tabla')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                vista === 'tabla'
                  ? 'bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 shadow-sm'
                  : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'
              }`}
            >
              <IconTabla /> Tabla
            </button>
            <button
              onClick={() => setVista('calendario')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                vista === 'calendario'
                  ? 'bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 shadow-sm'
                  : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'
              }`}
            >
              <IconCalendario /> Calendario
            </button>
          </div>

          {vista === 'tabla' && (
            <>
              <button className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Personalizar columnas
              </button>
              <button className="flex items-center gap-2 text-sm font-semibold text-white bg-[#002147] dark:bg-zinc-100 dark:text-zinc-900 rounded-xl px-4 py-2 hover:bg-[#003366] dark:hover:bg-zinc-200 transition-colors shadow-sm">
                <span className="text-base leading-none">+</span>
                Nueva Reserva
              </button>
            </>
          )}
        </div>
      </div>

      {vista === 'tabla' ? (
        <VistaTabla />
      ) : (
        <VistaCalendario
          choferes={choferes}
          guias={guias}
          asignaciones={asignaciones}
          guiaAsignaciones={guiaAsignaciones}
          onAsignar={(id, cid) => setAsignaciones((p) => ({ ...p, [id]: cid }))}
          onAsignarGuia={(opKey, gid) => setGuiaAsignaciones((p) => ({ ...p, [opKey]: gid }))}
          modal={modal}
          setModal={setModal}
        />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   VISTA TABLA
══════════════════════════════════════════════════════════════════ */
function VistaTabla() {
  const [tabActiva, setTabActiva] = useState('todas')
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [accionesAbierta, setAccionesAbierta] = useState(null)

  const filas = tabActiva === 'todas' ? reservas : reservas.filter((r) => r.estado === tabActiva)
  const conteos = {
    todas:      reservas.length,
    pendiente:  reservas.filter((r) => r.estado === 'pendiente').length,
    confirmada: reservas.filter((r) => r.estado === 'confirmada').length,
    cancelada:  reservas.filter((r) => r.estado === 'cancelada').length,
  }

  function toggleSeleccion(id) {
    setSeleccionados((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleTodos() {
    setSeleccionados(seleccionados.size === filas.length ? new Set() : new Set(filas.map((r) => r.id)))
  }
  const todosSeleccionados = filas.length > 0 && seleccionados.size === filas.length

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 pt-4 border-b border-gray-100 dark:border-zinc-800">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTabActiva(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              tabActiva === tab.key
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'
            }`}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
              tabActiva === tab.key
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500'
            }`}>
              {conteos[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-zinc-800/60 border-b border-gray-100 dark:border-zinc-800">
              <th className="w-10 pl-4 py-3"><span className="text-gray-300 dark:text-zinc-700 text-base select-none">⋮⋮</span></th>
              <th className="w-10 py-3">
                <input type="checkbox" checked={todosSeleccionados} onChange={toggleTodos}
                  className="w-4 h-4 rounded border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 cursor-pointer" />
              </th>
              {['Excursión','Tipo','Estado','Pasajeros','Fecha','Hospedaje'].map((h) => (
                <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-gray-400 dark:text-zinc-600 uppercase tracking-wider">{h}</th>
              ))}
              <th className="w-12 py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {filas.map((reserva, idx) => {
              const status = STATUS_CONFIG[reserva.estado] || STATUS_CONFIG.pendiente
              const sel = seleccionados.has(reserva.id)
              return (
                <tr key={reserva.id} className={`border-b border-gray-100 dark:border-zinc-800/60 transition-colors ${
                  sel ? 'bg-blue-50/60 dark:bg-zinc-800/80'
                      : idx % 2 === 1 ? 'bg-[#F9FAFB] dark:bg-zinc-800/20 hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                                      : 'bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                }`}>
                  <td className="pl-4 py-3.5"><span className="text-gray-300 dark:text-zinc-700 text-base select-none cursor-grab">⋮⋮</span></td>
                  <td className="py-3.5">
                    <input type="checkbox" checked={sel} onChange={() => toggleSeleccion(reserva.id)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 cursor-pointer" />
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-gray-900 dark:text-zinc-100 leading-snug">{reserva.excursionNombre}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{reserva.clienteNombre}</p>
                  </td>
                  <td className="py-3.5 px-4 text-gray-600 dark:text-zinc-400">{getExcursionTipo(reserva.excursionId)}</td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text} ${status.darkBg} ${status.darkText}`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.dot}`} />
                      {status.label}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-gray-700 dark:text-zinc-300 font-medium">{reserva.personas} pax</td>
                  <td className="py-3.5 px-4 text-gray-600 dark:text-zinc-400 capitalize">{formatFechaCorta(reserva.fecha)}</td>
                  <td className="py-3.5 px-4 text-gray-600 dark:text-zinc-400">{reserva.hospedaje || '—'}</td>
                  <td className="py-3.5 px-4 relative">
                    <button
                      onClick={() => setAccionesAbierta(accionesAbierta === reserva.id ? null : reserva.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
                    >⋮</button>
                    {accionesAbierta === reserva.id && (
                      <div className="absolute right-4 top-full mt-1 z-20 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl shadow-lg dark:shadow-black/40 py-1 w-40"
                        onMouseLeave={() => setAccionesAbierta(null)}>
                        {['Ver detalle','Editar reserva','Enviar WhatsApp'].map((a) => (
                          <button key={a} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors">{a}</button>
                        ))}
                        <div className="border-t border-gray-100 dark:border-zinc-700 my-1" />
                        <button className="w-full text-left px-4 py-2 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">Cancelar reserva</button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {filas.length === 0 && (
              <tr><td colSpan={9} className="py-16 text-center text-gray-400 dark:text-zinc-600">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-sm">No hay reservas en esta categoría</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between">
        <p className="text-xs text-gray-400 dark:text-zinc-600">
          {seleccionados.size > 0 ? `${seleccionados.size} seleccionada${seleccionados.size > 1 ? 's' : ''}` : `${filas.length} reservas`}
        </p>
        <p className="text-xs text-gray-400 dark:text-zinc-600">Dreams Tours · {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   VISTA CALENDARIO
══════════════════════════════════════════════════════════════════ */
function VistaCalendario({ choferes, guias, asignaciones, guiaAsignaciones, onAsignar, onAsignarGuia, modal, setModal }) {
  const todasLasSalidas = buildSalidas()
  const hoy = new Date()
  const todayStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`

  const [mes, setMes] = useState(primerMesConDatos)
  const [diaSeleccionado, setDiaSeleccionado] = useState(todayStr)

  const anio = mes.getFullYear()
  const numMes = mes.getMonth()
  const diasEnMes = new Date(anio, numMes + 1, 0).getDate()
  const diasMesAnterior = new Date(anio, numMes, 0).getDate()
  const primerDiaLunes = (new Date(anio, numMes, 1).getDay() + 6) % 7

  const salidasPorFecha = {}
  todasLasSalidas.forEach((s) => {
    const [sy, sm] = s.fecha.split('-').map(Number)
    if (sy === anio && sm === numMes + 1) {
      if (!salidasPorFecha[s.fecha]) salidasPorFecha[s.fecha] = []
      salidasPorFecha[s.fecha].push(s)
    }
  })

  const celdas = []
  for (let i = primerDiaLunes - 1; i >= 0; i--) celdas.push({ dia: diasMesAnterior - i, mesOffset: -1 })
  for (let d = 1; d <= diasEnMes; d++) celdas.push({ dia: d, mesOffset: 0 })
  let nd = 1
  while (celdas.length % 7 !== 0) celdas.push({ dia: nd++, mesOffset: 1 })
  const semanas = []
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7))

  function toFechaStr(dia, offset) {
    const d = new Date(anio, numMes + offset, dia)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const tituloMes = mes.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const salidaHoy = salidasPorFecha[diaSeleccionado] || []
  const [sy, sm, sd] = diaSeleccionado.split('-').map(Number)
  const fechaLegible = new Date(sy, sm - 1, sd).toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">

      {/* ── Calendario ── */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <button onClick={() => setMes(new Date(anio, numMes - 1, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 dark:text-zinc-500 transition-colors text-lg">‹</button>
          <h2 className="font-semibold text-gray-800 dark:text-zinc-200 capitalize text-sm">{tituloMes}</h2>
          <button onClick={() => setMes(new Date(anio, numMes + 1, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 dark:text-zinc-500 transition-colors text-lg">›</button>
        </div>

        <div className="grid grid-cols-7 px-3 mt-2 mb-1">
          {DIAS_CAL.map((d, i) => (
            <div key={i} className="text-center text-xs font-semibold text-gray-400 dark:text-zinc-600 py-1">{d}</div>
          ))}
        </div>

        <div className="px-3 pb-4 space-y-0">
          {semanas.map((semana, si) => (
            <div key={si} className="grid grid-cols-7">
              {semana.map(({ dia, mesOffset }, di) => {
                const fechaStr = toFechaStr(dia, mesOffset)
                const esHoy = fechaStr === todayStr
                const seleccionado = fechaStr === diaSeleccionado
                const tieneSalidas = !!salidasPorFecha[fechaStr]
                const esMesActual = mesOffset === 0

                return (
                  <button key={di} onClick={() => setDiaSeleccionado(fechaStr)}
                    className="flex flex-col items-center py-1.5 gap-0.5 group">
                    <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-all ${
                      esHoy
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold'
                        : seleccionado
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold ring-1 ring-zinc-300 dark:ring-zinc-700'
                        : esMesActual
                        ? 'text-gray-700 dark:text-zinc-300 group-hover:bg-gray-100 dark:group-hover:bg-zinc-800'
                        : 'text-gray-300 dark:text-zinc-700'
                    }`}>{dia}</span>
                    {tieneSalidas && esMesActual && (
                      <span className={`w-1 h-1 rounded-full ${esHoy ? 'bg-zinc-400 dark:bg-zinc-500' : seleccionado ? 'bg-zinc-500 dark:bg-zinc-400' : 'bg-gray-300 dark:bg-zinc-700'}`} />
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Agenda del día ── */}
      <div>
        <div className="mb-4">
          <h3 className="font-semibold text-gray-800 dark:text-zinc-200 capitalize text-sm">{fechaLegible}</h3>
          <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5">
            {salidaHoy.length === 0 ? 'Sin operaciones este día' : `${salidaHoy.length} operación${salidaHoy.length > 1 ? 'es' : ''}`}
          </p>
        </div>

        {salidaHoy.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 py-14 flex flex-col items-center">
            <svg className="w-10 h-10 mb-3 text-gray-200 dark:text-zinc-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="1.5"/>
              <line x1="16" y1="2" x2="16" y2="6" strokeWidth="1.5"/><line x1="8" y1="2" x2="8" y2="6" strokeWidth="1.5"/>
              <line x1="3" y1="10" x2="21" y2="10" strokeWidth="1.5"/>
            </svg>
            <p className="text-sm font-medium text-gray-400 dark:text-zinc-600">Sin operaciones</p>
            <p className="text-xs text-gray-300 dark:text-zinc-700 mt-1">Seleccioná otro día para ver salidas</p>
          </div>
        ) : (
          <div className="space-y-4">
            {salidaHoy.map((salida) => {
              const horario = HORARIOS_EXCURSION[salida.excursion.id] || { partida: '8:00 AM', regreso: '6:00 PM' }
              const paxTotal = salida.reservas.reduce((a, r) => a + r.personas, 0)
              return (
                <div key={salida.excursion.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm dark:shadow-black/20 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-50 dark:border-zinc-800 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-zinc-100 text-sm">{salida.excursion.nombre}</h4>
                      <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">🕐 {horario.partida} — Regreso estimado {horario.regreso}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-medium text-gray-500 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800 rounded-full px-2.5 py-1">
                        {paxTotal} pax
                      </span>
                      <button onClick={() => setModal({ salida })}
                        className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-xl px-3 py-1.5 transition-colors">
                        Gestionar
                      </button>
                    </div>
                  </div>

                  {salida.reservas.length === 0 ? (
                    <div className="px-5 py-4 text-sm text-gray-400 dark:text-zinc-600">Sin reservas confirmadas</div>
                  ) : (
                    <div className="divide-y divide-gray-50 dark:divide-zinc-800">
                      {salida.reservas.map((r) => (
                        <div key={r.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors">
                          <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${avatarColor(r.clienteNombre)}`}>
                            {iniciales(r.clienteNombre)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate">{r.clienteNombre}</p>
                            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{horario.partida} · Regreso {horario.regreso} · {r.personas} pax</p>
                          </div>
                          <p className="text-xs text-gray-400 dark:text-zinc-600 flex-shrink-0 hidden sm:block">{r.hospedaje || '—'}</p>
                          <a href={`https://wa.me/${r.clienteWhatsapp}`} target="_blank" rel="noopener noreferrer"
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-green-50 dark:hover:bg-green-950/30 text-green-500 transition-colors flex-shrink-0">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.532 5.85L.073 23.927l6.236-1.434A11.938 11.938 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.65-.491-5.18-1.349l-.37-.217-3.7.851.875-3.614-.24-.382A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                            </svg>
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal && (
        <ModalPasajeros
          salida={modal.salida}
          choferes={choferes}
          guias={guias}
          asignaciones={asignaciones}
          guiaAsignaciones={guiaAsignaciones}
          onAsignar={onAsignar}
          onAsignarGuia={onAsignarGuia}
          onCerrar={() => setModal(null)}
        />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   MODAL PASAJEROS
══════════════════════════════════════════════════════════════════ */
function ModalPasajeros({ salida, choferes, guias, asignaciones, guiaAsignaciones, onAsignar, onAsignarGuia, onCerrar }) {
  const { excursion, reservas: pasajeros, fecha } = salida
  const opKey = `${excursion.id}-${fecha}`
  const paxReservados = pasajeros.reduce((a, r) => a + r.personas, 0)
  const conChofer = pasajeros.filter((r) => asignaciones[r.id])
  const guiaAsignado = guias.find((g) => g.id === guiaAsignaciones[opKey])
  const listoParaCerrar = guiaAsignaciones[opKey] && conChofer.length > 0

  async function cerrarOperacion() {
    if (!listoParaCerrar) return
    const fechaFmt = formatFechaLarga(fecha)
    const horario = HORARIOS_EXCURSION[excursion.id] || { partida: '8:00 AM', regreso: '6:00 PM' }

    const hora = new Date().getHours()
    const saludo = hora >= 6 && hora < 12 ? 'Buenos días' : hora >= 12 && hora < 20 ? 'Buenas tardes' : 'Buenas noches'

    // Mensaje al GUÍA — operación completa con nombre, pax, teléfono y chofer por pasajero
    const lineasGuia = pasajeros.map((r) => {
      const choferR = choferes.find((c) => c.id === asignaciones[r.id])
      return `• *${r.clienteNombre}* — 👥 ${r.personas} pax · 📞 +${r.clienteWhatsapp} · 🚗 ${choferR ? choferR.nombre : 'Sin chofer'}`
    }).join('\n')
    await sendWhatsApp(
      guiaAsignado.whatsapp,
      `Hola ${guiaAsignado.nombre} 👋\n\n🗺 *${excursion.nombre}*\n📅 ${fechaFmt}\n🕐 Salida: ${horario.partida} — Regreso: ${horario.regreso}\n\n*Pasajeros de la operación:*\n${lineasGuia}\n\n¡Muchas gracias!`
    )

    // Mensaje a cada CHOFER — sus pasajeros con hospedaje
    const porChofer = {}
    for (const r of conChofer) {
      const cid = asignaciones[r.id]
      if (!porChofer[cid]) porChofer[cid] = []
      porChofer[cid].push(r)
    }
    for (const [cid, sus] of Object.entries(porChofer)) {
      const chofer = choferes.find((c) => c.id === cid)
      if (!chofer) continue
      const lineas = sus.map((r) => `• *${r.clienteNombre}* — 👥 ${r.personas} pax · 🏨 ${r.hospedaje || 'Sin hospedaje'}`).join('\n')
      await sendWhatsApp(
        chofer.whatsapp,
        `Hola ${chofer.nombre} 👋\n\n🗺 *${excursion.nombre}*\n📅 ${fechaFmt}\n🕐 Salida: ${horario.partida}\n\n*Tus pasajeros:*\n${lineas}\n\n🧭 Guía: *${guiaAsignado.nombre}*\n\n¡Gracias!`
      )
    }

    // Mensaje a cada CLIENTE — confirmación personalizada del guía
    for (const r of pasajeros) {
      const choferR = choferes.find((c) => c.id === asignaciones[r.id])
      await sendWhatsApp(
        r.clienteWhatsapp,
        `${saludo}, soy *${guiaAsignado.nombre}* 👋\n\nEl chofer asignado para realizar su traslado es *${choferR ? choferR.nombre : 'por confirmar'}*, él lo estará buscando por la puerta de su hospedaje a las *${horario.partida}* del día de mañana para dirigirnos hacia *${excursion.nombre}*.\n\nYo los estaré esperando ahí para ingresar todos juntos.\n\nAnte cualquier duda o consulta podés escribirme directamente al 📱 *+${guiaAsignado.whatsapp}*`
      )
    }

    alert('✅ Mensajes enviados al guía, choferes y clientes.')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCerrar}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl dark:shadow-black/60 border border-transparent dark:border-zinc-800 w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-100 dark:border-zinc-800 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-zinc-100 text-base leading-snug">{excursion.nombre}</h2>
            <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5 capitalize">{formatFechaLarga(fecha)}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm font-semibold text-[#002147] dark:text-zinc-300">{paxReservados}/{excursion.cupos} personas</span>
              <div className="flex-1 bg-gray-100 dark:bg-zinc-800 rounded-full h-1.5 w-24">
                <div className={`h-1.5 rounded-full transition-all ${
                  paxReservados / excursion.cupos >= 0.8 ? 'bg-red-400' :
                  paxReservados / excursion.cupos >= 0.5 ? 'bg-yellow-400' : 'bg-green-400'
                }`} style={{ width: `${Math.min(100, (paxReservados / excursion.cupos) * 100)}%` }} />
              </div>
            </div>
          </div>
          <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 dark:text-zinc-500 text-lg flex-shrink-0 transition-colors">×</button>
        </div>

        {/* ── Sección guía ── */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30">
          <p className="text-xs font-semibold text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-2">Guía de la operación</p>
          <select
            value={guiaAsignaciones[opKey] || ''}
            onChange={(e) => onAsignarGuia(opKey, e.target.value)}
            className={`w-full text-sm rounded-xl px-3 py-2.5 border focus:outline-none transition-colors ${
              guiaAsignado
                ? 'border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 font-medium'
                : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 bg-white dark:bg-zinc-800'
            }`}
          >
            <option value="">🧭 Asignar guía para toda la operación...</option>
            {guias.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
          {guiaAsignado && (
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1.5">✓ {guiaAsignado.nombre} asignado como guía</p>
          )}
        </div>

        <div className="overflow-y-auto flex-1">
          {pasajeros.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-zinc-600">
              <p className="text-3xl mb-2">👤</p>
              <p className="text-sm">Sin pasajeros reservados</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-zinc-800">
              {pasajeros.map((r) => {
                const choferAsignado = choferes.find((c) => c.id === asignaciones[r.id])
                return (
                  <div key={r.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-zinc-100 text-sm">{r.clienteNombre}</p>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">📞 +{r.clienteWhatsapp}</p>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">🏨 {r.hospedaje || '—'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-semibold text-[#002147] dark:text-zinc-300">{r.personas} pax</p>
                        <p className="text-xs text-gray-400 dark:text-zinc-500">{formatPrecio(r.total)}</p>
                        <a href={`https://wa.me/${r.clienteWhatsapp}`} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:text-green-400 text-sm">💬</a>
                      </div>
                    </div>
                    <select
                      value={asignaciones[r.id] || ''}
                      onChange={(e) => onAsignar(r.id, e.target.value)}
                      className={`w-full text-sm rounded-xl px-3 py-2 border focus:outline-none transition-colors ${
                        choferAsignado
                          ? 'border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 font-medium'
                          : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-800'
                      }`}
                    >
                      <option value="">🚗 Asignar chofer...</option>
                      {choferes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                    {choferAsignado && (
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1.5">✓ {choferAsignado.nombre} asignado</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {pasajeros.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-3">
            <div className="text-sm text-gray-400 dark:text-zinc-500 space-y-0.5">
              <p>{conChofer.length}/{pasajeros.length} con chofer asignado</p>
              {!guiaAsignado && <p className="text-yellow-500 dark:text-yellow-400 text-xs">⚠ Falta asignar guía</p>}
            </div>
            <button onClick={cerrarOperacion} disabled={!listoParaCerrar}
              className={`flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors ${
                listoParaCerrar ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-600 cursor-not-allowed'
              }`}>
              🚀 Cerrar operación
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
