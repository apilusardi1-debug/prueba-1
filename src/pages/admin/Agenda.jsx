import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { choferesApi, guiasApi, reservasApi, excursionesApi, costosExcursionApi, operacionesApi, usuariosAdminApi, enviarPlantillaWhatsApp, leadsApi, clientesApi } from '../../lib/supabase.js'
import FichaPersona from '../../components/ficha/FichaPersona.jsx'
import { avisar } from '../../components/ui/Avisos.jsx'
import { MENSAJES_OPERACION, rellenarPlantilla } from '../../lib/mensajesDefault.js'
import { useSincronizado } from '../../lib/useSincronizado.js'
import { renderTemplate, TEMPLATE_BODIES, PLANTILLA_AVISO_EXCURSION } from '../../../supabase/functions/_shared/plantillasWhatsapp.ts'
import Ic, { IcGrande, IcTxt } from '../../components/admin/dashboard/Ic.jsx'
import { nombrePaseo, claveTexto } from '../../lib/reservasPlanilla.js'
import { horaDeReserva, tipoHorario } from '../../lib/horarios.js'
import { infoEstado, hoyReservas } from '../../lib/estadosReserva.js'
import OperacionesDelDia from '../../components/admin/OperacionesDelDia.jsx'

/* ── Helpers ──────────────────────────────────────────────────── */
const DIAS_CAL = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function formatPrecio(n) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
}

function calcularCostoOperativo(excursionId, pax, costosCatalogo, conChofer, conGuia) {
  const costosExc = costosCatalogo.filter(c => c.excursion_id === excursionId && c.activo !== false)
  let total = 0
  let moneda = 'BRL'
  const detalle = []
  for (const c of costosExc) {
    moneda = c.moneda || moneda
    if (c.tipo === 'chofer_tramos' || c.tipo === 'guia_tramos') {
      if (c.tipo === 'chofer_tramos' && !conChofer) continue
      if (c.tipo === 'guia_tramos' && !conGuia) continue
      const tramos = [...(c.tramos || [])].sort((a, b) => a.hasta - b.hasta)
      const tramo = tramos.find(t => pax <= t.hasta) || tramos[tramos.length - 1]
      if (tramo) {
        total += tramo.monto
        detalle.push({ concepto: c.concepto, monto: tramo.monto, nota: `hasta ${tramo.hasta} pax` })
      }
    } else {
      const monto = (c.monto_por_persona || 0) * pax
      total += monto
      detalle.push({ concepto: c.concepto, monto, nota: `${formatPrecio(c.monto_por_persona)} x ${pax}` })
    }
  }
  return { total, moneda, detalle }
}

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

// El aviso interno para guía y chofer va en portugués (así hablan entre ellos); el
// mensaje que le mandan al pasajero por su WhatsApp sigue en español, como el resto
// de lo que le llega al cliente.
function formatFechaLargaPt(fechaStr) {
  return new Date(fechaStr + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatoHora(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function hoyStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatFechaHora(isoStr) {
  if (!isoStr) return '—'
  return new Date(isoStr).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// `catalogo`: los paseos por id. La lectura de reservas no trae la hora de salida ni el archivo
// de opcionales del paseo; sin esto los avisos salían siempre con las 8:00 AM de fábrica.
function normalizarReserva(r, catalogo = {}) {
  const paseo = catalogo[r.excursion_id] || {}
  return {
    id: r.id,
    excursionId: r.excursion_id,
    excursionHoraSalida: paseo.hora_salida || null,
    excursionHoraRegreso: paseo.hora_regreso || null,
    // Horario del paseo (fijo / variable / catamarán) y la hora propia de esta reserva (2026-11-02)
    excursionHorarioTipo: paseo.horario_tipo || null,
    horaRecogida: r.hora_recogida || null,
    excursionOpcionalesImagen: paseo.opcionales_imagen || null,
    // Traslados y paseos fuera del catálogo no tienen excursion_id, solo el texto del
    // paseo: se agrupan por ese texto (grupoId) para que no queden todos juntos.
    grupoId: r.excursion_id || `paseo:${claveTexto(nombrePaseo(r))}`,
    excursionNombre: nombrePaseo(r),
    sinTraslado: !!r.sin_traslado,
    excursionCategoria: r.excursiones?.categoria || '',
    excursionCupos: r.excursiones?.cupos || 0,
    clienteNombre: r.cliente_nombre,
    clienteWhatsapp: r.cliente_whatsapp,
    leadId: r.lead_id || null,
    clienteId: r.cliente_id || null,
    hospedaje: r.hospedaje,
    personas: r.personas || 1,
    estado: r.estado || 'pendiente',
    fecha: r.fecha,
    creadaEn: r.created_at || null,
    total: r.total || 0,
    chofer_id: r.chofer_id || null,
    guia_id: r.guia_id || null,
  }
}

function buildSalidas(reservasNorm) {
  const map = {}
  for (const r of reservasNorm) {
    if (r.estado === 'cancelada') continue
    const key = `${r.grupoId}-${r.fecha}`
    if (!map[key]) {
      map[key] = {
        fecha: r.fecha,
        excursion: {
          id: r.grupoId, excursionId: r.excursionId, nombre: r.excursionNombre, cupos: r.excursionCupos, categoria: r.excursionCategoria,
          hora_salida: r.excursionHoraSalida, hora_regreso: r.excursionHoraRegreso, opcionales_imagen: r.excursionOpcionalesImagen,
          horario_tipo: r.excursionHorarioTipo,
        },
        reservas: [],
      }
    }
    map[key].reservas.push(r)
  }
  return Object.values(map)
}

function getExcursionTipo(reserva) {
  return reserva.excursionCategoria === 'paquetes' ? 'Paquete' : 'Paseo'
}

const TABS = [
  { key: 'todas',      label: 'Todas' },
  { key: 'pendiente',  label: 'Pendientes' },
  { key: 'confirmada', label: 'Confirmadas' },
  { key: 'cancelada',  label: 'Canceladas' },
]

// Los estados (textos, colores y el rojo de "Pendiente vencida") vienen de src/lib/estadosReserva.js,
// los mismos que usa la planilla de Reservas.

function getHorario(excursion) {
  return {
    partida: excursion?.hora_salida || '8:00 AM',
    regreso: excursion?.hora_regreso || '6:00 PM',
  }
}

// Horario de recogida (2026-11-02): cada reserva puede tener su hora (traslados, paseos variables);
// si no, vale la fija del paseo. Los traslados y paseos fuera del catálogo no tienen hora fija.
function paseoParaHorario(excursion) {
  return excursion?.excursionId ? { horario_tipo: excursion.horario_tipo, hora_salida: excursion.hora_salida } : null
}
function horaDePasajero(r, excursion) {
  return horaDeReserva({ hora_recogida: r.horaRecogida }, paseoParaHorario(excursion))
}
const esHorarioFijo = (excursion) => tipoHorario(paseoParaHorario(excursion)) === 'fijo'

// Aviso al cliente al cerrar la operación (2026-10-29): sale por el número del CRM con la
// plantilla aviso_excursion_cliente. Estos helpers arman sus datos.

// Hora en 24 hs: '8:00 AM' -> '08:00', '2:30 PM' -> '14:30'; si ya viene en 24 hs queda igual
function hora24(txt) {
  const m = String(txt || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!m) return ''
  let h = parseInt(m[1], 10)
  const ap = (m[3] || '').toUpperCase()
  if (ap === 'PM' && h < 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

// WhatsApp del guía como va en el mensaje: con + y código de país, así el cliente lo toca y le
// abre el chat con el guía. Devuelve '' si el número no sirve.
function telefonoInternacional(num) {
  const d = String(num || '').replace(/\D/g, '')
  if (d.length < 10) return ''
  if (d.startsWith('55') && d.length === 13) return `+55 ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`
  if (d.startsWith('55') && d.length === 12) return `+55 ${d.slice(2, 4)} ${d.slice(4, 8)}-${d.slice(8)}`
  return `+${d}`
}

// Meta no acepta saltos de línea ni espacios repetidos dentro de un dato de plantilla
const unaLinea = (txt) => String(txt || '').replace(/\s+/g, ' ').trim()

// Mañana en Brasil (YYYY-MM-DD): el aviso al cliente dice "mañana", así que solo sale ese día
function mananaBrasil() {
  const hoyBr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Recife' })
  const d = new Date(`${hoyBr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

// El error de una Edge Function trae el motivo en el cuerpo de la respuesta
async function textoError(error) {
  const detalle = await error?.context?.json?.().catch(() => null)
  return detalle?.error || error?.message || 'No se pudo enviar'
}

const SITIO = import.meta.env.VITE_SITIO_URL || 'https://prueba-1-rose.vercel.app'

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
  const [searchParams] = useSearchParams()
  const fechaParam = searchParams.get('fecha')
  // ?vista=en-curso abre directo "En curso" (las actividades de hoy, cerradas o no)
  const [vista, setVista] = useState(fechaParam ? 'calendario' : searchParams.get('vista') === 'en-curso' ? 'en_curso' : 'tabla')
  const [choferes, setChoferes] = useState([])
  const [guias, setGuias] = useState([])
  const [costos, setCostos] = useState([])
  const [reservasNorm, setReservasNorm] = useState([])
  const [cargando, setCargando] = useState(true)
  const [asignaciones, setAsignaciones] = useState({})
  const [guiaAsignaciones, setGuiaAsignaciones] = useState({})
  const [modal, setModal] = useState(null)

  useEffect(() => {
    Promise.all([
      choferesApi.getAll(),
      guiasApi.getAll(),
      reservasApi.getAll(),
      costosExcursionApi.getAll(),
      excursionesApi.getAll(),
    ]).then(([ch, gu, res, co, ex]) => {
      if (!ch.error) setChoferes((ch.data || []).filter((c) => c.activo))
      if (!gu.error) setGuias(gu.data || [])
      if (!co.error) setCostos(co.data || [])
      if (!res.error) {
        // Si el catálogo no se pudo leer, los avisos usan los valores de siempre
        const catalogo = Object.fromEntries((ex?.data || []).map((p) => [p.id, p]))
        const norm = (res.data || []).map((r) => normalizarReserva(r, catalogo))
        setReservasNorm(norm)
        const initAsig = {}
        const initGuia = {}
        for (const r of norm) {
          if (r.chofer_id) initAsig[r.id] = r.chofer_id
          if (r.guia_id) {
            const key = `${r.grupoId}-${r.fecha}`
            if (!initGuia[key]) initGuia[key] = r.guia_id
          }
        }
        setAsignaciones(initAsig)
        setGuiaAsignaciones(initGuia)
      }
      setCargando(false)
    })
  }, [])

  async function handleEliminarReserva(id) {
    await reservasApi.delete(id)
    setReservasNorm(prev => prev.filter(r => r.id !== id))
  }

  async function recalcularCosto(reservaId, cambios) {
    const reserva = reservasNorm.find((r) => r.id === reservaId)
    if (!reserva) return
    const choferId = 'chofer_id' in cambios ? cambios.chofer_id : reserva.chofer_id
    const guiaId = 'guia_id' in cambios ? cambios.guia_id : reserva.guia_id
    const { total, moneda, detalle } = calcularCostoOperativo(reserva.excursionId, reserva.personas || 1, costos, !!choferId, !!guiaId)
    await reservasApi.updateCostoOperativo(reservaId, { costo_operativo: total, costo_operativo_moneda: moneda, costo_operativo_detalle: detalle })
  }

  async function handleAsignar(reservaId, choferId) {
    setAsignaciones((p) => ({ ...p, [reservaId]: choferId }))
    await reservasApi.updateAsignacion(reservaId, { chofer_id: choferId || null })
    await recalcularCosto(reservaId, { chofer_id: choferId || null })
  }

  async function handleAsignarGuia(opKey, guiaId) {
    setGuiaAsignaciones((p) => ({ ...p, [opKey]: guiaId }))
    const reservasDeOp = reservasNorm.filter((r) => `${r.grupoId}-${r.fecha}` === opKey)
    await Promise.all(reservasDeOp.map((r) => reservasApi.updateAsignacion(r.id, { guia_id: guiaId || null })))
    await Promise.all(reservasDeOp.map((r) => recalcularCosto(r.id, { guia_id: guiaId || null })))
  }

  // Una vez que pasa la fecha de la excursión, la reserva deja de aparecer
  // en la Agenda (tabla y calendario) — el historial queda en el perfil
  // del cliente, la Agenda es solo para lo que todavía viene.
  const hoy = hoyStr()
  const reservasVigentes = reservasNorm.filter((r) => !r.fecha || r.fecha >= hoy)

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Agenda</h1>
          <p className="text-gray-400 dark:text-zinc-500 text-sm mt-0.5">Reservas y salidas · DreamTours</p>
        </div>
        <div className="flex items-center gap-3">
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
            <button
              onClick={() => setVista('en_curso')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold uppercase tracking-wide transition-colors ${
                vista === 'en_curso'
                  ? 'bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 shadow-sm'
                  : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'
              }`}
            >
              <Ic n="car" className="h-4 w-4" /> En curso
            </button>
          </div>

          {vista === 'tabla' && (
            <button className="flex items-center gap-2 text-sm font-semibold text-white bg-brand-600 dark:bg-zinc-100 dark:text-zinc-900 rounded-xl px-4 py-2 hover:bg-brand-700 dark:hover:bg-zinc-200 transition-colors shadow-sm">
              <span className="text-base leading-none">+</span>
              Nueva Reserva
            </button>
          )}
        </div>
      </div>

      {vista === 'en_curso' ? (
        <OperacionesDelDia />
      ) : vista === 'tabla' ? (
        <VistaTabla reservasNorm={reservasVigentes} cargando={cargando} />
      ) : (
        <VistaCalendario
          reservasNorm={reservasVigentes}
          choferes={choferes}
          guias={guias}
          asignaciones={asignaciones}
          guiaAsignaciones={guiaAsignaciones}
          onAsignar={handleAsignar}
          onAsignarGuia={handleAsignarGuia}
          modal={modal}
          setModal={setModal}
          fechaInicial={fechaParam}
          onEliminarReserva={handleEliminarReserva}
        />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   VISTA TABLA
══════════════════════════════════════════════════════════════════ */
function VistaTabla({ reservasNorm, cargando }) {
  const hoyEstados = hoyReservas()
  const [tabActiva, setTabActiva] = useState('todas')
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [accionesAbierta, setAccionesAbierta] = useState(null)
  const [ordenPor, setOrdenPor] = useState('fecha') // 'fecha' (de la excursión) | 'creadaEn' (orden de emisión)
  const [ordenDir, setOrdenDir] = useState('asc')
  const [filtroExcursion, setFiltroExcursion] = useState('')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')

  function ordenarPor(campo) {
    if (ordenPor === campo) setOrdenDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setOrdenPor(campo); setOrdenDir('asc') }
  }

  const excursionesUnicas = [...new Map(reservasNorm.map((r) => [r.grupoId, r.excursionNombre])).entries()]
    .filter(([id]) => id)
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
  const hayFiltrosExtra = filtroExcursion || filtroFechaDesde || filtroFechaHasta

  const filasFiltradas = reservasNorm.filter((r) => {
    if (tabActiva !== 'todas' && r.estado !== tabActiva) return false
    if (filtroExcursion && r.grupoId !== filtroExcursion) return false
    if (filtroFechaDesde && (!r.fecha || r.fecha < filtroFechaDesde)) return false
    if (filtroFechaHasta && (!r.fecha || r.fecha > filtroFechaHasta)) return false
    return true
  })
  const factor = ordenDir === 'asc' ? 1 : -1
  const filas = [...filasFiltradas].sort((a, b) => {
    const av = a[ordenPor] || ''
    const bv = b[ordenPor] || ''
    if (av < bv) return -1 * factor
    if (av > bv) return 1 * factor
    return 0
  })
  const conteos = {
    todas:      reservasNorm.length,
    pendiente:  reservasNorm.filter((r) => r.estado === 'pendiente').length,
    confirmada: reservasNorm.filter((r) => r.estado === 'confirmada').length,
    cancelada:  reservasNorm.filter((r) => r.estado === 'cancelada').length,
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

      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
        <select
          value={filtroExcursion}
          onChange={(e) => setFiltroExcursion(e.target.value)}
          className="border border-gray-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 rounded-full pl-4 pr-3 py-1.5 text-sm text-gray-600 dark:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          <option value="">Todos los paseos</option>
          {excursionesUnicas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>

        <input
          type="date"
          value={filtroFechaDesde}
          onChange={(e) => setFiltroFechaDesde(e.target.value)}
          className="border border-gray-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 rounded-full pl-4 pr-3 py-1.5 text-sm text-gray-600 dark:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <span className="text-gray-300 dark:text-zinc-600 text-sm">–</span>
        <input
          type="date"
          value={filtroFechaHasta}
          onChange={(e) => setFiltroFechaHasta(e.target.value)}
          className="border border-gray-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 rounded-full pl-4 pr-3 py-1.5 text-sm text-gray-600 dark:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
        />

        {hayFiltrosExtra && (
          <button
            onClick={() => { setFiltroExcursion(''); setFiltroFechaDesde(''); setFiltroFechaHasta('') }}
            className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 underline"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-zinc-800/60 border-b border-gray-100 dark:border-zinc-800">
              <th className="w-10 pl-4 py-3"><span className="text-gray-300 dark:text-zinc-700 text-base select-none">⋮⋮</span></th>
              <th className="w-10 py-3">
                <input type="checkbox" checked={todosSeleccionados} onChange={toggleTodos}
                  className="w-4 h-4 rounded border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 cursor-pointer" />
              </th>
              {['Paseo','Tipo','Estado','Pasajeros'].map((h) => (
                <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-gray-400 dark:text-zinc-600 uppercase tracking-wider">{h}</th>
              ))}
              <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 dark:text-zinc-600 uppercase tracking-wider">
                <button onClick={() => ordenarPor('fecha')} className="flex items-center gap-1 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">
                  Fecha del paseo
                  {ordenPor === 'fecha' && <span className="text-[9px]">{ordenDir === 'asc' ? '▲' : '▼'}</span>}
                </button>
              </th>
              <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 dark:text-zinc-600 uppercase tracking-wider">
                <button onClick={() => ordenarPor('creadaEn')} className="flex items-center gap-1 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">
                  Reservado el
                  {ordenPor === 'creadaEn' && <span className="text-[9px]">{ordenDir === 'asc' ? '▲' : '▼'}</span>}
                </button>
              </th>
              <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 dark:text-zinc-600 uppercase tracking-wider">Hospedaje</th>
              <th className="w-12 py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={10} className="py-16 text-center text-gray-400 dark:text-zinc-600 text-sm">Cargando reservas...</td></tr>
            ) : filas.length === 0 ? (
              <tr><td colSpan={10} className="py-16 text-center text-gray-400 dark:text-zinc-600">
                <IcGrande n="file" />
                <p className="text-sm">No hay reservas en esta categoría</p>
              </td></tr>
            ) : filas.map((reserva, idx) => {
              const status = infoEstado(reserva, hoyEstados)
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
                    {reserva.sinTraslado && <span className="inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Sin traslado</span>}
                    <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{reserva.clienteNombre}</p>
                  </td>
                  <td className="py-3.5 px-4 text-gray-600 dark:text-zinc-400">{getExcursionTipo(reserva)}</td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text} ${status.darkBg} ${status.darkText}`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.dot}`} />
                      {status.label}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-gray-700 dark:text-zinc-300 font-medium">{reserva.personas} pax</td>
                  <td className="py-3.5 px-4 text-gray-600 dark:text-zinc-400 capitalize">{formatFechaCorta(reserva.fecha)}</td>
                  <td className="py-3.5 px-4 text-gray-600 dark:text-zinc-400 whitespace-nowrap">{formatFechaHora(reserva.creadaEn)}</td>
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
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between">
        <p className="text-xs text-gray-400 dark:text-zinc-600">
          {seleccionados.size > 0 ? `${seleccionados.size} seleccionada${seleccionados.size > 1 ? 's' : ''}` : `${filas.length} reservas`}
        </p>
        <p className="text-xs text-gray-400 dark:text-zinc-600">DreamTours · {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   VISTA CALENDARIO
══════════════════════════════════════════════════════════════════ */
function VistaCalendario({ reservasNorm, choferes, guias, asignaciones, guiaAsignaciones, onAsignar, onAsignarGuia, modal, setModal, fechaInicial, onEliminarReserva }) {
  const todasLasSalidas = buildSalidas(reservasNorm)
  const [eliminandoId, setEliminandoId] = useState(null)
  const hoy = new Date()
  const todayStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`

  const [mes, setMes] = useState(() => {
    if (fechaInicial) {
      const [y, m] = fechaInicial.split('-').map(Number)
      return new Date(y, m - 1, 1)
    }
    return new Date()
  })
  const [diaSeleccionado, setDiaSeleccionado] = useState(fechaInicial || todayStr)

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
  const [sy, sm] = diaSeleccionado.split('-').map(Number)
  const fechaLegible = new Date(sy, sm - 1, Number(diaSeleccionado.split('-')[2])).toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-6">

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

        <div className="px-2 pb-4">
          {semanas.map((semana, si) => (
            <div key={si} className="grid grid-cols-7 border-b border-gray-50 dark:border-zinc-800/50 last:border-0">
              {semana.map(({ dia, mesOffset }, di) => {
                const fechaStr = toFechaStr(dia, mesOffset)
                const esHoy = fechaStr === todayStr
                const seleccionado = fechaStr === diaSeleccionado
                const esNueva = fechaStr === fechaInicial
                const salidas = esMesActual => esMesActual ? (salidasPorFecha[fechaStr] || []) : []
                const esMesActual = mesOffset === 0
                const salidasDia = salidas(esMesActual)

                const CHIP_COLORS = [
                  'bg-brand-600 text-white',
                  'bg-blue-500 text-white',
                  'bg-indigo-500 text-white',
                  'bg-blue-700 text-white',
                ]

                return (
                  <button key={di} onClick={() => setDiaSeleccionado(fechaStr)}
                    className="flex flex-col items-start pt-2 pb-2.5 px-1 gap-1.5 min-h-[104px] group border-r border-gray-50 dark:border-zinc-800/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                    <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium transition-all mx-auto ${
                      esHoy
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold'
                        : seleccionado
                        ? 'bg-brand-600 text-white font-semibold'
                        : esNueva
                        ? 'ring-2 ring-brand-500 text-brand-600 font-semibold'
                        : esMesActual
                        ? 'text-gray-700 dark:text-zinc-300'
                        : 'text-gray-300 dark:text-zinc-700'
                    }`}>{dia}</span>
                    <div className="w-full flex flex-col gap-1 px-0.5">
                      {salidasDia.slice(0, 3).map((s, i) => (
                        <span key={i} className={`w-full px-1.5 py-1 rounded text-[10.5px] font-semibold truncate leading-tight ${CHIP_COLORS[i % CHIP_COLORS.length]}`}>
                          {s.excursion.nombre}
                        </span>
                      ))}
                      {salidasDia.length > 3 && (
                        <span className="text-[10px] text-gray-400 dark:text-zinc-600 pl-1">+{salidasDia.length - 3} más</span>
                      )}
                    </div>
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
              const horario = getHorario(salida.excursion)
              const paxTotal = salida.reservas.reduce((a, r) => a + r.personas, 0)
              return (
                <div key={`${salida.excursion.id}-${salida.fecha}`} className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm dark:shadow-black/20 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-50 dark:border-zinc-800 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-zinc-100 text-sm">{salida.excursion.nombre}</h4>
                      <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5"><IcTxt n="clock" />{esHorarioFijo(salida.excursion) ? `${horario.partida} — Regreso estimado ${horario.regreso}` : 'Horario según cada reserva'}</p>
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
                          <div className="flex-1 min-w-0 max-w-[45%]">
                            <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate">{r.clienteNombre}</p>
                            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5 truncate">
                              {horaDePasajero(r, salida.excursion) || <span className="font-medium text-amber-600 dark:text-amber-400">Sin horario</span>}
                              {esHorarioFijo(salida.excursion) ? ` · Regreso ${horario.regreso}` : ''} · {r.personas} pax
                            </p>
                          </div>
                          <p className="text-xs text-gray-400 dark:text-zinc-600 flex-shrink-0 hidden sm:block">{r.hospedaje || '—'}</p>
                          <a href={`https://wa.me/${r.clienteWhatsapp}`} target="_blank" rel="noopener noreferrer"
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-green-50 dark:hover:bg-green-950/30 text-green-500 transition-colors flex-shrink-0">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.532 5.85L.073 23.927l6.236-1.434A11.938 11.938 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.65-.491-5.18-1.349l-.37-.217-3.7.851.875-3.614-.24-.382A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                            </svg>
                          </a>
                          {eliminandoId === r.id ? (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-xs text-gray-400">¿Eliminar?</span>
                              <button onClick={() => { onEliminarReserva(r.id); setEliminandoId(null) }} className="text-xs font-semibold text-red-500 hover:text-red-700">Sí</button>
                              <button onClick={() => setEliminandoId(null)} className="text-xs text-gray-400 hover:text-gray-600">No</button>
                            </div>
                          ) : (
                            <button onClick={() => setEliminandoId(r.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0" title="Eliminar reserva">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
                            </button>
                          )}
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
  // Solo los paseos del catálogo se cierran como operación (la operación guarda el paseo)
  const listoParaCerrar = !!excursion.excursionId && guiaAsignaciones[opKey] && conChofer.length > 0
  const [enviando, setEnviando] = useState(false)
  const [resultados, setResultados] = useState(null)
  const [previewAbierto, setPreviewAbierto] = useState(null) // id del pasajero cuya vista previa está abierta
  const [ficha, setFicha] = useState(null) // { lead } | { cliente }: la ficha del pasajero abierta encima de este modal

  // El nombre del pasajero abre su ficha (igual que en Reservas): por el lead o cliente al que ya está
  // unida la reserva y, si no está unida, por su teléfono (con o sin el 9 después del DDD).
  async function abrirFicha(r) {
    if (r.leadId) {
      const { data } = await leadsApi.getById(r.leadId)
      if (data) return setFicha({ lead: data })
    }
    if (r.clienteId) {
      const { data } = await clientesApi.getById(r.clienteId)
      if (data) return setFicha({ cliente: data })
    }
    const digitos = String(r.clienteWhatsapp || '').replace(/[^0-9]/g, '')
    const variantes = !digitos ? [] : digitos.startsWith('55') && digitos.length === 12 ? [digitos, digitos.slice(0, 4) + '9' + digitos.slice(4)]
      : digitos.startsWith('55') && digitos.length === 13 && digitos[4] === '9' ? [digitos, digitos.slice(0, 4) + digitos.slice(5)] : [digitos]
    for (const v of variantes) {
      const { data: lead } = (await leadsApi.getByWhatsapp(v)) || {}
      if (lead) return setFicha({ lead })
      const { data: cliente } = (await clientesApi.getByWhatsapp(v)) || {}
      if (cliente) return setFicha({ cliente })
    }
    avisar('Este pasajero todavía no tiene ficha: no hay un lead ni un cliente con ese teléfono.')
  }

  // Datos de la plantilla aviso_excursion_cliente de un pasajero, y qué falta para poder mandarla.
  // Los mismos que usa cerrarOperacion, así la vista previa y el envío no se desincronizan.
  function datosAvisoCliente(r) {
    const choferR = choferes.find((c) => c.id === asignaciones[r.id])
    const hora = horaDePasajero(r, excursion)
    const telGuia = telefonoInternacional(guiaAsignado?.whatsapp)
    const faltan = []
    if (!choferR) faltan.push('chofer')
    if (!guiaAsignado) faltan.push('guía')
    else if (!telGuia) faltan.push('WhatsApp del guía con código de país')
    if (!hora) faltan.push('hora de recogida')
    if (!unaLinea(r.hospedaje)) faltan.push('hospedaje')
    if (!r.clienteWhatsapp) faltan.push('WhatsApp del cliente')
    // Sin archivo de opcionales, el link lleva a la página del paseo en la web
    const link = excursion.opcionales_imagen || (excursion.excursionId ? `${SITIO}/excursiones/${excursion.excursionId}` : SITIO)
    const params = [
      unaLinea(r.clienteNombre).split(' ')[0], excursion.nombre, choferR?.nombre, hora, r.hospedaje, guiaAsignado?.nombre, link, telGuia,
    ].map(unaLinea)
    return { params, faltan }
  }

  // El mismo texto que le llega al cliente por WhatsApp. Avisa si todavía no se podría mandar.
  function mensajeClientePreview(r) {
    const { params, faltan } = datosAvisoCliente(r)
    const avisos = []
    if (fecha !== mananaBrasil()) avisos.push('Ojo: este aviso dice "mañana", así que solo se manda si el paseo es mañana.')
    if (faltan.length) avisos.push(`Falta para poder mandarlo: ${faltan.join(', ')}.`)
    const texto = renderTemplate('aviso_excursion_cliente', params.map((p) => p || '___'))
    return avisos.length ? `${avisos.join('\n')}\n\n${texto}` : texto
  }

  // Mensaje al CLIENTE por el número del CRM (plantilla aviso_excursion_cliente): queda en su chat asignado
  // a quien lleva Paseos. Solo sale el día antes del paseo y con todos los datos; si no, no se manda y
  // se dice qué falta. Devuelve un resultado por pasajero (lo usan el cierre y el reenvío).
  async function enviarAvisosClientes(lista) {
    const manana = mananaBrasil()
    const out = []
    for (const r of lista) {
      const destino = `Cliente (${r.clienteNombre})`
      const phone = r.clienteWhatsapp || '—'
      if (fecha !== manana) {
        out.push({ destino, phone, reservaId: r.id, ok: false, error: 'No se mandó: el aviso dice "mañana" y este paseo no es mañana' })
        continue
      }
      const { params, faltan } = datosAvisoCliente(r)
      if (faltan.length) {
        out.push({ destino, phone, reservaId: r.id, ok: false, error: `No se mandó: falta ${faltan.join(', ')}` })
        continue
      }
      const { error } = await enviarPlantillaWhatsApp({
        phone: r.clienteWhatsapp,
        nombre: r.clienteNombre,
        plantilla: { ...PLANTILLA_AVISO_EXCURSION, texto: TEMPLATE_BODIES.aviso_excursion_cliente, params },
        avisoOperacion: true,
      })
      out.push({ destino, phone, reservaId: r.id, ok: !error, error: error ? await textoError(error) : null })
    }
    return out
  }

  // Reintenta solo con los clientes cuyo mensaje no salió en este cierre; no toca al guía ni a los choferes.
  // Lee los datos actuales: sirve para después de completar la hora, el hospedaje o el teléfono que faltaba.
  const [reenviando, setReenviando] = useState(false)
  async function reenviarClientesFallidos() {
    const ids = new Set((resultados || []).filter((x) => !x.interno && !x.ok && x.reservaId).map((x) => x.reservaId))
    if (!operacionCerrada || reenviando || ids.size === 0) return
    setReenviando(true)
    try {
      const nuevos = await enviarAvisosClientes(pasajeros.filter((r) => ids.has(r.id)))
      setResultados((prev) => (prev || []).map((x) => nuevos.find((n) => n.reservaId === x.reservaId) || x))
    } catch (err) {
      avisar('No se pudo reenviar: ' + (err?.message || 'intentá de nuevo'))
    }
    setReenviando(false)
  }

  async function cerrarOperacion() {
    // Una operación cerrada no se vuelve a cerrar: reenviaría los avisos a todos
    if (operacionCerrada || !listoParaCerrar || !guiaAsignado) return
    setEnviando(true)
    setResultados(null)
    const logs = []

    try {
      const fechaFmt = formatFechaLarga(fecha)
      const fechaFmtPt = formatFechaLargaPt(fecha)
      const fechaCorta = formatFechaCorta(fecha)
      const horario = getHorario(excursion)

      // Textos de los avisos internos, editables desde Mensajes. Si no se pueden leer, se usan los de siempre.
      const { plantillas: guardadas } = (await usuariosAdminApi.plantillas()) || {}
      const plantillaDe = (clave) => guardadas?.find((p) => p.clave === clave)?.texto || MENSAJES_OPERACION[clave].texto

      // El mensaje que el guía o el chofer le manda AL PASAJERO por su propio WhatsApp
      // (no por la API de Meta: no tiene costo). Va en español, como el resto de lo
      // que recibe el cliente; queda pre-escrito, ellos lo revisan antes de mandarlo.
      function mensajeParaPasajero(r) {
        const hora = horaDePasajero(r, excursion)
        const cuando = hora ? `a las ${hora}` : '(te confirmo el horario por acá)'
        return `Hola ${r.clienteNombre}! Te escribo de DreamTours por la excursión a ${excursion.nombre} el ${fechaCorta}. Paso a buscarte por ${r.hospedaje || 'tu hospedaje'} ${cuando}. ¿Me pasás la ubicación del hospedaje? Cualquier consulta escribime por acá. ¡Gracias!`
      }
      function datosPasajero(r) {
        return { nombre: r.clienteNombre, personas: r.personas, hospedaje: r.hospedaje || null, whatsapp: r.clienteWhatsapp, mensajeWa: mensajeParaPasajero(r) }
      }

      // Bloque de un pasajero en el aviso INTERNO (portugués, como ya habla el equipo
      // entre sí): completo para el guía (con chofer y saldo), simple para el chofer
      function bloquePasajeroGuia(r) {
        const choferR = choferes.find((c) => c.id === asignaciones[r.id])
        const saldo = Math.max((r.total || 0) - (r.pagado || 0), 0)
        return [
          `*${r.clienteNombre}* — 👥 ${r.personas} pessoas`,
          `🕒 Horário: ${horaDePasajero(r, excursion) || 'a confirmar'}`,
          `🏨 ${r.hospedaje || 'Sem hospedagem'}`,
          `📞 Contato: +${r.clienteWhatsapp}`,
          `🚗 Motorista: ${choferR ? choferR.nombre : 'Sem motorista'}${choferR?.whatsapp ? ` · 📞 +${choferR.whatsapp}` : ''}`,
          `💰 Saldo a pagar: ${formatPrecio(saldo)}`,
        ].join('\n')
      }
      function bloquePasajeroChofer(r) {
        return [
          `*${r.clienteNombre}* — 👥 ${r.personas} pessoas`,
          `🕒 Horário: ${horaDePasajero(r, excursion) || 'a confirmar'}`,
          `🏨 ${r.hospedaje || 'Sem hospedagem'}`,
          `📞 Contato: +${r.clienteWhatsapp}`,
        ].join('\n')
      }

      // En un paseo de horario fijo, "salida" es esa hora. Si es variable, cada pasajero trae la suya.
      const salidaTexto = esHorarioFijo(excursion) ? horario.partida : 'conforme cada passageiro (veja abaixo)'
      const voltaTexto = esHorarioFijo(excursion) ? horario.regreso : 'a confirmar'

      // Aviso interno al GUÍA: antes salía por WhatsApp (aviso_guia), ahora queda en
      // su link personal (chat interno) — el costo por mensaje de Meta era el motivo
      const mensajeGuia = rellenarPlantilla(plantillaDe('operacion_guia'), {
        excursion: excursion.nombre, fecha: fechaFmtPt, salida: salidaTexto, volta: voltaTexto,
        pasajeros: pasajeros.map(bloquePasajeroGuia).join('\n\n'),
      })
      const avisos = [{ destinatario: 'guia', guia_id: guiaAsignado.id, mensaje: mensajeGuia, pasajeros: pasajeros.map(datosPasajero) }]

      // Aviso interno a cada CHOFER, solo con sus pasajeros (antes aviso_chofer)
      const porChofer = {}
      for (const r of conChofer) {
        const cid = asignaciones[r.id]
        if (!porChofer[cid]) porChofer[cid] = []
        porChofer[cid].push(r)
      }
      for (const [cid, sus] of Object.entries(porChofer)) {
        const chofer = choferes.find((c) => c.id === cid)
        if (!chofer) continue
        const mensajeChofer = rellenarPlantilla(plantillaDe('operacion_chofer'), {
          excursion: excursion.nombre, fecha: fechaFmtPt, salida: salidaTexto,
          pasajeros: sus.map(bloquePasajeroChofer).join('\n\n'),
          guia: guiaAsignado.nombre, guia_whatsapp: guiaAsignado.whatsapp,
        })
        avisos.push({ destinatario: 'chofer', chofer_id: cid, mensaje: mensajeChofer, pasajeros: sus.map(datosPasajero) })
      }

      const cerradaPor = JSON.parse(localStorage.getItem('admin_session') || '{}').nombre || null
      const { error: errorAvisos } = await operacionesApi.cerrar({ excursionId: excursion.excursionId, fecha, guiaId: guiaAsignado.id, cerradaPor, avisos })
      if (errorAvisos) {
        logs.push({ destino: `Guía y choferes (${avisos.length} avisos)`, interno: true, ok: false, error: errorAvisos.message || 'No se pudieron guardar los avisos internos' })
      } else {
        logs.push({ destino: `Guía (${guiaAsignado.nombre})`, interno: true, ok: true, error: null })
        for (const cid of Object.keys(porChofer)) {
          const chofer = choferes.find((c) => c.id === cid)
          if (chofer) logs.push({ destino: `Chofer (${chofer.nombre})`, interno: true, ok: true, error: null })
        }
      }

      // Mensaje al CLIENTE: por el número del CRM (plantilla aviso_excursion_cliente), queda en su chat
      // asignado a quien lleva Paseos. Solo sale el día antes del paseo y con todos los datos: si no,
      // no se manda y se avisa qué falta (los avisos de guía y chofer ya quedaron guardados).
      logs.push(...await enviarAvisosClientes(pasajeros))
    } catch (err) {
      logs.push({ destino: 'Error inesperado', phone: '—', ok: false, error: err.message })
    }

    setEnviando(false)
    setResultados(logs)
    cargarEstadoAvisos()
  }

  // Quién de guía/choferes ya abrió su link (leído) y quién tocó "Recebido"
  // (confirmado). Se lee al abrir el modal (por si esta operación ya se había
  // cerrado antes) y se actualiza sola mientras el modal está abierto.
  const [estadoAvisos, setEstadoAvisos] = useState(null)
  const cargarEstadoAvisos = useCallback(async () => {
    if (!excursion.excursionId) { setEstadoAvisos([]); return }
    const { data } = await operacionesApi.getAvisos(excursion.excursionId, fecha)
    setEstadoAvisos(data?.operaciones_avisos || [])
  }, [excursion.excursionId, fecha])
  useEffect(() => { cargarEstadoAvisos() }, [cargarEstadoAvisos])
  useSincronizado(cargarEstadoAvisos, ['operaciones_avisos'])
  // Cerrada = ya hay avisos guardados para este paseo y fecha (se cerró ahora o antes)
  const operacionCerrada = estadoAvisos?.length > 0 || !!resultados?.some((r) => r.interno && r.ok)
  const resumenPor = (pred) => { const l = (resultados || []).filter(pred); return { total: l.length, ok: l.filter((x) => x.ok).length } }

  function nombreDestinatario(a) {
    if (a.destinatario === 'guia') return guias.find((g) => g.id === a.guia_id)?.nombre || 'Guía'
    return choferes.find((c) => c.id === a.chofer_id)?.nombre || 'Chofer'
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl dark:shadow-black/60 border border-transparent dark:border-zinc-800 w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-100 dark:border-zinc-800 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-zinc-100 text-base leading-snug">{excursion.nombre}</h2>
            <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5 capitalize">{formatFechaLarga(fecha)}</p>
            {excursion.cupos > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm font-semibold text-brand-600 dark:text-zinc-300">{paxReservados}/{excursion.cupos} personas</span>
                <div className="flex-1 bg-gray-100 dark:bg-zinc-800 rounded-full h-1.5 w-24">
                  <div className={`h-1.5 rounded-full transition-all ${
                    paxReservados / excursion.cupos >= 0.8 ? 'bg-red-400' :
                    paxReservados / excursion.cupos >= 0.5 ? 'bg-yellow-400' : 'bg-green-400'
                  }`} style={{ width: `${Math.min(100, (paxReservados / excursion.cupos) * 100)}%` }} />
                </div>
              </div>
            )}
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
            <option value="">Asignar guía para toda la operación...</option>
            {guias.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
          {guiaAsignado && (
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1.5">✓ {guiaAsignado.nombre} asignado como guía</p>
          )}
        </div>

        <div className="overflow-y-auto flex-1">
          {pasajeros.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-zinc-600">
              <IcGrande n="user" />
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
                        <button type="button" onClick={() => abrirFicha(r)} title="Abrir la ficha del cliente"
                          className="text-left font-semibold text-gray-900 dark:text-zinc-100 text-sm hover:underline">{r.clienteNombre}</button>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5"><IcTxt n="phone" />+{r.clienteWhatsapp}</p>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5"><IcTxt n="hotel" />{r.sinTraslado ? 'Sin traslado' : (r.hospedaje || '—')}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-semibold text-brand-600 dark:text-zinc-300">{r.personas} pax</p>
                        <p className="text-xs text-gray-400 dark:text-zinc-500">{formatPrecio(r.total)}</p>
                        <a href={`https://wa.me/${r.clienteWhatsapp}`} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:text-green-400 text-sm"><Ic n="chat" className="h-4 w-4" /></a>
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
                      <option value="">Asignar chofer...</option>
                      {choferes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                    {choferAsignado && (
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1.5">✓ {choferAsignado.nombre} asignado</p>
                    )}
                    <button
                      type="button"
                      onClick={() => setPreviewAbierto((id) => (id === r.id ? null : r.id))}
                      className="mt-2 text-xs font-medium text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300"
                    >
                      {previewAbierto === r.id ? 'Ocultar' : 'Ver'} mensaje al cliente
                    </button>
                    {previewAbierto === r.id && (
                      <div className="mt-2 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700 p-3">
                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-700 dark:text-zinc-300">{mensajeClientePreview(r)}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {!resultados && operacionCerrada && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800">
            <p className="text-xs font-semibold text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-1">Operación cerrada</p>
            <p className="text-xs text-gray-500 dark:text-zinc-400">Los avisos al guía y a los choferes ya se enviaron (su estado está más abajo). El resultado de los mensajes a los clientes se muestra solo en el momento del cierre.</p>
          </div>
        )}

        {resultados && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800 space-y-2 max-h-56 overflow-y-auto">
            <p className="text-xs font-semibold text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-1">Resumen del cierre</p>
            <div className="grid grid-cols-3 gap-2 pb-1">
              {[
                ['Guía', resumenPor((r) => r.destino.startsWith('Guía'))],
                ['Choferes', resumenPor((r) => r.destino.startsWith('Chofer'))],
                ['Clientes', resumenPor((r) => r.destino.startsWith('Cliente'))],
              ].map(([nombre, s]) => (
                <div key={nombre} className={`rounded-lg px-2 py-1.5 text-center text-xs font-semibold ${
                  s.total > 0 && s.ok === s.total ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                }`}>{nombre}: {s.ok}/{s.total} enviados</div>
              ))}
            </div>
            {resultados.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={r.ok ? 'text-green-500' : 'text-red-500'}><Ic n={r.ok ? 'checkcircle' : 'xcircle'} className="h-4 w-4" /></span>
                <div>
                  <span className="font-medium text-gray-800 dark:text-zinc-200">{r.destino}</span>
                  <span className="text-gray-400 dark:text-zinc-500 ml-1">{r.interno ? (r.ok ? '(listo en su chat interno)' : '') : `(${r.phone})`}</span>
                  {!r.ok && <p className="text-red-500 dark:text-red-400 mt-0.5 break-all">{r.error}</p>}
                </div>
              </div>
            ))}
            {resultados.some((x) => !x.interno && !x.ok && x.reservaId) && operacionCerrada && (
              <button type="button" onClick={reenviarClientesFallidos} disabled={reenviando}
                className="mt-1 w-full rounded-lg border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-semibold py-2 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50">
                {reenviando ? 'Reenviando...' : 'Reenviar solo a los clientes que fallaron'}
              </button>
            )}
          </div>
        )}

        {/* Chat interno con guía y choferes: quién ya abrió su link y quién tocó
            "Recebido". Se ve apenas se cierra la operación, o si ya se había cerrado
            antes (esta pantalla se puede reabrir solo para consultar el estado). */}
        {estadoAvisos?.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800 space-y-2 max-h-48 overflow-y-auto">
            <p className="text-xs font-semibold text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-1">Chat interno (guía y choferes)</p>
            {estadoAvisos.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-gray-800 dark:text-zinc-200">
                  {a.destinatario === 'guia' ? 'Guía' : 'Chofer'} · {nombreDestinatario(a)}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  a.confirmado_at ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400'
                    : a.leido_at ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500'
                }`}>
                  {a.confirmado_at ? `Recebido às ${formatoHora(a.confirmado_at)}` : a.leido_at ? 'Leído' : 'Sin abrir'}
                </span>
              </div>
            ))}
          </div>
        )}

        {pasajeros.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-3">
            <div className="text-sm text-gray-400 dark:text-zinc-500 space-y-0.5">
              <p>{conChofer.length}/{pasajeros.length} con chofer asignado</p>
              {!guiaAsignado && <p className="text-yellow-500 dark:text-yellow-400 text-xs"><IcTxt n="alert" />Falta asignar guía</p>}
              {guiaAsignado && !guiaAsignado.whatsapp && <p className="text-red-500 dark:text-red-400 text-xs"><IcTxt n="alert" />Guía sin número de WhatsApp</p>}
              {conChofer.some((r) => { const c = choferes.find((ch) => ch.id === asignaciones[r.id]); return c && !c.whatsapp }) && (
                <p className="text-orange-500 dark:text-orange-400 text-xs"><IcTxt n="alert" />Hay choferes sin WhatsApp guardado</p>
              )}
            </div>
            <button onClick={cerrarOperacion} disabled={!listoParaCerrar || enviando || operacionCerrada || estadoAvisos === null}
              className={`flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors ${
                operacionCerrada ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 cursor-default'
                  : listoParaCerrar && !enviando && estadoAvisos !== null ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-600 cursor-not-allowed'
              }`}>
              {enviando ? 'Enviando...' : operacionCerrada ? 'Operación cerrada' : 'Cerrar operación'}
            </button>
          </div>
        )}
      </div>
    </div>
    {ficha && <FichaPersona {...ficha} onCerrar={() => setFicha(null)} />}
    </>
  )
}
