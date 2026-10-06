import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  clientesApi, reservasClienteApi, pagosApi,
  actividadApi, notasClienteApi, excursionesApi, reservasApi, leadsApi, recordatoriosApi,
  conversacionesApi, propuestasApi, clientesSaldosApi,
} from '../../lib/supabase.js'
import ModalRegistrarPago from '../../components/ui/ModalRegistrarPago.jsx'
import Ic, { IcGrande, IcTxt } from '../../components/admin/dashboard/Ic.jsx'
import { SeccionSaldos } from '../../components/leads/AnfitrionaDatos.jsx'
import { normalizarWhatsapp } from '../../lib/telefono.js'
import { useEtapas, etapaDe, embudoDeEtapa, nombreEmbudo, estiloFondoEtapa, EMBUDOS, NOTAS_TAREA_ANFITRIONA, hoyISO } from '../../lib/embudo.js'

/* ─── helpers ─── */
function iniciales(nombre = '') {
  return nombre.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}
function fmtFecha(f) {
  if (!f) return '—'
  return new Date(f).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtMonto(n, moneda = 'BRL') {
  if (n == null) return '—'
  return `${moneda} ${Number(n).toLocaleString('es-AR')}`
}

// La categoría de la excursión (en la base: "paquetes" / "excursiones" / "traslados")
// se muestra con el mismo nombre que usa el resto del panel (Embudo de paseos, etc.)
const NOMBRE_CATEGORIA = { paquetes: 'Paquetes', excursiones: 'Paseos', traslados: 'Traslados' }

const DIA_MS = 24 * 60 * 60 * 1000
const soloDigitos = (valor) => String(valor || '').replace(/\D/g, '')

const CONCEPTOS_SALDO_CLIENTE = [
  { id: 'paquetes', label: 'Paquete' },
  { id: 'paseos', label: 'Paseos' },
  { id: 'traslados', label: 'Traslados' },
  { id: 'hospedaje', label: 'Hospedaje' },
  { id: 'restaurante', label: 'Restaurante' },
  { id: 'otros', label: 'Otros servicios' },
]

const FILTROS_ACTIVIDAD = [
  { id: 'activos', label: 'Activos (últimos 30 días)' },
  { id: 'ya_vinieron', label: 'Ya vinieron' },
  { id: 'viaje_proximo', label: 'Con viaje próximo' },
  { id: 'solo_consulta', label: 'Solo consulta' },
]

// Para cada cliente: si tuvo consultas, propuestas o reservas en los últimos 30 días, si ya viajó,
// si tiene un viaje próximo y si nunca reservó. Las consultas se cruzan por WhatsApp (solo números).
function calcularActividad(clientes, reservas, conversaciones, propuestas) {
  const hoy = new Date().toISOString().split('T')[0]
  const marcar = (mapa, clave, ms) => { if (clave && ms > (mapa.get(clave) || 0)) mapa.set(clave, ms) }

  const consultaPorTel = new Map()
  for (const c of conversaciones) marcar(consultaPorTel, soloDigitos(c.whatsapp), Date.parse(c.ultimo_mensaje_at) || 0)
  const propuestaPorCliente = new Map()
  for (const p of propuestas) {
    marcar(consultaPorTel, soloDigitos(p.cliente_whatsapp), Date.parse(p.created_at) || 0)
    if (p.cliente_id) marcar(propuestaPorCliente, p.cliente_id, Date.parse(p.created_at) || 0)
  }
  const reservasPorCliente = new Map()
  for (const r of reservas) {
    if (!r.cliente_id) continue
    if (!reservasPorCliente.has(r.cliente_id)) reservasPorCliente.set(r.cliente_id, [])
    reservasPorCliente.get(r.cliente_id).push(r)
  }

  const mapa = {}
  for (const c of clientes) {
    const rs = reservasPorCliente.get(c.id) || []
    const ultimo = Math.max(
      consultaPorTel.get(soloDigitos(c.whatsapp)) || 0,
      propuestaPorCliente.get(c.id) || 0,
      ...rs.map(r => Date.parse(r.created_at) || 0),
    )
    mapa[c.id] = {
      activo: ultimo >= Date.now() - 30 * DIA_MS,
      yaViajo: rs.some(r => r.estado !== 'cancelada' && r.fecha && r.fecha < hoy),
      viajeProximo: rs.some(r => r.estado !== 'cancelada' && r.fecha && r.fecha >= hoy),
      soloConsulta: rs.length === 0,
    }
  }
  return mapa
}

/* ─── colores y etiquetas de estado de reserva ─── */
const ESTADO_RESERVA = {
  pendiente:   'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-900',
  confirmada:  'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900',
  completada:  'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900',
  cancelada:   'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
}
const ESTADO_RESERVA_LABEL = {
  pendiente: 'Pendiente', confirmada: 'Confirmada', completada: 'Finalizado', cancelada: 'Cancelada',
}
// Aunque todavía no se haya marcado "completada" en la base, una vez que
// pasó la fecha de la excursión (y no está cancelada) el perfil del
// cliente ya la muestra como finalizada.
function estadoEfectivo(r) {
  const hoy = new Date().toISOString().split('T')[0]
  if (r.estado !== 'cancelada' && r.fecha && r.fecha < hoy) return 'completada'
  return r.estado
}

/* ─── iconos de actividad ─── */
const ACTIVIDAD_ICON = {
  lead_recibido:        { icon: 'target', color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' },
  lead_convertido:      { icon: 'checkcircle', color: 'bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400' },
  reserva_creada:       { icon: 'file', color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' },
  reserva_confirmada:   { icon: 'check', color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' },
  pago_registrado:      { icon: 'card', color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' },
  excursion_completada: { icon: 'map', color: 'bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400' },
  mensaje_enviado:      { icon: 'chat', color: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400' },
  nota_agregada:        { icon: 'pencil', color: 'bg-gray-50 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400' },
  reserva_cancelada:    { icon: 'xcircle', color: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400' },
}

/* ════════════════════════════════════════════════
   LISTA DE CLIENTES
   ════════════════════════════════════════════════ */
const FORM_VACIO = { nombre: '', whatsapp: '', email: '', pais: '', ciudad: '', cantidad_pasajeros: '' }

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroReservas, setFiltroReservas] = useState('todos') // todos | con | sin
  const [filtroPais, setFiltroPais] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('') // '' | 'paquetes' | 'excursiones' | 'traslados'
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  // Categorías de excursión (paquetes/paseos/traslados) que reservó cada cliente,
  // para saber de qué es cliente. Un cliente sin reservas todavía no tiene ninguna.
  const [categoriasPorCliente, setCategoriasPorCliente] = useState({})
  const [filtroActividad, setFiltroActividad] = useState('') // '' | activos | ya_vinieron | viaje_proximo | solo_consulta
  const [reservasData, setReservasData] = useState([])
  const [conversacionesData, setConversacionesData] = useState([])
  const [propuestasData, setPropuestasData] = useState([])
  const [perfil, setPerfil] = useState(null)
  const [modalNuevo, setModalNuevo] = useState(false)
  const [eliminandoId, setEliminandoId] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    clientesApi.getAll().then(({ data }) => {
      setClientes(data || [])
      setCargando(false)
    })
    reservasApi.getCategoriasPorCliente().then(({ data }) => {
      const mapa = {}
      for (const r of data || []) {
        const cat = r.excursiones?.categoria
        if (!r.cliente_id || !cat) continue
        ;(mapa[r.cliente_id] ??= new Set()).add(cat)
      }
      setCategoriasPorCliente(mapa)
      setReservasData(data || [])
    })
    conversacionesApi.getAll().then(({ data }) => setConversacionesData(data || []))
    propuestasApi.getAll().then(({ data }) => setPropuestasData(data || []))
  }, [])

  const actividadPorCliente = useMemo(
    () => calcularActividad(clientes, reservasData, conversacionesData, propuestasData),
    [clientes, reservasData, conversacionesData, propuestasData],
  )

  // Auto-abrir el perfil si viene ?cliente= desde Leads (al convertir un lead)
  useEffect(() => {
    const clienteId = searchParams.get('cliente')
    if (!clienteId || !clientes.length) return
    const match = clientes.find(c => c.id === clienteId)
    if (match) {
      setPerfil(match)
      setSearchParams({}, { replace: true })
    }
  }, [clientes, searchParams])

  // Países que realmente tienen clientes cargados, para no ofrecer opciones vacías
  const paises = [...new Set(clientes.map(c => c.pais).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
  // Igual con los tipos: solo las categorías que de verdad reservó algún cliente
  const tipos = [...new Set(Object.values(categoriasPorCliente).flatMap(s => [...s]))]
    .sort((a, b) => a === 'paquetes' ? -1 : b === 'paquetes' ? 1 : 0) // Paquetes primero, como en el resto del panel

  const filtrados = clientes.filter(c => {
    if (busqueda && ![c.nombre, c.email, c.whatsapp, c.pais, c.ciudad].filter(Boolean).some(v => v.toLowerCase().includes(busqueda.toLowerCase()))) return false
    if (filtroReservas === 'con' && !(c.cantidad_reservas > 0)) return false
    if (filtroReservas === 'sin' && c.cantidad_reservas > 0) return false
    if (filtroPais && c.pais !== filtroPais) return false
    if (filtroTipo && !categoriasPorCliente[c.id]?.has(filtroTipo)) return false
    if (filtroActividad) {
      const act = actividadPorCliente[c.id]
      if (!act) return false
      if (filtroActividad === 'activos' && !act.activo) return false
      if (filtroActividad === 'ya_vinieron' && !act.yaViajo) return false
      if (filtroActividad === 'viaje_proximo' && !act.viajeProximo) return false
      if (filtroActividad === 'solo_consulta' && !act.soloConsulta) return false
    }
    // La fecha de alta es "hoy a las 00:00" en UTC del navegador; "Hasta" incluye todo ese día
    if (filtroDesde && c.created_at < `${filtroDesde}T00:00:00`) return false
    if (filtroHasta && c.created_at > `${filtroHasta}T23:59:59`) return false
    return true
  })

  async function crearCliente(datos) {
    const { data } = await clientesApi.create(datos)
    if (data) {
      setClientes(prev => [data, ...prev])
      setModalNuevo(false)
    }
  }

  async function eliminarCliente(id) {
    await clientesApi.delete(id)
    setClientes(prev => prev.filter(c => c.id !== id))
    setEliminandoId(null)
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Clientes</h1>
          <p className="text-gray-400 dark:text-zinc-600 text-sm">{clientes.length} clientes registrados</p>
        </div>
        <button
          onClick={() => setModalNuevo(true)}
          className="flex items-center gap-2 text-sm font-semibold text-white bg-brand-600 dark:bg-zinc-100 dark:text-zinc-900 rounded-xl px-4 py-2 hover:bg-brand-700 dark:hover:bg-zinc-200 transition-colors shadow-sm"
        >
          <span className="text-base leading-none">+</span> Nuevo cliente
        </button>
      </div>

      {/* Buscador y filtros */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre, email, WhatsApp o país..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full max-w-md border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <div className="flex items-center gap-1.5">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'con', label: 'Con reservas' },
            { id: 'sin', label: 'Sin reservas' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFiltroReservas(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                filtroReservas === f.id
                  ? 'bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={filtroPais}
          onChange={e => setFiltroPais(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        >
          <option value="">Todos los países</option>
          {paises.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        >
          <option value="">Todos los tipos</option>
          {tipos.map(t => <option key={t} value={t}>{NOMBRE_CATEGORIA[t]}</option>)}
        </select>
        <select
          value={filtroActividad}
          onChange={e => setFiltroActividad(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        >
          <option value="">Toda la actividad</option>
          {FILTROS_ACTIVIDAD.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400">
          <span>Alta:</span>
          <input
            type="date"
            value={filtroDesde}
            onChange={e => setFiltroDesde(e.target.value)}
            aria-label="Cliente desde"
            max={filtroHasta || undefined}
            className="rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          />
          <span>–</span>
          <input
            type="date"
            value={filtroHasta}
            onChange={e => setFiltroHasta(e.target.value)}
            aria-label="Cliente hasta"
            min={filtroDesde || undefined}
            className="rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          />
        </div>
        {(filtroReservas !== 'todos' || filtroPais || filtroTipo || filtroActividad || filtroDesde || filtroHasta) && (
          <button
            onClick={() => { setFiltroReservas('todos'); setFiltroPais(''); setFiltroTipo(''); setFiltroActividad(''); setFiltroDesde(''); setFiltroHasta('') }}
            className="text-xs font-semibold text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        {cargando ? (
          <div className="text-center py-16 text-gray-400 dark:text-zinc-600 text-sm">Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-zinc-600">
            <IcGrande n="users" />
            <p className="text-sm">No hay clientes que coincidan.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-800/60 text-gray-400 dark:text-zinc-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">Cliente</th>
                <th className="px-5 py-3 text-left">WhatsApp</th>
                <th className="px-5 py-3 text-left">País</th>
                <th className="px-5 py-3 text-left">Tipo</th>
                <th className="px-5 py-3 text-left">Pasajeros</th>
                <th className="px-5 py-3 text-left">Reservas</th>
                <th className="px-5 py-3 text-left">Total gastado</th>
                <th className="px-5 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
              {filtrados.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-950/40 border border-brand-100 dark:border-brand-900 flex items-center justify-center text-brand-600 dark:text-brand-400 text-xs font-bold flex-shrink-0">
                        {iniciales(c.nombre)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-zinc-100">{c.nombre}</p>
                        {c.email && <p className="text-xs text-gray-400 dark:text-zinc-600">{c.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500 dark:text-zinc-500 text-xs font-mono">{c.whatsapp}</td>
                  <td className="px-5 py-3 text-gray-500 dark:text-zinc-500 text-xs">{c.pais || '—'}{c.ciudad ? `, ${c.ciudad}` : ''}</td>
                  <td className="px-5 py-3">
                    {categoriasPorCliente[c.id]?.size ? (
                      <div className="flex flex-wrap gap-1">
                        {[...categoriasPorCliente[c.id]].map(t => (
                          <span key={t} className="rounded-full border border-gray-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-zinc-400">
                            {NOMBRE_CATEGORIA[t] || t}
                          </span>
                        ))}
                      </div>
                    ) : <span className="text-xs text-gray-300 dark:text-zinc-600">—</span>}
                  </td>
                  <td className="px-5 py-3 text-gray-600 dark:text-zinc-400 text-xs">{c.cantidad_pasajeros || '—'}</td>
                  <td className="px-5 py-3">
                    <span className="font-semibold text-gray-800 dark:text-zinc-200">{c.cantidad_reservas || 0}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={c.total_gastado > 0 ? 'font-semibold text-green-600 dark:text-green-400' : 'font-semibold text-gray-400 dark:text-zinc-600'}>
                      {c.total_gastado > 0 ? fmtMonto(c.total_gastado) : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setPerfil(c)}
                        className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 transition-colors"
                      >
                        Ver perfil →
                      </button>
                      {eliminandoId === c.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-400 dark:text-zinc-600">¿Eliminar?</span>
                          <button onClick={() => eliminarCliente(c.id)} className="text-xs font-semibold text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">Sí</button>
                          <button onClick={() => setEliminandoId(null)} className="text-xs text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-300">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setEliminandoId(c.id)} className="text-gray-300 dark:text-zinc-700 hover:text-red-400 dark:hover:text-red-400 transition-colors" title="Eliminar cliente">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Perfil */}
      {perfil && (
        <PerfilCliente
          cliente={perfil}
          onCerrar={() => setPerfil(null)}
          onUpdate={c => {
            setClientes(prev => prev.map(x => x.id === c.id ? c : x))
            setPerfil(c)
          }}
        />
      )}

      {/* Modal nuevo cliente */}
      {modalNuevo && (
        <ModalNuevoCliente
          onGuardar={crearCliente}
          onCerrar={() => setModalNuevo(false)}
        />
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════
   MODAL NUEVO CLIENTE
   ════════════════════════════════════════════════ */
function ModalNuevoCliente({ onGuardar, onCerrar }) {
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function set(key, val) { setForm(p => ({ ...p, [key]: val })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre.trim()) return setError('El nombre es obligatorio')
    if (!form.whatsapp.trim()) return setError('El WhatsApp es obligatorio')
    setError('')
    setGuardando(true)
    await onGuardar({
      ...form,
      whatsapp: normalizarWhatsapp(form.whatsapp),
      cantidad_pasajeros: form.cantidad_pasajeros ? parseInt(form.cantidad_pasajeros) : null,
    })
    setGuardando(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl dark:shadow-black/60 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 dark:text-zinc-100 text-base">Nuevo cliente</h2>
          <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 dark:text-zinc-500 text-lg transition-colors">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {[
            { key: 'nombre',   label: 'Nombre completo', placeholder: 'Juan García', required: true },
            { key: 'whatsapp', label: 'WhatsApp',         placeholder: '5491155554444', required: true },
            { key: 'email',    label: 'Email',            placeholder: 'juan@email.com' },
            { key: 'pais',     label: 'País',             placeholder: 'Argentina' },
            { key: 'ciudad',   label: 'Ciudad',           placeholder: 'Buenos Aires' },
            { key: 'cantidad_pasajeros', label: 'Cantidad de pasajeros', placeholder: '2', type: 'number' },
          ].map(({ key, label, placeholder, required, type }) => (
            <div key={key}>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">
                {label}{required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              <input
                type={type || 'text'}
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-500"
              />
              {key === 'whatsapp' && form.whatsapp.trim() && (
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Se va a guardar como: {normalizarWhatsapp(form.whatsapp)}</p>
              )}
            </div>
          ))}
          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={guardando}
            className="w-full bg-brand-600 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-brand-700 dark:hover:bg-zinc-200 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
          >
            {guardando ? 'Guardando...' : 'Crear cliente'}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════
   PERFIL COMPLETO DEL CLIENTE
   ════════════════════════════════════════════════ */
function PerfilCliente({ cliente, onCerrar, onUpdate }) {
  const navigate = useNavigate()
  const [reservas, setReservas] = useState([])
  const [pagos, setPagos] = useState([])
  const [actividad, setActividad] = useState([])
  const [notas, setNotas] = useState([])
  const [nuevaNota, setNuevaNota] = useState('')
  const [cargando, setCargando] = useState(true)
  const [lead, setLead] = useState(null)
  const [tareaEmergente, setTareaEmergente] = useState(null)
  const { etapas } = useEtapas()
  const [pagandoReserva, setPagandoReserva] = useState(null)
  const [editando, setEditando] = useState(false)
  const [modalReserva, setModalReserva] = useState(false)
  const [form, setForm] = useState({
    nombre: cliente.nombre || '',
    email: cliente.email || '',
    pais: cliente.pais || '',
    ciudad: cliente.ciudad || '',
    whatsapp: cliente.whatsapp || '',
    notas: cliente.notas || '',
    cantidad_pasajeros: cliente.cantidad_pasajeros ?? '',
  })

  useEffect(() => {
    setCargando(true)
    Promise.all([
      reservasClienteApi.getByCliente(cliente.id, cliente.whatsapp),
      pagosApi.getByCliente(cliente.id),
      actividadApi.getByCliente(cliente.id),
      notasClienteApi.getByCliente(cliente.id),
    ]).then(([r, p, a, n]) => {
      setReservas(r?.data || [])
      setPagos(p?.data || [])
      setActividad(a?.data || [])
      setNotas(n?.data || [])
      setCargando(false)
    })
  }, [cliente.id])

  // En qué embudo (Paquetes/Paseos/Anfitriona) y en qué paso está este cliente
  // como lead — no todo cliente tiene uno (puede haberse cargado a mano, sin
  // pasar por el CRM de WhatsApp).
  useEffect(() => {
    setLead(null)
    setTareaEmergente(null)
    if (!cliente.whatsapp) return
    leadsApi.getByWhatsapp(cliente.whatsapp).then(({ data }) => setLead(data || null))
  }, [cliente.whatsapp])

  // Recordatorio de pedir el saldo pendiente (45 días antes del check-in) o de
  // mandar el checklist (48 hs antes): si ya llegó su fecha, se muestra como
  // tarea emergente arriba de todo, no solo como un recordatorio más de la lista.
  useEffect(() => {
    if (!lead) return
    recordatoriosApi.getByLead(lead.id).then(({ data }) => {
      const pendiente = (data || [])
        .filter(r => !r.completado && NOTAS_TAREA_ANFITRIONA.includes(r.nota) && r.fecha <= hoyISO())
        .sort((a, b) => a.fecha.localeCompare(b.fecha))[0]
      setTareaEmergente(pendiente || null)
    })
  }, [lead])

  async function completarTareaEmergente() {
    if (!tareaEmergente) return
    await recordatoriosApi.completar(tareaEmergente.id, true)
    setTareaEmergente(null)
  }

  const etapaLead = lead ? etapaDe(etapas, lead.estado) : null

  async function crearReserva(form) {
    const personas = (parseInt(form.adultos) || 0) + (parseInt(form.menores) || 0)
    await reservasApi.create({
      cliente_nombre: cliente.nombre,
      cliente_whatsapp: (cliente.whatsapp || '').replace(/\D/g, ''),
      cliente_id: cliente.id,
      excursion_id: form.excursion_id || null,
      fecha: form.fecha || null,
      adultos: parseInt(form.adultos) || 0,
      menores: parseInt(form.menores) || 0,
      personas,
      hospedaje: form.hospedaje || null,
      ubicacion: form.hospedaje || null,
      total: parseInt(form.total) || null,
      moneda: form.moneda,
      estado: form.estado,
      notas: form.notas || null,
    })
    if (form.fecha) {
      navigate(`/admin/agenda?fecha=${form.fecha}`)
    } else {
      const { data } = await reservasClienteApi.getByCliente(cliente.id, cliente.whatsapp)
      if (data) setReservas(data)
      setModalReserva(false)
    }
  }

  async function guardarPerfil() {
    const payload = { ...form, cantidad_pasajeros: form.cantidad_pasajeros ? parseInt(form.cantidad_pasajeros) : null }
    const { data } = await clientesApi.update(cliente.id, payload)
    if (data) { onUpdate(data); setEditando(false) }
  }

  async function agregarNota() {
    if (!nuevaNota.trim()) return
    const { data } = await notasClienteApi.create({ cliente_id: cliente.id, contenido: nuevaNota, autor: 'Admin' })
    if (data) { setNotas(prev => [data, ...prev]); setNuevaNota('') }
  }

  async function borrarNota(id) {
    await notasClienteApi.delete(id)
    setNotas(prev => prev.filter(n => n.id !== id))
  }

  const totalPagado = pagos.filter(p => p.estado === 'confirmado').reduce((s, p) => s + Number(p.monto), 0)
  const excursionesCompletadas = reservas.filter(r => r.estado === 'completada').length
  const paseosReservados = reservas
    .filter(r => r.excursiones?.categoria === 'excursiones')
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))

  const ETIQUETA = 'text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-500'
  const CAMPO = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Ventana del perfil */}
      <div
        className="relative flex h-[90vh] w-[92vw] flex-col overflow-hidden rounded-2xl bg-gray-100 shadow-2xl dark:bg-zinc-950 dark:shadow-black/60"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:flex-row lg:overflow-hidden">

          {/* ── Columna izquierda: quién es el cliente ── */}
          <div className="flex shrink-0 flex-col gap-3 lg:w-80 lg:overflow-y-auto">
            <section className="dash-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-hero-sky/25 text-lg font-bold text-sky-700 dark:text-hero-sky">
                    {iniciales(cliente.nombre)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold text-gray-900 dark:text-zinc-100">{cliente.nombre}</h2>
                    <p className="text-xs text-gray-500 dark:text-zinc-500">
                      {[cliente.pais, cliente.ciudad].filter(Boolean).join(', ') || 'Sin ubicación'}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => setEditando(!editando)}
                    className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
                  >
                    {editando ? 'Cancelar' : 'Editar'}
                  </button>
                  <button onClick={onCerrar} aria-label="Cerrar" className="flex h-7 w-7 items-center justify-center rounded-lg text-lg text-gray-400 transition-colors hover:bg-gray-100 dark:text-zinc-500 dark:hover:bg-white/5">×</button>
                </div>
              </div>

              {!editando && (
                <div className="mt-4 space-y-2 text-sm">
                  {cliente.whatsapp && (
                    <button
                      onClick={() => { onCerrar(); navigate(`/admin/crm/whatsapp?phone=${cliente.whatsapp}`) }}
                      className="flex items-center gap-2 font-medium text-green-600 transition-colors hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                    >
                      <IcTxt n="chat" />{cliente.whatsapp}
                    </button>
                  )}
                  {cliente.email && <p className="truncate text-gray-500 dark:text-zinc-400">{cliente.email}</p>}
                  {etapaLead && (
                    <button
                      onClick={() => { onCerrar(); navigate(EMBUDOS.find(e => e.clave === embudoDeEtapa(etapaLead))?.ruta || '/admin/leads') }}
                      title="Ver en el tablero de leads"
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold text-gray-800 transition-opacity hover:opacity-80 dark:text-zinc-100"
                      style={estiloFondoEtapa(etapaLead.color)}
                    >
                      <i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: etapaLead.color }} />
                      <span className="truncate">{nombreEmbudo(embudoDeEtapa(etapaLead))} · {etapaLead.nombre}</span>
                    </button>
                  )}
                </div>
              )}

              {editando && (
                <div className="mt-4 space-y-3">
                  {[
                    { key: 'nombre', label: 'Nombre' },
                    { key: 'email', label: 'Email' },
                    { key: 'whatsapp', label: 'WhatsApp' },
                    { key: 'pais', label: 'País' },
                    { key: 'ciudad', label: 'Ciudad' },
                    { key: 'cantidad_pasajeros', label: 'Cantidad de pasajeros', type: 'number' },
                  ].map(({ key, label, type }) => (
                    <div key={key}>
                      <label className={`${ETIQUETA} mb-1 block`}>{label}</label>
                      <input type={type || 'text'} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} className={CAMPO} />
                    </div>
                  ))}
                  <button
                    onClick={guardarPerfil}
                    className="w-full rounded-xl bg-gray-900 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    Guardar cambios
                  </button>
                </div>
              )}
            </section>

            {/* Tarea emergente: saldo pendiente o checklist de Anfitriona ya vencidos */}
            {tareaEmergente && (
              <section className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/40">
                <Ic n="alert" className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-red-700 dark:text-red-400">{tareaEmergente.nota}</p>
                  <p className="text-xs text-red-500 dark:text-red-400/80">
                    {tareaEmergente.fecha < hoyISO() ? 'Vencido' : 'Vence hoy'} · {fmtFecha(tareaEmergente.fecha)}
                  </p>
                </div>
                <button onClick={completarTareaEmergente} className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600">
                  Marcar hecho
                </button>
              </section>
            )}

            {!editando && (
              <section className="dash-card grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xl font-bold text-gray-900 dark:text-zinc-100">{reservas.length}</p>
                  <p className="text-[11px] text-gray-500 dark:text-zinc-500">Reservas</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">{excursionesCompletadas}</p>
                  <p className="text-[11px] text-gray-500 dark:text-zinc-500">Completadas</p>
                </div>
                <div>
                  <p className="text-sm font-bold leading-6 text-amber-600 dark:text-amber-400">{totalPagado > 0 ? fmtMonto(totalPagado) : '—'}</p>
                  <p className="text-[11px] text-gray-500 dark:text-zinc-500">Pagado</p>
                </div>
              </section>
            )}

            <section className="dash-card">
              <p className={`${ETIQUETA} mb-3`}>Paseos reservados</p>
              {paseosReservados.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-zinc-600">Sin paseos reservados</p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-white/10">
                  {paseosReservados.map(r => (
                    <div key={r.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-zinc-100">{r.excursiones?.nombre || 'Paseo sin nombre'}</p>
                        <p className="text-xs text-gray-500 dark:text-zinc-500">
                          {r.fecha ? new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha'}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ESTADO_RESERVA[estadoEfectivo(r)] || ''}`}>
                        {ESTADO_RESERVA_LABEL[estadoEfectivo(r)] || r.estado}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ── Columna derecha: todo lo del cliente, sin pestañas ── */}
          <div className="flex min-w-0 flex-1 flex-col gap-3 lg:overflow-y-auto">
            {cargando ? (
              <div className="dash-card text-center text-sm text-gray-400 dark:text-zinc-600">Cargando...</div>
            ) : (
              <>
                <section className="dash-card !p-0 overflow-hidden">
                  <div className="p-5">
                    <SeccionSaldos
                      key={cliente.id}
                      id={cliente.id}
                      api={clientesSaldosApi}
                      campo="cliente_id"
                      conceptos={CONCEPTOS_SALDO_CLIENTE}
                      conceptoInicial="paquetes"
                    />
                  </div>
                </section>

                <section className="dash-card">
                  <div className="mb-3 flex items-center justify-between">
                    <p className={ETIQUETA}>Reservas · {reservas.length}</p>
                    <button
                      onClick={() => setModalReserva(true)}
                      className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                    >
                      <span className="text-sm leading-none">+</span> Nueva reserva
                    </button>
                  </div>
                  {reservas.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-zinc-600">Sin reservas registradas</p>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-white/10">
                      {reservas.map(r => {
                        const saldo = Math.max((r.total || 0) - (r.pagado || 0), 0)
                        const estado = estadoEfectivo(r)
                        return (
                          <div key={r.id} className="py-3 first:pt-0 last:pb-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{r.excursiones?.nombre || 'Paseo'}</p>
                                <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-500">
                                  <IcTxt n="cal" />{fmtFecha(r.fecha)} · <IcTxt n="users" />{r.personas} {r.personas === 1 ? 'persona' : 'personas'}
                                </p>
                                {r.hospedaje && <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-500"><IcTxt n="hotel" />{r.hospedaje}</p>}
                              </div>
                              <div className="shrink-0 text-right">
                                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${ESTADO_RESERVA[estado] || 'border-gray-100 bg-gray-50 text-gray-500 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-500'}`}>
                                  {ESTADO_RESERVA_LABEL[estado] || estado}
                                </span>
                                <p className="mt-1 text-sm font-bold text-gray-800 dark:text-zinc-200">{r.total ? fmtMonto(r.total, r.moneda) : '—'}</p>
                              </div>
                            </div>
                            {r.total > 0 && (
                              <div className="mt-2 flex items-center justify-between text-xs">
                                {saldo > 0
                                  ? <p className="text-gray-500 dark:text-zinc-500">Pendiente <span className="font-semibold text-amber-600 dark:text-amber-400">{fmtMonto(saldo, 'BRL')}</span></p>
                                  : <p className="font-semibold text-green-600 dark:text-green-400">Pagado por completo</p>}
                                {saldo > 0 && (
                                  <button onClick={() => setPagandoReserva(r)} className="font-semibold text-sky-700 hover:underline dark:text-hero-sky">
                                    Registrar pago
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>

                <div className="grid gap-3 xl:grid-cols-2">
                  <section className="dash-card">
                    <p className={`${ETIQUETA} mb-3`}>Pagos · {pagos.length}</p>
                    {pagos.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-zinc-600">Sin pagos registrados</p>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-white/10">
                        {pagos.map(p => (
                          <div key={p.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{fmtMonto(p.monto, p.moneda)}</p>
                              <p className="text-xs text-gray-500 dark:text-zinc-500">{p.metodo} · {fmtFecha(p.fecha_pago || p.created_at)}</p>
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              p.estado === 'confirmado' ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400'
                            }`}>
                              {p.estado}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="dash-card">
                    <p className={`${ETIQUETA} mb-3`}>Actividad</p>
                    {actividad.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-zinc-600">Sin actividad registrada</p>
                    ) : (
                      <div className="space-y-3">
                        {actividad.slice(0, 8).map(a => {
                          const cfg = ACTIVIDAD_ICON[a.tipo] || { icon: 'dot', color: 'bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500' }
                          return (
                            <div key={a.id} className="flex items-start gap-3">
                              <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${cfg.color}`}>
                                <Ic n={cfg.icon} className="h-3 w-3" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-gray-800 dark:text-zinc-200">{a.titulo}</p>
                                <p className="text-[11px] text-gray-400 dark:text-zinc-600">{fmtFecha(a.created_at)}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </section>
                </div>

                <section className="dash-card">
                  <p className={`${ETIQUETA} mb-3`}>Notas · {notas.length}</p>
                  <div className="mb-4 flex gap-2">
                    <textarea
                      rows={2}
                      value={nuevaNota}
                      onChange={e => setNuevaNota(e.target.value)}
                      placeholder="Agregar nota interna..."
                      className="min-w-0 flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                    <button
                      onClick={agregarNota}
                      disabled={!nuevaNota.trim()}
                      className="self-end rounded-xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                    >
                      Agregar
                    </button>
                  </div>
                  {notas.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-zinc-600">Sin notas todavía</p>
                  ) : (
                    <div className="space-y-2">
                      {notas.map(n => (
                        <div key={n.id} className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/[0.03]">
                          <div className="min-w-0">
                            <p className="text-sm text-gray-800 dark:text-zinc-200">{n.contenido}</p>
                            <p className="mt-1 text-[11px] text-gray-400 dark:text-zinc-600">
                              {n.autor && <span className="font-medium">{n.autor} · </span>}
                              {fmtFecha(n.created_at)}
                            </p>
                          </div>
                          <button onClick={() => borrarNota(n.id)} className="shrink-0 text-sm text-gray-300 transition-colors hover:text-red-400 dark:text-zinc-700 dark:hover:text-red-400">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </div>

      {modalReserva && (
        <ModalReservaCliente
          cliente={cliente}
          onGuardar={crearReserva}
          onCerrar={() => setModalReserva(false)}
        />
      )}

      {pagandoReserva && (
        <ModalRegistrarPago
          reserva={pagandoReserva}
          clienteId={cliente.id}
          clienteNombre={cliente.nombre}
          onCerrar={() => setPagandoReserva(null)}
          onGuardado={(nuevoPagado, clienteActualizado) => {
            setReservas(prev => prev.map(r => r.id === pagandoReserva.id ? { ...r, pagado: nuevoPagado } : r))
            if (clienteActualizado) onUpdate(clienteActualizado)
            setPagandoReserva(null)
            pagosApi.getByCliente(cliente.id).then(({ data }) => setPagos(data || []))
          }}
        />
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════
   MODAL NUEVA RESERVA PARA CLIENTE EXISTENTE
   ════════════════════════════════════════════════ */
const RESERVA_VACIA = { excursion_id: '', fecha: '', adultos: 1, menores: 0, hospedaje: '', total: '', moneda: 'BRL', estado: 'pendiente', notas: '' }

function ModalReservaCliente({ cliente, onGuardar, onCerrar }) {
  const [form, setForm] = useState(RESERVA_VACIA)
  const [excursiones, setExcursiones] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    excursionesApi.getAll().then(({ data }) => setExcursiones(data || []))
  }, [])

  function set(key, val) { setForm(p => ({ ...p, [key]: val })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.excursion_id) return setError('Seleccioná un paseo')
    if (!form.fecha) return setError('La fecha es obligatoria')
    setError('')
    setGuardando(true)
    await onGuardar(form)
    setGuardando(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl dark:shadow-black/60 w-full max-w-md max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

        <div className="px-6 py-5 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-zinc-100 text-base">Nueva reserva</h2>
              <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5">Cliente: <span className="font-medium text-gray-600 dark:text-zinc-400">{cliente.nombre}</span></p>
            </div>
            <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 dark:text-zinc-500 text-lg">×</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Paseo <span className="text-red-400">*</span></label>
              <select value={form.excursion_id} onChange={e => set('excursion_id', e.target.value)}
                className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-500">
                <option value="">— Seleccionar</option>
                {excursiones.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Fecha <span className="text-red-400">*</span></label>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)}
                className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Adultos</label>
              <input type="number" min="0" value={form.adultos} onChange={e => set('adultos', e.target.value)}
                className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Menores</label>
              <input type="number" min="0" value={form.menores} onChange={e => set('menores', e.target.value)}
                className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Hospedaje / Pickup</label>
            <input type="text" value={form.hospedaje} onChange={e => set('hospedaje', e.target.value)}
              placeholder="Hotel, dirección..."
              className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Total</label>
              <input type="number" min="0" value={form.total} onChange={e => set('total', e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Moneda</label>
              <select value={form.moneda} onChange={e => set('moneda', e.target.value)}
                className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-500">
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Estado</label>
            <select value={form.estado} onChange={e => set('estado', e.target.value)}
              className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-500">
              <option value="pendiente">Pendiente</option>
              <option value="confirmada">Confirmada</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Notas</label>
            <textarea rows={2} value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Observaciones..."
              className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-500 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

          <button type="submit" disabled={guardando}
            className="w-full bg-brand-600 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-brand-700 dark:hover:bg-zinc-200 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors">
            {guardando ? 'Guardando...' : 'Crear reserva'}
          </button>
        </form>
      </div>
    </div>
  )
}
