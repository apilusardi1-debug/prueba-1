// Ficha única de una persona (pedido de Cristian, 2026-10-14): se abre igual desde el
// embudo de Leads y desde Clientes. Junta lo que antes estaba en dos fichas distintas:
// el lead (etapa, interés, vuelos, hospedajes, recordatorios) y el cliente (reservas,
// pagos, notas), con un solo listado de saldos. El diseño es el de la ficha de Clientes:
// a la izquierda quién es, a la derecha todo lo operativo.
//
// Una persona puede ser solo lead, solo cliente o las dos cosas (se cruzan por WhatsApp).
// Si a un lead le hace falta algo de cliente (una reserva), su ficha de cliente se crea sola.
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  leadsApi, clientesApi, recordatoriosApi, usuariosAdminApi, anfitrionaApi, saldosApi,
  reservasClienteApi, reservasApi, pagosApi, notasClienteApi, parcerosApi, propuestasApi, viajesPaquetesApi,
} from '../../lib/supabase.js'
import { useEtapas, etapaDe, embudoDeEtapa, nombreEmbudo, estiloFondoEtapa, NOTAS_TAREA_ANFITRIONA, hoyISO, claveVisible } from '../../lib/embudo.js'
import { etiquetaInteres } from '../../../supabase/functions/_shared/interes.ts'
import { SeccionSaldos, SeccionHospedajes } from '../leads/AnfitrionaDatos.jsx'
import { RAZONES_PERDIDA, CampoInteres, CampoEtiquetas, OpcionesEtapas, formatoReales } from '../leads/CamposLead.jsx'
import ModalRegistrarPago from '../ui/ModalRegistrarPago.jsx'
import ModalReservaCliente from './ModalReservaCliente.jsx'
import Ic, { IcTxt } from '../admin/dashboard/Ic.jsx'
import { avisar, confirmar } from '../ui/Avisos.jsx'
import { formatMonto, fechaCorta, nombrePaseo, saldoDe } from '../../lib/reservasPlanilla.js'

// Un solo listado de conceptos para los saldos de la persona
const CONCEPTOS_SALDO = [
  { id: 'paquetes', label: 'Paquete' },
  { id: 'paseos', label: 'Paseos' },
  { id: 'aereo', label: 'Aéreo' },
  { id: 'traslados', label: 'Traslados' },
  { id: 'hospedaje', label: 'Hospedaje' },
  { id: 'restaurante', label: 'Restaurante' },
  { id: 'otros', label: 'Otros servicios' },
]

const ESTADO_RESERVA = {
  pendiente: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-900',
  confirmada: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900',
  completada: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900',
  cancelada: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
}
const ESTADO_RESERVA_LABEL = { pendiente: 'Pendiente', confirmada: 'Confirmada', completada: 'Finalizado', cancelada: 'Cancelada' }
const ESTADO_PROPUESTA = { enviada: 'Enviada', cerrada: 'Cerrada', rechazada: 'Rechazada', archivada: 'Archivada' }

const ETIQUETA = 'text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-500'
const CAMPO = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100'
const BOTON_OSCURO = 'rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300'
const BOTON_CLARO = 'rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5'
const ENLACE = 'text-xs font-semibold text-sky-700 hover:underline dark:text-hero-sky'

const soloDigitos = (v) => String(v || '').replace(/\D/g, '')
function iniciales(nombre = '') {
  return String(nombre).split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?'
}
function fmtFecha(f) {
  if (!f) return '—'
  const d = /^\d{4}-\d{2}-\d{2}$/.test(f) ? new Date(f + 'T12:00:00') : new Date(f)
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtMonto(n, moneda = 'BRL') {
  if (n == null) return '—'
  return moneda === 'BRL' ? formatoReales(n) : `${moneda} ${Number(n).toLocaleString('es-AR')}`
}
function estadoEfectivo(r) {
  if (r.estado !== 'cancelada' && r.fecha && r.fecha < hoyISO()) return 'completada'
  return r.estado
}
// Un celular de Brasil puede estar guardado con o sin el 9 después del DDD
function variantesTelefono(tel) {
  const d = soloDigitos(tel)
  if (!d) return []
  if (d.startsWith('55') && d.length === 12 && /^[6-9]/.test(d.slice(4))) return [d, d.slice(0, 4) + '9' + d.slice(4)]
  if (d.startsWith('55') && d.length === 13 && d[4] === '9') return [d, d.slice(0, 4) + d.slice(5)]
  return [d]
}
async function buscarPorTelefono(buscar, tel) {
  for (const v of variantesTelefono(tel)) {
    const { data } = (await buscar(v)) || {}
    if (data) return data
  }
  return null
}

// Fechas de vuelo que se piden para un lead de Anfitriona (mismas reglas que la ficha anterior)
function faltantesDeVuelos(f) {
  const faltan = []
  if (!f.fecha_vuelo_ida) faltan.push('fecha del vuelo de ida')
  if (!f.fecha_vuelo_vuelta) faltan.push('fecha del vuelo de vuelta')
  if (!f.vuelo_interno) faltan.push('vuelo interno (o NO HAY)')
  if (f.vuelo_interno === 'recife_noronha') {
    if (!f.fecha_vuelo_interno_ida) faltan.push('fecha de ida del vuelo interno')
    if (!f.fecha_vuelo_interno_vuelta) faltan.push('fecha de vuelta del vuelo interno')
  }
  return faltan
}

function vuelosDe(lead) {
  return {
    fecha_vuelo_ida: lead?.fecha_vuelo_ida || '',
    fecha_vuelo_vuelta: lead?.fecha_vuelo_vuelta || '',
    vuelo_interno: lead?.vuelo_interno || '',
    fecha_vuelo_interno_ida: lead?.fecha_vuelo_interno_ida || '',
    fecha_vuelo_interno_vuelta: lead?.fecha_vuelo_interno_vuelta || '',
  }
}

export default function FichaPersona({ lead: leadInicial = null, cliente: clienteInicial = null, onCerrar, onLeadActualizado, onClienteActualizado, sugerenciasEtiquetas = [] }) {
  const navigate = useNavigate()
  const { etapas } = useEtapas()
  const [lead, setLead] = useState(leadInicial)
  const [cliente, setCliente] = useState(clienteInicial)
  const [vinculando, setVinculando] = useState(true)
  const [cargando, setCargando] = useState(true)

  const [usuarios, setUsuarios] = useState([])
  const [recordatorios, setRecordatorios] = useState([])
  const [hospedajes, setHospedajes] = useState([])
  const [reservas, setReservas] = useState([])
  const [viajes, setViajes] = useState([])
  const [pagos, setPagos] = useState([])
  const [notas, setNotas] = useState([])
  const [parceros, setParceros] = useState([])
  const [propuestas, setPropuestas] = useState([])

  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState(null)
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)
  const [etapaPendiente, setEtapaPendiente] = useState(null) // { clave } mientras se elige el motivo de pérdida
  const [razon, setRazon] = useState(RAZONES_PERDIDA[0].id)
  const [vuelos, setVuelos] = useState(vuelosDe(leadInicial))
  const [guardandoVuelos, setGuardandoVuelos] = useState(false)
  const [nuevoRecFecha, setNuevoRecFecha] = useState(hoyISO())
  const [nuevoRecNota, setNuevoRecNota] = useState('')
  const [nuevaNota, setNuevaNota] = useState('')
  const [modalReserva, setModalReserva] = useState(false)
  const [pagandoReserva, setPagandoReserva] = useState(null)
  const [creandoLead, setCreandoLead] = useState(false)

  const whatsapp = soloDigitos(lead?.whatsapp || cliente?.whatsapp)
  const nombre = lead?.nombre || cliente?.nombre || 'Sin nombre'

  // Cerrar con Escape
  useEffect(() => {
    const tecla = e => { if (e.key === 'Escape') onCerrar() }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [onCerrar])

  // La otra mitad de la persona: el cliente de un lead, o el lead de un cliente
  useEffect(() => {
    let cancelado = false
    async function vincular() {
      setVinculando(true)
      const tel = leadInicial?.whatsapp || clienteInicial?.whatsapp
      const [c, l] = await Promise.all([
        clienteInicial ? clienteInicial : (tel ? buscarPorTelefono(clientesApi.getByWhatsapp, tel) : null),
        leadInicial ? leadInicial : (tel ? buscarPorTelefono(leadsApi.getByWhatsapp, tel) : null),
      ])
      if (cancelado) return
      setCliente(c || null)
      setLead(l || null)
      setVuelos(vuelosDe(l))
      setVinculando(false)
    }
    vincular()
    usuariosAdminApi.getAll().then(({ ok, usuarios: lista }) => { if (ok && !cancelado) setUsuarios(lista || []) })
    return () => { cancelado = true }
  }, [leadInicial?.id, clienteInicial?.id])

  // Todo lo de la persona, una vez que se sabe quién es
  useEffect(() => { parcerosApi.getAll().then(({ data }) => setParceros(data || [])) }, [])

  useEffect(() => {
    if (vinculando) return
    let cancelado = false
    setCargando(true)
    Promise.all([
      lead ? recordatoriosApi.getByLead(lead.id) : null,
      lead ? anfitrionaApi.getHospedajes() : null,
      reservasClienteApi.getByPersona(lead?.id, cliente?.id, cliente?.whatsapp || lead?.whatsapp),
      cliente ? pagosApi.getByCliente(cliente.id) : null,
      notasClienteApi.getByPersona(lead?.id, cliente?.id),
      whatsapp ? propuestasApi.getByWhatsapp(whatsapp) : null,
      viajesPaquetesApi.getByPersona(lead?.id, cliente?.id),
    ]).then(([rec, hos, res, pag, not, pro, via]) => {
      if (cancelado) return
      setRecordatorios(rec?.data || [])
      setHospedajes(hos?.data || [])
      setReservas(res?.data || [])
      setViajes(via?.data || [])
      setPagos(pag?.data || [])
      setNotas(not?.data || [])
      setPropuestas((pro?.data || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))))
      setCargando(false)
    })
    return () => { cancelado = true }
  }, [vinculando, lead?.id, cliente?.id])

  const etapa = lead ? etapaDe(etapas, lead.estado) : null
  const embudo = etapa ? embudoDeEtapa(etapa) : null
  const pendientes = recordatorios.filter(r => !r.completado).sort((a, b) => a.fecha.localeCompare(b.fecha))
  const tareaEmergente = pendientes.find(r => NOTAS_TAREA_ANFITRIONA.includes(r.nota) && r.fecha <= hoyISO()) || null
  const totalPagado = pagos.filter(p => p.estado === 'confirmado').reduce((s, p) => s + Number(p.monto), 0)
  const completadas = reservas.filter(r => estadoEfectivo(r) === 'completada').length
  const nombreUsuario = id => usuarios.find(u => u.id === id)?.nombre || ''

  function actualizarLead(nuevo) {
    setLead(nuevo)
    onLeadActualizado?.(nuevo)
  }
  function actualizarCliente(nuevo) {
    setCliente(nuevo)
    onClienteActualizado?.(nuevo)
  }

  // Las automatizaciones de la base (recordatorios, responsable, pase a Anfitriona) se
  // cumplen al cambiar la etapa o los vuelos: se relee el lead y sus recordatorios.
  async function releerLead(id) {
    const [{ data: l }, { data: recs }] = await Promise.all([leadsApi.getById(id), recordatoriosApi.getByLead(id)])
    if (l) { actualizarLead(l); setVuelos(vuelosDe(l)) }
    if (recs) setRecordatorios(recs)
  }

  // ── Ficha de cliente cuando hace falta (por ejemplo, para cargar una reserva) ──
  async function asegurarCliente() {
    if (cliente) return cliente
    const existente = whatsapp ? await buscarPorTelefono(clientesApi.getByWhatsapp, whatsapp) : null
    if (existente) { actualizarCliente(existente); return existente }
    const { data, error } = await clientesApi.create({
      nombre: lead?.nombre || 'Sin nombre',
      whatsapp: whatsapp || null,
      email: lead?.email || null,
      ...(lead ? { lead_id: lead.id } : {}),
    })
    if (error || !data) { avisar('No se pudo crear la ficha de cliente: ' + (error?.message || 'error desconocido')); return null }
    actualizarCliente(data)
    return data
  }

  // ── Datos de la persona ───────────────────────────────────────────────────────
  function empezarEdicion() {
    setForm({
      nombre: nombre === 'Sin nombre' ? '' : nombre,
      whatsapp: lead?.whatsapp || cliente?.whatsapp || '',
      email: lead?.email || cliente?.email || '',
      pais: cliente?.pais || '',
      ciudad: cliente?.ciudad || '',
      cantidad_pasajeros: cliente?.cantidad_pasajeros ?? '',
      origen: lead?.origen || '',
      interes_tipo: lead?.interes_tipo || '',
      interes_destino: lead?.interes_destino || '',
      valor: lead?.valor ?? 0,
      etiquetas: lead?.etiquetas || [],
    })
    setEditando(true)
  }

  async function guardarPerfil() {
    if (!form.nombre.trim()) return avisar('El nombre no puede quedar vacío.')
    setGuardandoPerfil(true)
    const tel = soloDigitos(form.whatsapp) || null
    if (lead) {
      const { data, error } = await leadsApi.update(lead.id, {
        nombre: form.nombre.trim(),
        whatsapp: tel,
        email: form.email.trim() || null,
        origen: form.origen.trim() || null,
        interes_tipo: form.interes_tipo || null,
        interes_destino: form.interes_destino.trim() || null,
        valor: Math.max(0, Number(String(form.valor).replace(',', '.')) || 0),
        etiquetas: form.etiquetas,
      })
      if (error) { setGuardandoPerfil(false); return avisar('No se pudo guardar: ' + error.message) }
      if (data) actualizarLead(data)
    }
    if (cliente) {
      const { data, error } = await clientesApi.update(cliente.id, {
        nombre: form.nombre.trim(),
        whatsapp: tel,
        email: form.email.trim() || null,
        pais: form.pais.trim() || null,
        ciudad: form.ciudad.trim() || null,
        cantidad_pasajeros: form.cantidad_pasajeros ? parseInt(form.cantidad_pasajeros) : null,
      })
      if (error) { setGuardandoPerfil(false); return avisar('No se pudo guardar la ficha de cliente: ' + error.message) }
      if (data) actualizarCliente(data)
    }
    setGuardandoPerfil(false)
    setEditando(false)
  }

  // ── Etapa del embudo (mismas reglas que el tablero) ───────────────────────────
  async function elegirEtapa(clave) {
    if (!lead || !clave || clave === lead.estado) return
    const destino = etapaDe(etapas, clave)
    const enAnfitriona = embudoDeEtapa(etapa) === 'anfitriona'
    if (enAnfitriona && clave !== 'anfitriona_perdido' && !lead.fecha_vuelo_ida) {
      return avisar('Cargá la fecha del vuelo de ida antes de mover este lead a otra etapa de Anfitriona.')
    }
    if (embudoDeEtapa(destino) === 'anfitriona' && destino?.tipo !== 'perdida') {
      const faltan = faltantesDeVuelos(lead)
      if (faltan.length) return avisar('Para pasar a Anfitriona faltan: ' + faltan.join(', ') + '. Cargalos en Vuelos.')
    }
    if (destino?.tipo === 'perdida') {
      setRazon(RAZONES_PERDIDA[0].id)
      setEtapaPendiente({ clave })
      return
    }
    await moverEtapa(clave)
  }

  async function moverEtapa(clave, razonPerdida) {
    const { error } = await leadsApi.updateEstado(lead.id, clave, null, razonPerdida)
    if (error) return avisar('No se pudo cambiar la etapa: ' + (error.message || 'error desconocido'))
    setEtapaPendiente(null)
    await releerLead(lead.id)
  }

  async function cambiarResponsable(id) {
    const { data, error } = await leadsApi.update(lead.id, { responsable_id: id || null })
    if (error) return avisar('No se pudo cambiar el responsable: ' + error.message)
    if (data) actualizarLead(data)
  }

  async function agregarAlEmbudo() {
    if (creandoLead) return
    setCreandoLead(true)
    const { data, error } = await leadsApi.create({
      nombre: cliente?.nombre || 'Sin nombre',
      whatsapp: whatsapp || null,
      email: cliente?.email || null,
      origen: 'Manual',
      estado: 'nuevo',
    })
    setCreandoLead(false)
    if (error || !data) return avisar('No se pudo agregar al embudo: ' + (error?.message || 'error desconocido'))
    actualizarLead(data)
    setVuelos(vuelosDe(data))
  }

  // ── Vuelos ────────────────────────────────────────────────────────────────────
  async function guardarVuelos() {
    if (embudo === 'anfitriona') {
      const faltan = faltantesDeVuelos(vuelos)
      if (faltan.length) return avisar('Para un lead de Anfitriona faltan: ' + faltan.join(', ') + '.')
    }
    setGuardandoVuelos(true)
    const interno = vuelos.vuelo_interno === 'recife_noronha'
    const { error } = await leadsApi.update(lead.id, {
      fecha_vuelo_ida: vuelos.fecha_vuelo_ida || null,
      fecha_vuelo_vuelta: vuelos.fecha_vuelo_vuelta || null,
      vuelo_interno: vuelos.vuelo_interno || null,
      fecha_vuelo_interno_ida: interno ? vuelos.fecha_vuelo_interno_ida || null : null,
      fecha_vuelo_interno_vuelta: interno ? vuelos.fecha_vuelo_interno_vuelta || null : null,
    })
    setGuardandoVuelos(false)
    if (error) return avisar('No se pudieron guardar los vuelos: ' + error.message)
    await releerLead(lead.id) // las alarmas de vuelo las crea la base
    avisar('Vuelos guardados.')
  }

  // ── Recordatorios ─────────────────────────────────────────────────────────────
  async function agregarRecordatorio() {
    if (!nuevoRecNota.trim() || !nuevoRecFecha) return
    const { data, error } = await recordatoriosApi.create({ lead_id: lead.id, fecha: nuevoRecFecha, nota: nuevoRecNota.trim() })
    if (error) return avisar('No se pudo agregar el recordatorio: ' + error.message)
    if (data) { setRecordatorios(prev => [...prev, data]); setNuevoRecNota(''); setNuevoRecFecha(hoyISO()) }
  }
  async function completarRecordatorio(id) {
    setRecordatorios(prev => prev.map(r => r.id === id ? { ...r, completado: true } : r))
    await recordatoriosApi.completar(id, true)
  }
  async function eliminarRecordatorio(id) {
    setRecordatorios(prev => prev.filter(r => r.id !== id))
    await recordatoriosApi.delete(id)
  }

  // ── Saldos: un solo listado, ligado al lead y/o al cliente ────────────────────
  const apiSaldos = useMemo(() => ({
    getSaldos: () => saldosApi.listar(lead?.id, cliente?.id),
    // SeccionSaldos manda { persona: ..., concepto, ... }: se reemplaza por los ids reales
    createSaldo: ({ persona, ...datos }) => saldosApi.create({ ...datos, lead_id: lead?.id || null, cliente_id: cliente?.id || null }),
    updateSaldo: (id, datos) => saldosApi.update(id, datos),
    deleteSaldo: (id) => saldosApi.delete(id),
  }), [lead?.id, cliente?.id])

  // ── Reservas ──────────────────────────────────────────────────────────────────
  async function abrirNuevaReserva() {
    const c = await asegurarCliente()
    if (c) setModalReserva(true)
  }
  async function crearReserva(f) {
    const c = cliente
    if (!c) return
    const personas = (parseInt(f.adultos) || 0) + (parseInt(f.menores) || 0)
    const { error } = await reservasApi.create({
      cliente_nombre: c.nombre,
      cliente_whatsapp: soloDigitos(c.whatsapp),
      cliente_id: c.id,
      excursion_id: f.excursion_id || null,
      fecha: f.fecha || null,
      adultos: parseInt(f.adultos) || 0,
      menores: parseInt(f.menores) || 0,
      personas,
      hospedaje: f.hospedaje || null,
      ubicacion: f.hospedaje || null,
      total: parseInt(f.total) || null,
      moneda: f.moneda,
      estado: f.estado,
      notas: f.notas || null,
    })
    if (error) return avisar('No se pudo crear la reserva: ' + (error.message || 'error desconocido'))
    const { data } = await reservasClienteApi.getByPersona(lead?.id, c.id, c.whatsapp)
    if (data) setReservas(data)
    setModalReserva(false)
  }

  // ── Notas: sueltas, del lead y/o del cliente (las mismas que se escriben en el chat del CRM) ──
  async function agregarNota() {
    const texto = nuevaNota.trim()
    if (!texto || (!lead && !cliente)) return
    const { data, error } = await notasClienteApi.create({ lead_id: lead?.id || null, cliente_id: cliente?.id || null, contenido: texto })
    if (error) return avisar('No se pudo guardar la nota: ' + error.message)
    if (data) { setNotas(prev => [data, ...prev]); setNuevaNota('') }
  }
  async function borrarNota(id) {
    if (!await confirmar('¿Borrar esta nota?')) return
    await notasClienteApi.delete(id)
    setNotas(prev => prev.filter(n => n.id !== id))
  }

  const ubicacion = [cliente?.pais, cliente?.ciudad].filter(Boolean).join(', ')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCerrar} />
      <div className="relative flex h-[90vh] w-[92vw] flex-col overflow-hidden rounded-2xl bg-gray-100 shadow-2xl dark:bg-zinc-950 dark:shadow-black/60" onClick={e => e.stopPropagation()}>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:flex-row lg:overflow-hidden">

          {/* ── Columna izquierda: quién es ── */}
          <div className="flex shrink-0 flex-col gap-3 lg:w-80 lg:overflow-y-auto">
            <section className="dash-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-hero-sky/25 text-lg font-bold text-sky-700 dark:text-hero-sky">
                    {iniciales(nombre)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold text-gray-900 dark:text-zinc-100">{nombre}</h2>
                    <p className="text-xs text-gray-500 dark:text-zinc-500">{ubicacion || (cliente ? 'Sin ubicación' : 'Todavía no es cliente')}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {!vinculando && (
                    <button onClick={() => (editando ? setEditando(false) : empezarEdicion())} className={BOTON_CLARO}>
                      {editando ? 'Cancelar' : 'Editar'}
                    </button>
                  )}
                  <button onClick={onCerrar} aria-label="Cerrar" className="flex h-7 w-7 items-center justify-center rounded-lg text-lg text-gray-400 transition-colors hover:bg-gray-100 dark:text-zinc-500 dark:hover:bg-white/5">×</button>
                </div>
              </div>

              {!editando && (
                <div className="mt-4 space-y-2 text-sm">
                  {whatsapp && (
                    <button
                      onClick={() => { onCerrar(); navigate(`/admin/crm/whatsapp?phone=${whatsapp}`) }}
                      className="flex items-center gap-2 font-medium text-green-600 transition-colors hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                    >
                      <IcTxt n="chat" />+{whatsapp}
                    </button>
                  )}
                  {(lead?.email || cliente?.email) && <p className="truncate text-gray-500 dark:text-zinc-400">{lead?.email || cliente?.email}</p>}

                  {lead ? (
                    <div className="space-y-1.5 pt-1">
                      {etapa && (
                        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold text-gray-800 dark:text-zinc-100" style={estiloFondoEtapa(etapa.color)}>
                          <i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: etapa.color }} />
                          <span className="truncate">{nombreEmbudo(embudo)} · {etapa.nombre}</span>
                        </span>
                      )}
                      <label htmlFor="ficha-etapa" className="sr-only">Cambiar etapa</label>
                      <select id="ficha-etapa" value={claveVisible(etapas, lead.estado) || ''} onChange={e => elegirEtapa(e.target.value)} className={CAMPO}>
                        <OpcionesEtapas etapas={etapas} />
                      </select>
                      {etapaPendiente && (
                        <div className="space-y-2 rounded-xl border border-gray-200 p-3 dark:border-white/10">
                          <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">¿Por qué se perdió?</p>
                          <select value={razon} onChange={e => setRazon(e.target.value)} className={CAMPO} aria-label="Motivo de la pérdida">
                            {RAZONES_PERDIDA.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                          </select>
                          <div className="flex gap-2">
                            <button onClick={() => moverEtapa(etapaPendiente.clave, razon)} className={BOTON_OSCURO}>Confirmar</button>
                            <button onClick={() => setEtapaPendiente(null)} className={BOTON_CLARO}>Cancelar</button>
                          </div>
                        </div>
                      )}
                      {etapa?.tipo === 'perdida' && lead.razon_perdida && (
                        <p className="text-[11px] text-gray-400 dark:text-zinc-500">Motivo: {RAZONES_PERDIDA.find(r => r.id === lead.razon_perdida)?.label || lead.razon_perdida}</p>
                      )}
                    </div>
                  ) : !vinculando && (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <p className="text-xs text-gray-400 dark:text-zinc-500">No está en ningún embudo.</p>
                      <button onClick={agregarAlEmbudo} disabled={creandoLead} className={ENLACE}>{creandoLead ? 'Agregando...' : 'Agregar al embudo'}</button>
                    </div>
                  )}
                </div>
              )}

              {!editando && lead && (
                <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 border-t border-gray-100 pt-4 text-sm dark:border-white/10">
                  <dt className="text-gray-400 dark:text-zinc-500">Responsable</dt>
                  <dd>
                    <label htmlFor="ficha-responsable" className="sr-only">Responsable</label>
                    <select id="ficha-responsable" value={lead.responsable_id || ''} onChange={e => cambiarResponsable(e.target.value)}
                      className="w-full bg-transparent text-sm text-gray-900 focus:outline-none dark:text-zinc-100">
                      <option value="">Sin responsable</option>
                      {usuarios.filter(u => u.activo !== false || u.id === lead.responsable_id).map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                    </select>
                  </dd>
                  <dt className="text-gray-400 dark:text-zinc-500">Origen</dt>
                  <dd className="text-gray-800 dark:text-zinc-200">{lead.origen || '—'}</dd>
                  {lead.parcero_id && parceros.some(p => p.id === lead.parcero_id) && (<>
                    <dt className="text-gray-400 dark:text-zinc-500">Parcero</dt>
                    <dd className="text-gray-800 dark:text-zinc-200">{parceros.find(p => p.id === lead.parcero_id).nombre}</dd>
                  </>)}
                  <dt className="text-gray-400 dark:text-zinc-500">Interés</dt>
                  <dd className="text-gray-800 dark:text-zinc-200">{etiquetaInteres(lead) || '—'}</dd>
                  <dt className="text-gray-400 dark:text-zinc-500">Valor</dt>
                  <dd className="text-gray-800 tabular-nums dark:text-zinc-200">{Number(lead.valor) > 0 ? formatoReales(lead.valor) : '—'}</dd>
                  {(lead.etiquetas || []).length > 0 && (<>
                    <dt className="text-gray-400 dark:text-zinc-500">Etiquetas</dt>
                    <dd className="flex flex-wrap gap-1">
                      {lead.etiquetas.map(e => <span key={e} className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 dark:border-white/10 dark:text-zinc-400">{e}</span>)}
                    </dd>
                  </>)}
                </dl>
              )}

              {editando && form && (
                <div className="mt-4 space-y-3">
                  {[
                    { key: 'nombre', label: 'Nombre' },
                    { key: 'whatsapp', label: 'WhatsApp' },
                    { key: 'email', label: 'Email' },
                    ...(lead ? [{ key: 'origen', label: 'Origen' }] : []),
                    ...(cliente ? [
                      { key: 'pais', label: 'País' },
                      { key: 'ciudad', label: 'Ciudad' },
                      { key: 'cantidad_pasajeros', label: 'Cantidad de pasajeros', type: 'number' },
                    ] : []),
                  ].map(({ key, label, type }) => (
                    <div key={key}>
                      <label htmlFor={`ficha-${key}`} className={`${ETIQUETA} mb-1 block`}>{label}</label>
                      <input id={`ficha-${key}`} type={type || 'text'} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} className={CAMPO} />
                    </div>
                  ))}
                  {lead && (<>
                    <CampoInteres tipo={form.interes_tipo} destino={form.interes_destino} onChange={c => setForm(p => ({ ...p, ...c }))} />
                    <CampoEtiquetas etiquetas={form.etiquetas} onChange={etiquetas => setForm(p => ({ ...p, etiquetas }))} sugerencias={sugerenciasEtiquetas} />
                    <div>
                      <label htmlFor="ficha-valor" className={`${ETIQUETA} mb-1 block`}>Valor (R$)</label>
                      <input id="ficha-valor" type="number" min="0" step="0.01" inputMode="decimal" value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} className={`${CAMPO} tabular-nums`} />
                    </div>
                  </>)}
                  <button onClick={guardarPerfil} disabled={guardandoPerfil} className="w-full rounded-xl bg-gray-900 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
                    {guardandoPerfil ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              )}
            </section>

            {tareaEmergente && (
              <section className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/40">
                <Ic n="alert" className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-red-700 dark:text-red-400">{tareaEmergente.nota}</p>
                  <p className="text-xs text-red-500 dark:text-red-400/80">{tareaEmergente.fecha < hoyISO() ? 'Vencido' : 'Vence hoy'} · {fmtFecha(tareaEmergente.fecha)}</p>
                </div>
                <button onClick={() => completarRecordatorio(tareaEmergente.id)} className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600">
                  Marcar hecho
                </button>
              </section>
            )}

            <section className="dash-card grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xl font-bold text-gray-900 tabular-nums dark:text-zinc-100">{reservas.length}</p>
                <p className="text-[11px] text-gray-500 dark:text-zinc-500">Reservas</p>
              </div>
              <div>
                <p className="text-xl font-bold text-green-600 tabular-nums dark:text-green-400">{completadas}</p>
                <p className="text-[11px] text-gray-500 dark:text-zinc-500">Completadas</p>
              </div>
              <div>
                <p className="text-sm font-bold leading-6 text-amber-600 tabular-nums dark:text-amber-400">{totalPagado > 0 ? fmtMonto(totalPagado) : '—'}</p>
                <p className="text-[11px] text-gray-500 dark:text-zinc-500">Pagado</p>
              </div>
            </section>

            {lead && (
              <section className="dash-card">
                <p className={`${ETIQUETA} mb-3`}>Recordatorios</p>
                {pendientes.length === 0 && <p className="mb-3 text-sm text-gray-400 dark:text-zinc-600">Sin recordatorios pendientes.</p>}
                <div className="space-y-2">
                  {pendientes.map(r => (
                    <div key={r.id} className="flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/[0.03]">
                      <button onClick={() => completarRecordatorio(r.id)} title="Marcar como hecho" aria-label="Marcar como hecho"
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border border-gray-300 transition-colors hover:border-green-400 hover:bg-green-100 dark:border-zinc-600 dark:hover:bg-green-950/40" />
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-medium ${r.fecha < hoyISO() ? 'text-red-500 dark:text-red-400' : 'text-gray-700 dark:text-zinc-300'}`}>{fmtFecha(r.fecha)}</p>
                        <p className="break-words text-xs text-gray-500 dark:text-zinc-400">{r.nota}</p>
                      </div>
                      <button onClick={() => eliminarRecordatorio(r.id)} title="Eliminar" aria-label="Eliminar recordatorio" className="shrink-0 text-gray-300 hover:text-red-400 dark:text-zinc-600 dark:hover:text-red-400">×</button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <label htmlFor="ficha-rec-fecha" className="sr-only">Fecha del recordatorio</label>
                  <input id="ficha-rec-fecha" type="date" value={nuevoRecFecha} onChange={e => setNuevoRecFecha(e.target.value)} className={`${CAMPO} w-32 shrink-0 text-xs`} />
                  <label htmlFor="ficha-rec-nota" className="sr-only">Nota del recordatorio</label>
                  <input id="ficha-rec-nota" type="text" value={nuevoRecNota} onChange={e => setNuevoRecNota(e.target.value)} onKeyDown={e => e.key === 'Enter' && agregarRecordatorio()}
                    placeholder="Ej: Llamar para confirmar" className={`${CAMPO} min-w-0 flex-1 text-xs`} />
                  <button onClick={agregarRecordatorio} disabled={!nuevoRecNota.trim()} className={BOTON_OSCURO}>+</button>
                </div>
              </section>
            )}
          </div>

          {/* ── Columna derecha: todo lo operativo ── */}
          <div className="flex min-w-0 flex-1 flex-col gap-3 lg:overflow-y-auto">
            {vinculando || cargando ? (
              <div className="dash-card text-center text-sm text-gray-400 dark:text-zinc-600">Cargando...</div>
            ) : (
              <>
                {viajes.length > 0 && (
                  <section className="dash-card space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className={ETIQUETA}>Viaje de paquete{viajes.length > 1 ? ` · ${viajes.length}` : ''}</p>
                      <button onClick={() => navigate('/admin/paquetes/planilla')} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Ver en la Planilla</button>
                    </div>
                    {viajes.map(v => (
                      <div key={v.id} className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                        <div><p className="text-[11px] text-gray-400 dark:text-zinc-500">Llega</p><p className="font-medium text-gray-900 dark:text-zinc-100">{fechaCorta(v.fecha_llegada)}{v.hora_llegada ? ` · ${v.hora_llegada}` : ''}</p></div>
                        <div><p className="text-[11px] text-gray-400 dark:text-zinc-500">Regresa</p><p className="font-medium text-gray-900 dark:text-zinc-100">{fechaCorta(v.fecha_regreso)}{v.hora_regreso ? ` · ${v.hora_regreso}` : ''}</p></div>
                        <div><p className="text-[11px] text-gray-400 dark:text-zinc-500">Pasajeros</p><p className="font-medium text-gray-900 dark:text-zinc-100">{v.personas ?? '—'}</p></div>
                        <div><p className="text-[11px] text-gray-400 dark:text-zinc-500">Saldo</p><p className={`font-medium ${Number(v.saldo) > 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{formatMonto(v.saldo, v.moneda)}</p></div>
                        <div className="col-span-2 sm:col-span-4"><p className="text-[11px] text-gray-400 dark:text-zinc-500">Hospedaje</p><p className="text-gray-700 dark:text-zinc-300">{v.hospedaje || '—'}</p></div>
                        {v.observaciones && <div className="col-span-2 sm:col-span-4"><p className="text-[11px] text-gray-400 dark:text-zinc-500">Observaciones</p><p className="text-gray-700 dark:text-zinc-300">{v.observaciones}</p></div>}
                        {v.detalles_url && <a href={v.detalles_url} target="_blank" rel="noopener noreferrer" className="col-span-2 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Detalles y servicios (Canva)</a>}
                      </div>
                    ))}
                  </section>
                )}

                <section className="dash-card">
                  <SeccionSaldos
                    key={`${lead?.id || ''}-${cliente?.id || ''}`}
                    id={`${lead?.id || ''}-${cliente?.id || ''}`}
                    api={apiSaldos}
                    campo="persona"
                    conceptos={CONCEPTOS_SALDO}
                    conceptoInicial="paquetes"
                  />
                </section>

                {lead && (
                  <div className="grid gap-3 xl:grid-cols-2">
                    <section className="dash-card space-y-3">
                      <p className={ETIQUETA}>Vuelos</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="ficha-vuelo-ida" className={`${ETIQUETA} mb-1 block normal-case tracking-normal`}>Vuelo de ida</label>
                          <input id="ficha-vuelo-ida" type="date" value={vuelos.fecha_vuelo_ida} onChange={e => setVuelos(p => ({ ...p, fecha_vuelo_ida: e.target.value }))} className={CAMPO} />
                        </div>
                        <div>
                          <label htmlFor="ficha-vuelo-vuelta" className={`${ETIQUETA} mb-1 block normal-case tracking-normal`}>Vuelo de vuelta</label>
                          <input id="ficha-vuelo-vuelta" type="date" value={vuelos.fecha_vuelo_vuelta} onChange={e => setVuelos(p => ({ ...p, fecha_vuelo_vuelta: e.target.value }))} className={CAMPO} />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="ficha-vuelo-interno" className={`${ETIQUETA} mb-1 block normal-case tracking-normal`}>Vuelo interno</label>
                        <select id="ficha-vuelo-interno" value={vuelos.vuelo_interno} onChange={e => setVuelos(p => ({ ...p, vuelo_interno: e.target.value }))} className={CAMPO}>
                          <option value="">Elegí una opción</option>
                          <option value="recife_noronha">Recife – Fernando de Noronha</option>
                          <option value="no_hay">NO HAY</option>
                        </select>
                      </div>
                      {vuelos.vuelo_interno === 'recife_noronha' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="ficha-interno-ida" className={`${ETIQUETA} mb-1 block normal-case tracking-normal`}>Ida del vuelo interno</label>
                            <input id="ficha-interno-ida" type="date" value={vuelos.fecha_vuelo_interno_ida} onChange={e => setVuelos(p => ({ ...p, fecha_vuelo_interno_ida: e.target.value }))} className={CAMPO} />
                          </div>
                          <div>
                            <label htmlFor="ficha-interno-vuelta" className={`${ETIQUETA} mb-1 block normal-case tracking-normal`}>Vuelta del vuelo interno</label>
                            <input id="ficha-interno-vuelta" type="date" value={vuelos.fecha_vuelo_interno_vuelta} onChange={e => setVuelos(p => ({ ...p, fecha_vuelo_interno_vuelta: e.target.value }))} className={CAMPO} />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] text-gray-400 dark:text-zinc-500">Al guardar se crean las alarmas: saldo 45 días antes del vuelo de ida y check-in 48 hs antes de cada vuelo.</p>
                        <button onClick={guardarVuelos} disabled={guardandoVuelos} className={`${BOTON_OSCURO} shrink-0`}>{guardandoVuelos ? 'Guardando...' : 'Guardar vuelos'}</button>
                      </div>
                    </section>

                    <section className="dash-card">
                      <SeccionHospedajes key={`h-${lead.id}`} leadId={lead.id} propios={hospedajes.filter(h => h.lead_id === lead.id)} setHospedajes={setHospedajes} />
                    </section>
                  </div>
                )}

                <section className="dash-card">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className={ETIQUETA}>Reservas de paseos · {reservas.length}</p>
                    <button onClick={abrirNuevaReserva} className={`${BOTON_OSCURO} flex items-center gap-1.5`}>
                      <span className="text-sm leading-none">+</span> Nueva reserva
                    </button>
                  </div>
                  {reservas.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-zinc-600">
                      {cliente ? 'Sin reservas registradas.' : 'Todavía no tiene reservas. Al cargar la primera se crea su ficha de cliente.'}
                    </p>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-white/10">
                      {reservas.map(r => {
                        // Las de la planilla de paseos tienen su saldo cargado (o venta − seña)
                        const saldo = r.origen === 'planilla' ? (saldoDe(r) || 0) : Math.max((r.total || 0) - (r.pagado || 0), 0)
                        const estado = estadoEfectivo(r)
                        return (
                          <div key={r.id} className="py-3 first:pt-0 last:pb-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{nombrePaseo(r)}</p>
                                <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-500">
                                  <IcTxt n="cal" />{fmtFecha(r.fecha)} · <IcTxt n="users" />{r.personas} {r.personas === 1 ? 'persona' : 'personas'}
                                </p>
                                {r.hospedaje && <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-500"><IcTxt n="hotel" />{r.hospedaje}</p>}
                              </div>
                              <div className="shrink-0 text-right">
                                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${ESTADO_RESERVA[estado] || 'border-gray-100 bg-gray-50 text-gray-500 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-500'}`}>
                                  {ESTADO_RESERVA_LABEL[estado] || estado}
                                </span>
                                <p className="mt-1 text-sm font-bold text-gray-800 tabular-nums dark:text-zinc-200">{r.total ? fmtMonto(r.total, r.moneda) : '—'}</p>
                              </div>
                            </div>
                            {r.total > 0 && (
                              <div className="mt-2 flex items-center justify-between text-xs">
                                {saldo > 0
                                  ? <p className="text-gray-500 dark:text-zinc-500">Pendiente <span className="font-semibold text-amber-600 dark:text-amber-400">{fmtMonto(saldo, r.moneda || 'BRL')}</span></p>
                                  : <p className="font-semibold text-green-600 dark:text-green-400">Pagado por completo</p>}
                                {saldo > 0 && cliente && r.origen !== 'planilla' && <button onClick={() => setPagandoReserva(r)} className={ENLACE}>Registrar pago</button>}
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
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className={ETIQUETA}>Propuestas · {propuestas.length}</p>
                      <button onClick={() => { onCerrar(); navigate('/admin/paquetes/enviadas') }} className={ENLACE}>Ver propuestas</button>
                    </div>
                    {propuestas.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-zinc-600">Sin propuestas enviadas.</p>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-white/10">
                        {propuestas.map(p => (
                          <div key={p.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 tabular-nums dark:text-zinc-100">{fmtMonto(p.total, p.moneda)}</p>
                              <p className="text-xs text-gray-500 dark:text-zinc-500">{fmtFecha(p.created_at)}</p>
                            </div>
                            <span className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:border-white/10 dark:text-zinc-400">{ESTADO_PROPUESTA[p.estado] || p.estado}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="dash-card">
                    <p className={`${ETIQUETA} mb-3`}>Pagos · {pagos.length}</p>
                    {pagos.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-zinc-600">Sin pagos registrados.</p>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-white/10">
                        {pagos.map(p => (
                          <div key={p.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 tabular-nums dark:text-zinc-100">{fmtMonto(p.monto, p.moneda)}</p>
                              <p className="text-xs text-gray-500 dark:text-zinc-500">{p.metodo} · {fmtFecha(p.fecha_pago || p.created_at)}</p>
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${p.estado === 'confirmado' ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400'}`}>{p.estado}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                <section className="dash-card">
                  <p className={`${ETIQUETA} mb-3`}>Notas</p>
                  <div className="mb-4 flex gap-2">
                    <label htmlFor="ficha-nota" className="sr-only">Nota nueva</label>
                    <textarea id="ficha-nota" rows={2} value={nuevaNota} onChange={e => setNuevaNota(e.target.value)} placeholder="Agregar nota interna..."
                      className="min-w-0 flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100" />
                    <button onClick={agregarNota} disabled={!nuevaNota.trim()} className="self-end rounded-xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
                      Agregar
                    </button>
                  </div>
                  <div className="space-y-2">
                    {notas.map(n => (
                      <div key={n.id} className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/[0.03]">
                        <div className="min-w-0">
                          <p className="whitespace-pre-line break-words text-sm text-gray-800 dark:text-zinc-200">{n.contenido}</p>
                          <p className="mt-1 text-[11px] text-gray-400 dark:text-zinc-600">{n.autor && <span className="font-medium">{n.autor} · </span>}{new Date(n.created_at).toLocaleString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <button onClick={() => borrarNota(n.id)} aria-label="Borrar nota" className="shrink-0 text-sm text-gray-300 transition-colors hover:text-red-400 dark:text-zinc-700 dark:hover:text-red-400">×</button>
                      </div>
                    ))}
                    {lead?.notas && (
                      <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/[0.03]">
                        <p className="whitespace-pre-line break-words text-sm text-gray-800 dark:text-zinc-200">{lead.notas}</p>
                        <p className="mt-1 text-[11px] text-gray-400 dark:text-zinc-600">Notas del lead</p>
                      </div>
                    )}
                    {notas.length === 0 && !lead?.notas && <p className="text-sm text-gray-400 dark:text-zinc-600">Sin notas todavía.</p>}
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </div>

      {modalReserva && cliente && (
        <ModalReservaCliente cliente={cliente} onGuardar={crearReserva} onCerrar={() => setModalReserva(false)} />
      )}
      {pagandoReserva && cliente && (
        <ModalRegistrarPago
          reserva={pagandoReserva}
          clienteId={cliente.id}
          clienteNombre={cliente.nombre}
          onCerrar={() => setPagandoReserva(null)}
          onGuardado={(nuevoPagado, clienteActualizado) => {
            setReservas(prev => prev.map(r => r.id === pagandoReserva.id ? { ...r, pagado: nuevoPagado } : r))
            if (clienteActualizado) actualizarCliente(clienteActualizado)
            setPagandoReserva(null)
            pagosApi.getByCliente(cliente.id).then(({ data }) => setPagos(data || []))
          }}
        />
      )}
    </div>
  )
}
