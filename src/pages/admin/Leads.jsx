import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { leadsApi, clientesApi, recordatoriosApi, usuariosAdminApi } from '../../lib/supabase.js'
import { TIPOS_INTERES, DESTINOS_INTERES, detectarInteres, etiquetaInteres } from '../../../supabase/functions/_shared/interes.ts'
import Ic, { IcGrande, IcTxt } from '../../components/admin/dashboard/Ic.jsx'
import { useEtapas, etapaDe, claveVisible, estiloFondoEtapa } from '../../lib/embudo.js'
import AutomatizacionesEmbudo from '../../components/leads/AutomatizacionesEmbudo.jsx'

function hoyISO() { return new Date().toISOString().split('T')[0] }

// Tarjetas que se dibujan por etapa: el resto se ve con "Ver más". Con miles de
// leads en una misma etapa dibujarlos todos trabaría la pantalla.
const POR_ETAPA = 40

const CAMPO_RAPIDO = 'w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500'

// "Hoy 22:23" para lo de hoy; el resto, dd/mm/aaaa
function fechaTarjeta(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (d.toDateString() === new Date().toDateString()) {
    return `Hoy ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
  }
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function telefonoLegible(whatsapp) {
  const digitos = String(whatsapp || '').replace(/\D/g, '')
  return digitos ? `+${digitos}` : ''
}

// Nombre de la etapa con su color: punto y fondo tenue del mismo tono
function EtapaChip({ etapa }) {
  if (!etapa) return null
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-gray-800 dark:text-zinc-100" style={estiloFondoEtapa(etapa.color)}>
      <i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: etapa.color }} />
      <span className="truncate">{etapa.nombre}</span>
    </span>
  )
}

const FORM_VACIO = { nombre: '', whatsapp: '', interes_tipo: '', interes_destino: '', notas: '' }

// Tipo de servicio + destino. El destino es texto libre con sugerencias, porque
// un lead puede interesarse en más de uno ("Porto de Galinhas + Maragogi").
function CampoInteres({ tipo, destino, onChange, ayuda, grande }) {
  const campo = grande
    ? 'w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'
    : 'w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-500'
  return (
    <div>
      <label className={grande ? 'text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1' : 'text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1'}>Interés</label>
      <div className="grid grid-cols-2 gap-2">
        <select value={tipo || ''} onChange={e => onChange({ interes_tipo: e.target.value })} className={campo}>
          <option value="">— Tipo</option>
          {TIPOS_INTERES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <input
          type="text"
          list="destinos-interes"
          value={destino || ''}
          onChange={e => onChange({ interes_destino: e.target.value })}
          placeholder="Destino"
          className={campo}
        />
      </div>
      <datalist id="destinos-interes">
        {DESTINOS_INTERES.map(d => <option key={d} value={d} />)}
      </datalist>
      {ayuda && <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-1">{ayuda}</p>}
    </div>
  )
}

// Todo el dinero del sistema va en reales
const FORMATO_REALES = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
function formatoReales(n) {
  return FORMATO_REALES.format(Number(n) || 0)
}

// Etiquetas libres de un lead (VIVO, ENTRO POR PASEOS...): se escriben con
// Enter o coma, se quitan con la cruz y sugieren las que ya usan otros leads.
function CampoEtiquetas({ etiquetas, onChange, sugerencias }) {
  const [texto, setTexto] = useState('')

  function agregar(valor) {
    const limpio = valor.trim().replace(/\s+/g, ' ').slice(0, 30)
    setTexto('')
    if (!limpio || etiquetas.some(e => e.toLowerCase() === limpio.toLowerCase())) return
    onChange([...etiquetas, limpio])
  }

  return (
    <div>
      <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Etiquetas</label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2.5 py-2 focus-within:ring-2 focus-within:ring-brand-400/30 dark:border-zinc-700 dark:bg-zinc-800">
        {etiquetas.map(e => (
          <span key={e} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:border-white/15 dark:text-zinc-300">
            {e}
            <button
              type="button"
              onClick={() => onChange(etiquetas.filter(x => x !== e))}
              aria-label={`Quitar la etiqueta ${e}`}
              className="text-sm leading-none text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          list="etiquetas-leads"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); agregar(texto) }
            else if (e.key === 'Backspace' && !texto && etiquetas.length) onChange(etiquetas.slice(0, -1))
          }}
          onBlur={() => agregar(texto)}
          placeholder={etiquetas.length ? '' : 'Escribí y apretá Enter'}
          aria-label="Agregar una etiqueta"
          className="min-w-[90px] flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none dark:text-zinc-100 dark:placeholder-zinc-500"
        />
      </div>
      <datalist id="etiquetas-leads">
        {sugerencias.filter(x => !etiquetas.includes(x)).map(x => <option key={x} value={x} />)}
      </datalist>
    </div>
  )
}

export default function Leads() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('kanban')
  const [seleccionado, setSeleccionado] = useState(null)
  const [mostrarFormLead, setMostrarFormLead] = useState(false)
  const [formLead, setFormLead] = useState(FORM_VACIO)
  const [enviando, setEnviando] = useState(false)
  const [convirtiendo, setConvirtiendo] = useState(false)
  const [convertidoMsg, setConvertidoMsg] = useState('')
  const [clienteConvertidoId, setClienteConvertidoId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [guardandoLead, setGuardandoLead] = useState(false)
  const [eliminandoId, setEliminandoId] = useState(null)
  const [colArrastrando, setColArrastrando] = useState(null)
  const [recordatorios, setRecordatorios] = useState([])
  const [nuevoRecFecha, setNuevoRecFecha] = useState(hoyISO())
  const [nuevoRecNota, setNuevoRecNota] = useState('')
  const [guardandoRec, setGuardandoRec] = useState(false)
  const { etapas } = useEtapas()
  const [busqueda, setBusqueda] = useState('')
  const [soloActivos, setSoloActivos] = useState(true)
  const [rapidoAbierto, setRapidoAbierto] = useState(false)
  const [rapido, setRapido] = useState({ nombre: '', whatsapp: '' })
  const [guardandoRapido, setGuardandoRapido] = useState(false)
  const [verMas, setVerMas] = useState({}) // clave de etapa -> tarjetas visibles
  const [usuarios, setUsuarios] = useState([])
  const [panelAuto, setPanelAuto] = useState(false)

  useEffect(() => {
    async function cargar() {
      try {
        const [{ data: l }, { data: r }] = await Promise.all([
          leadsApi.getAll(),
          recordatoriosApi.getPendientes(),
        ])
        if (l) setLeads(l)
        if (r) setRecordatorios(r)
      } catch (_) {}
      setLoading(false)
    }
    cargar()
  }, [])

  // Personas del panel: para mostrar el responsable de cada lead
  useEffect(() => {
    usuariosAdminApi.getAll().then(({ ok, usuarios: lista }) => { if (ok) setUsuarios(lista || []) })
  }, [])

  // Las automatizaciones del embudo se cumplen en la base cuando el lead entra a
  // una etapa (recordatorios creados, responsable asignado): se relee el lead y
  // los recordatorios para verlo al instante. Solo si la migración ya está.
  async function refrescarLead(id) {
    if (!(leads[0] && 'responsable_id' in leads[0])) return
    const [{ data: lead }, { data: recs }] = await Promise.all([leadsApi.getById(id), recordatoriosApi.getPendientes()])
    if (lead) {
      setLeads(prev => prev.map(l => l.id === id ? lead : l))
      setSeleccionado(prev => (prev && prev.id === id ? lead : prev))
    }
    if (recs) setRecordatorios(recs)
  }

  function recordatoriosDeLead(leadId) {
    return recordatorios.filter(r => r.lead_id === leadId).sort((a, b) => a.fecha.localeCompare(b.fecha))
  }

  function proximoRecordatorio(leadId) {
    return recordatoriosDeLead(leadId)[0] || null
  }

  async function agregarRecordatorio() {
    if (!seleccionado || !nuevoRecNota.trim() || !nuevoRecFecha) return
    setGuardandoRec(true)
    const { data } = await recordatoriosApi.create({
      lead_id: seleccionado.id,
      fecha: nuevoRecFecha,
      nota: nuevoRecNota.trim(),
    })
    if (data) {
      setRecordatorios(prev => [...prev, data])
      setNuevoRecNota('')
      setNuevoRecFecha(hoyISO())
    }
    setGuardandoRec(false)
  }

  async function completarRecordatorio(id) {
    setRecordatorios(prev => prev.filter(r => r.id !== id))
    await recordatoriosApi.completar(id, true)
  }

  async function eliminarRecordatorio(id) {
    setRecordatorios(prev => prev.filter(r => r.id !== id))
    await recordatoriosApi.delete(id)
  }

  async function eliminarLead(id) {
    await leadsApi.delete(id)
    setLeads(prev => prev.filter(l => l.id !== id))
    setEliminandoId(null)
    if (seleccionado?.id === id) setSeleccionado(null)
  }

  async function cambiarEstado(id, nuevoEstado) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, estado: nuevoEstado } : l))
    await leadsApi.updateEstado(id, nuevoEstado, null)
    refrescarLead(id)
  }

  function soltarEnColumna(e, col) {
    e.preventDefault()
    setColArrastrando(null)
    const id = e.dataTransfer.getData('text/plain')
    const lead = leads.find(l => l.id === id)
    if (lead && lead.estado !== col) cambiarEstado(id, col)
  }

  function cerrarRapido() {
    setRapidoAbierto(false)
    setRapido({ nombre: '', whatsapp: '' })
  }

  // "Lead rápido": solo el nombre (el WhatsApp es opcional) y entra en la primera etapa
  async function guardarRapido() {
    const nombre = rapido.nombre.trim()
    if (!nombre || guardandoRapido) return
    setGuardandoRapido(true)
    const digitos = rapido.whatsapp.replace(/\D/g, '')
    const { data, error } = await leadsApi.create({
      nombre,
      whatsapp: digitos || null,
      origen: 'Manual',
      estado: 'nuevo',
    })
    if (!error && data) {
      setLeads(prev => [data, ...prev])
      cerrarRapido()
      refrescarLead(data.id)
    } else {
      alert('No se pudo guardar el lead. Revisá la conexión.')
    }
    setGuardandoRapido(false)
  }

  // Punto de seguimiento de la tarjeta: rojo = recordatorio vencido, verde =
  // programado, naranja = todavía no tiene próximo paso. Las perdidas no lo llevan.
  function seguimientoDe(lead, etapa) {
    if (etapa?.tipo === 'perdida') return null
    const r = proximoRecordatorio(lead.id)
    if (!r) return { color: 'bg-amber-400', texto: 'Sin recordatorio: falta definir el próximo paso' }
    if (r.fecha < hoyISO()) return { color: 'bg-red-500', texto: `Recordatorio vencido: ${r.nota}` }
    const cuando = r.fecha === hoyISO() ? 'Hoy' : new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    return { color: 'bg-green-500', texto: `${cuando}: ${r.nota}` }
  }

  async function registrarLead() {
    if (!formLead.nombre.trim() || !formLead.whatsapp.trim()) return
    setEnviando(true)
    // Si no se eligió el interés, se intenta reconocer en las notas del lead.
    const detectado = detectarInteres(formLead.notas)
    const { data, error } = await leadsApi.create({
      nombre: formLead.nombre,
      whatsapp: formLead.whatsapp,
      interes_tipo: formLead.interes_tipo || detectado.tipo || null,
      interes_destino: formLead.interes_destino.trim() || detectado.destino || null,
      notas: formLead.notas,
      origen: 'WhatsApp',
      estado: 'nuevo',
    })
    if (!error && data) {
      setLeads(prev => [data, ...prev])
      refrescarLead(data.id)
      setMostrarFormLead(false)
      setFormLead(FORM_VACIO)
    } else {
      alert('Error al guardar. Revisá la conexión.')
    }
    setEnviando(false)
  }

  function abrirLead(lead) {
    setSeleccionado(lead)
    setConvertidoMsg('')
    setClienteConvertidoId(null)
    setEditForm({
      nombre: lead.nombre || '',
      whatsapp: lead.whatsapp || '',
      email: lead.email || '',
      interes_tipo: lead.interes_tipo || '',
      interes_destino: lead.interes_destino || '',
      origen: lead.origen || '',
      estado: claveVisible(etapas, lead.estado) || 'nuevo',
      notas: lead.notas || '',
      valor: lead.valor ?? 0,
      etiquetas: lead.etiquetas || [],
      responsable_id: lead.responsable_id || '',
    })
  }

  async function guardarLead() {
    if (!editForm.nombre.trim()) return
    setGuardandoLead(true)
    // valor y etiquetas solo se mandan si la base ya tiene esas columnas
    const { valor, etiquetas, responsable_id, ...basicos } = editForm
    const extras = 'valor' in seleccionado
      ? { valor: Math.max(0, Number(String(valor).replace(',', '.')) || 0), etiquetas }
      : {}
    if ('responsable_id' in seleccionado) extras.responsable_id = responsable_id || null
    const { data } = await leadsApi.update(seleccionado.id, {
      ...basicos,
      ...extras,
      interes_tipo: editForm.interes_tipo || null,
      interes_destino: editForm.interes_destino.trim() || null,
    })
    if (data) {
      setLeads(prev => prev.map(l => l.id === data.id ? data : l))
      setSeleccionado(data)
      if (data.estado !== seleccionado.estado) refrescarLead(data.id)
    }
    setGuardandoLead(false)
  }

  async function convertirACliente(lead) {
    setConvirtiendo(true)
    setConvertidoMsg('')
    const phone = (lead.whatsapp || '').replace(/\D/g, '')

    // Ver si ya existe como cliente
    const { data: existente } = await clientesApi.getByWhatsapp(phone)
    if (existente) {
      setConvertidoMsg('ya_existe')
      setClienteConvertidoId(existente.id)
      setConvirtiendo(false)
      return
    }

    const { data } = await clientesApi.create({
      nombre: lead.nombre,
      whatsapp: phone,
      email: lead.email || null,
    })

    if (data) {
      await cambiarEstado(lead.id, 'reservado')
      setSeleccionado(p => ({ ...p, estado: 'reservado' }))
      setConvertidoMsg('ok')
      setClienteConvertidoId(data.id)
    }
    setConvirtiendo(false)
  }

  async function guardarNota(id, notas) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, notas } : l))
    await leadsApi.updateEstado(id, leads.find(l => l.id === id)?.estado, notas)
  }

  if (loading) return <div className="p-8 text-gray-400 dark:text-zinc-500">Cargando leads...</div>

  const nombreUsuario = id => (id ? usuarios.find(u => u.id === id)?.nombre || '' : '')
  const autoDisponibles = leads.length > 0 && 'responsable_id' in leads[0]

  // Etapas a mostrar y leads que pasan el filtro. "Activos" oculta las perdidas.
  const etapasVisibles = etapas.filter(e => !soloActivos || e.tipo !== 'perdida')
  const textoBusqueda = busqueda.trim().toLowerCase()
  const visibles = leads.filter(l => {
    if (soloActivos && etapaDe(etapas, claveVisible(etapas, l.estado))?.tipo === 'perdida') return false
    if (!textoBusqueda) return true
    return [l.nombre, l.whatsapp, l.notas, l.origen, etiquetaInteres(l), (l.etiquetas || []).join(' '), nombreUsuario(l.responsable_id)].some(v => String(v || '').toLowerCase().includes(textoBusqueda))
  })
  const totalValor = visibles.reduce((t, l) => t + (Number(l.valor) || 0), 0)
  // Las columnas nuevas (valor, etiquetas) existen recién cuando se aplicó la migración
  const extrasDisponibles = leads.length > 0 && 'valor' in leads[0]
  const todasLasEtiquetas = [...new Set(leads.flatMap(l => l.etiquetas || []))].sort((a, b) => a.localeCompare(b))

  return (
    <div>
      {/* Barra superior: título, vista, filtro y alta */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="mr-1">
          <h1 className="text-base font-extrabold uppercase tracking-wide text-gray-900 dark:text-white">Embudo de ventas</h1>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            {visibles.length} {visibles.length === 1 ? 'lead' : 'leads'}{soloActivos ? ' activos' : ''}: {formatoReales(totalValor)}
          </p>
        </div>

        <div className="flex items-center gap-0.5 rounded-xl bg-gray-100 p-1 dark:bg-white/[0.06]" role="tablist" aria-label="Vista">
          {[['kanban', 'Tablero', 'columns'], ['tabla', 'Lista', 'list']].map(([v, nombre, icono]) => (
            <button
              key={v}
              role="tab"
              aria-selected={vista === v}
              onClick={() => setVista(v)}
              title={nombre}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${vista === v ? 'bg-gray-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900' : 'text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-white'}`}
            >
              <Ic n={icono} className="h-3.5 w-3.5" />{nombre}
            </button>
          ))}
        </div>

        <div className="flex min-w-[240px] flex-1 items-center gap-2">
          <button
            onClick={() => setSoloActivos(v => !v)}
            aria-pressed={soloActivos}
            title={soloActivos ? 'Ocultando los perdidos. Clic para ver todos' : 'Mostrando todos. Clic para ocultar los perdidos'}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${soloActivos ? 'bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'border border-gray-300 text-gray-600 dark:border-zinc-600 dark:text-zinc-300'}`}
          >
            {soloActivos ? 'Leads activos' : 'Todos los leads'}
          </button>
          <div className="relative min-w-0 flex-1">
            <Ic n="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar y filtrar"
              aria-label="Buscar leads"
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
          </div>
        </div>

        <button
          onClick={() => setPanelAuto(true)}
          title="Acciones que el sistema hace solo cuando un lead entra a una etapa"
          className="ml-auto flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <Ic n="bolt" className="h-4 w-4" />Automatizar
        </button>

        <button
          onClick={() => setMostrarFormLead(true)}
          className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
        >
          <Ic n="plus" className="h-4 w-4" />Nuevo lead
        </button>
      </div>

      {vista === 'kanban' && (
        <div className="flex items-start gap-3 overflow-x-auto pb-4">
          {etapasVisibles.map(etapa => {
            const enEtapa = visibles.filter(l => claveVisible(etapas, l.estado) === etapa.clave)
            const mostrados = enEtapa.slice(0, verMas[etapa.clave] || POR_ETAPA)
            const restantes = enEtapa.length - mostrados.length
            const valorEtapa = enEtapa.reduce((t, l) => t + (Number(l.valor) || 0), 0)
            return (
              <div
                key={etapa.clave}
                className={`w-[212px] shrink-0 rounded-xl transition-colors ${colArrastrando === etapa.clave ? 'bg-black/[0.04] ring-2 ring-brand-400 dark:bg-white/[0.05]' : ''}`}
                onDragOver={e => { e.preventDefault(); if (colArrastrando !== etapa.clave) setColArrastrando(etapa.clave) }}
                onDragLeave={() => setColArrastrando(prev => (prev === etapa.clave ? null : prev))}
                onDrop={e => soltarEnColumna(e, etapa.clave)}
              >
                <div className="border-t-[3px] px-1 pb-2 pt-2 text-center" style={{ borderTopColor: etapa.color }}>
                  <p className="truncate text-[11px] font-extrabold uppercase tracking-wide text-gray-800 dark:text-zinc-100" title={etapa.nombre}>{etapa.nombre}</p>
                  <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-zinc-400">{enEtapa.length} {enEtapa.length === 1 ? 'lead' : 'leads'}: {formatoReales(valorEtapa)}</p>
                </div>

                <div className="max-h-[calc(100vh-17rem)] min-h-[5rem] space-y-2 overflow-y-auto pb-1">
                  {etapa.clave === 'nuevo' && (
                    rapidoAbierto ? (
                      <div className="rounded-lg border border-gray-300 bg-white p-2.5 shadow-sm dark:border-white/15 dark:bg-zinc-900">
                        <input
                          autoFocus
                          type="text"
                          value={rapido.nombre}
                          onChange={e => setRapido(p => ({ ...p, nombre: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') guardarRapido(); if (e.key === 'Escape') cerrarRapido() }}
                          placeholder="Nombre del lead"
                          aria-label="Nombre del lead"
                          className={CAMPO_RAPIDO}
                        />
                        <input
                          type="text"
                          value={rapido.whatsapp}
                          onChange={e => setRapido(p => ({ ...p, whatsapp: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') guardarRapido(); if (e.key === 'Escape') cerrarRapido() }}
                          placeholder="WhatsApp (opcional)"
                          aria-label="WhatsApp del lead"
                          className={`${CAMPO_RAPIDO} mt-1.5`}
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={guardarRapido}
                            disabled={guardandoRapido || !rapido.nombre.trim()}
                            className="flex-1 rounded-lg bg-gray-900 py-1.5 text-xs font-bold text-white transition-colors hover:bg-gray-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                          >
                            {guardandoRapido ? 'Guardando...' : 'Agregar'}
                          </button>
                          <button
                            onClick={cerrarRapido}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRapidoAbierto(true)}
                        className="w-full rounded-lg border border-dashed border-gray-300 py-2.5 text-xs font-semibold text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700 dark:border-white/20 dark:text-zinc-400 dark:hover:border-white/40 dark:hover:text-zinc-200"
                      >
                        Lead rápido
                      </button>
                    )
                  )}

                  {mostrados.map(lead => {
                    const seguimiento = seguimientoDe(lead, etapa)
                    const interes = etiquetaInteres(lead)
                    const chip = 'max-w-full truncate rounded border border-gray-200 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-zinc-400'
                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={e => e.dataTransfer.setData('text/plain', lead.id)}
                        onClick={() => abrirLead(lead)}
                        className="group cursor-grab rounded-lg border border-gray-200 bg-white px-2.5 py-2 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing dark:border-white/[0.08] dark:bg-zinc-900 dark:shadow-none"
                      >
                        <div className="flex items-baseline justify-between gap-2 text-[11px] text-gray-500 dark:text-zinc-400">
                          <span className="truncate">{telefonoLegible(lead.whatsapp) || lead.origen || 'Sin teléfono'}</span>
                          <span className="shrink-0 tabular-nums">{fechaTarjeta(lead.created_at)}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[13px] font-extrabold uppercase text-sky-700 dark:text-sky-400" title={lead.nombre}>{lead.nombre}</p>
                        {Number(lead.valor) > 0 && (
                          <p className="text-[11px] font-bold tabular-nums text-gray-700 dark:text-zinc-200">{formatoReales(lead.valor)}</p>
                        )}

                        <div className="mt-1.5 flex min-h-[18px] items-center gap-1.5">
                          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                            {(lead.etiquetas || []).slice(0, 3).map(e => <span key={e} className={chip} title={e}>{e}</span>)}
                            {(lead.etiquetas || []).length > 3 && <span className={chip} title={lead.etiquetas.slice(3).join(', ')}>+{lead.etiquetas.length - 3}</span>}
                            {interes && <span className={chip}>{interes}</span>}
                            {lead.origen && lead.origen !== 'WhatsApp' && <span className={chip}>{lead.origen}</span>}
                          </div>
                          {eliminandoId === lead.id ? (
                            <span className="flex shrink-0 items-center gap-1.5 text-[11px]" onClick={e => e.stopPropagation()}>
                              <span className="text-gray-500 dark:text-zinc-400">¿Eliminar?</span>
                              <button onClick={() => eliminarLead(lead.id)} className="font-bold text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">Sí</button>
                              <button onClick={() => setEliminandoId(null)} className="text-gray-400 dark:text-zinc-500">No</button>
                            </span>
                          ) : (
                            <span className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                              {lead.whatsapp && (
                                <button
                                  onClick={e => { e.stopPropagation(); navigate(`/admin/crm/whatsapp?phone=${lead.whatsapp}`) }}
                                  title="Abrir el chat de WhatsApp"
                                  className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                                >
                                  <Ic n="chat" className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                onClick={e => { e.stopPropagation(); setEliminandoId(lead.id) }}
                                title="Eliminar"
                                className="text-gray-300 transition-colors hover:text-red-400 dark:text-zinc-600 dark:hover:text-red-400"
                              >
                                <Ic n="trash" className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          )}
                          {seguimiento && <span title={seguimiento.texto} className={`h-2 w-2 shrink-0 rounded-full ${seguimiento.color}`} />}
                          {nombreUsuario(lead.responsable_id) && (
                            <span
                              title={`Responsable: ${nombreUsuario(lead.responsable_id)}`}
                              className="grid h-[18px] w-[18px] shrink-0 place-content-center rounded-full bg-gray-200 text-[10px] font-extrabold text-gray-700 dark:bg-white/15 dark:text-zinc-100"
                            >
                              {nombreUsuario(lead.responsable_id)[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {restantes > 0 && (
                    <button
                      onClick={() => setVerMas(prev => ({ ...prev, [etapa.clave]: (prev[etapa.clave] || POR_ETAPA) + POR_ETAPA }))}
                      className="w-full rounded-lg py-2 text-xs font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
                    >
                      Ver {Math.min(restantes, POR_ETAPA)} más ({restantes} sin mostrar)
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {vista === 'tabla' && visibles.length === 0 && (
        <div className="py-16 text-center text-gray-400 dark:text-zinc-500">
          <IcGrande n="target" />
          <p>{leads.length === 0 ? 'Aún no hay leads. Aparecerán acá cuando alguien escriba por WhatsApp o complete el formulario de reserva.' : 'Ningún lead coincide con el filtro.'}</p>
        </div>
      )}

      {vista === 'tabla' && visibles.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-800/60 text-gray-500 dark:text-zinc-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">Nombre</th>
                <th className="px-5 py-3 text-left">Interés</th>
                <th className="px-5 py-3 text-left">Etiquetas</th>
                <th className="px-5 py-3 text-right">Valor</th>
                <th className="px-5 py-3 text-left">Origen</th>
                <th className="px-5 py-3 text-left">Fecha</th>
                <th className="px-5 py-3 text-left">Estado</th>
                <th className="px-5 py-3 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
              {visibles.map(lead => {
                const etapa = etapaDe(etapas, claveVisible(etapas, lead.estado))
                return (
                  <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-zinc-100">{lead.nombre}</td>
                    <td className="px-5 py-3 text-gray-500 dark:text-zinc-400">{etiquetaInteres(lead)}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(lead.etiquetas || []).map(e => (
                          <span key={e} className="rounded border border-gray-200 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-zinc-400">{e}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-xs tabular-nums text-gray-600 dark:text-zinc-300">{Number(lead.valor) > 0 ? formatoReales(lead.valor) : ''}</td>
                    <td className="px-5 py-3 text-gray-500 dark:text-zinc-400">{lead.origen}</td>
                    <td className="px-5 py-3 text-gray-400 dark:text-zinc-500 text-xs">{new Date(lead.created_at).toLocaleDateString('es-AR')}</td>
                    <td className="px-5 py-3">
                      <select value={claveVisible(etapas, lead.estado)} onChange={e => cambiarEstado(lead.id, e.target.value)}
                        style={etapa ? estiloFondoEtapa(etapa.color) : undefined}
                        className="max-w-[220px] cursor-pointer rounded-full border-0 px-2.5 py-1 text-xs font-bold text-gray-800 outline-none dark:text-zinc-100">
                        {etapas.map(e => <option key={e.clave} value={e.clave} className="bg-white text-gray-900 dark:bg-zinc-900 dark:text-zinc-100">{e.nombre}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {lead.whatsapp && <button onClick={() => navigate(`/admin/crm/whatsapp?phone=${lead.whatsapp}`)} className="text-green-500 dark:text-green-400"><Ic n="chat" className="h-4 w-4" /></button>}
                        <button onClick={() => abrirLead(lead)} className="text-xs font-medium text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100">Ver</button>
                        {eliminandoId === lead.id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-400 dark:text-zinc-500">¿Eliminar?</span>
                            <button onClick={() => eliminarLead(lead.id)} className="text-xs font-semibold text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">Sí</button>
                            <button onClick={() => setEliminandoId(null)} className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300">No</button>
                          </div>
                        ) : (
                          <button onClick={() => setEliminandoId(lead.id)} className="text-gray-300 dark:text-zinc-600 hover:text-red-400 dark:hover:text-red-400 transition-colors" title="Eliminar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {mostrarFormLead && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl dark:shadow-black/40 p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg text-gray-900 dark:text-zinc-100">Nuevo lead</h2>
              <button onClick={() => setMostrarFormLead(false)} className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">Nombre *</label>
                <input type="text" value={formLead.nombre} onChange={e => setFormLead({...formLead, nombre: e.target.value})}
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="Ej: María González" autoFocus />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">WhatsApp *</label>
                <input type="text" value={formLead.whatsapp} onChange={e => setFormLead({...formLead, whatsapp: e.target.value})}
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  placeholder="Ej: 5491112345678" />
              </div>
              <CampoInteres
                tipo={formLead.interes_tipo}
                destino={formLead.interes_destino}
                onChange={cambios => setFormLead(p => ({ ...p, ...cambios }))}
                ayuda="Si lo dejás vacío se reconoce solo a partir de las notas."
                grande
              />
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1">Notas</label>
                <textarea value={formLead.notas} onChange={e => setFormLead({...formLead, notas: e.target.value})}
                  rows={3}
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                  placeholder="Ej: Quiere ir en julio, grupo de 4 personas..." />
              </div>
            </div>
            <button onClick={registrarLead} disabled={enviando}
              className="mt-5 w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
              {enviando ? 'Guardando...' : 'Guardar lead'}
            </button>
          </div>
        </div>
      )}

      {seleccionado && editForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
          <div className="bg-white dark:bg-zinc-900 w-96 h-full shadow-xl dark:shadow-black/40 flex flex-col" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
              <h2 className="font-bold text-lg text-gray-900 dark:text-zinc-100">Lead</h2>
              <button onClick={() => { setSeleccionado(null); setConvertidoMsg('') }} className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 text-xl">✕</button>
            </div>

            {/* Campos editables */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {[
                { key: 'nombre',    label: 'Nombre',    type: 'text', placeholder: 'Nombre completo' },
                { key: 'whatsapp',  label: 'WhatsApp',  type: 'text', placeholder: '5491155554444' },
                { key: 'email',     label: 'Email',     type: 'text', placeholder: 'correo@email.com' },
                { key: 'origen',    label: 'Origen',    type: 'text', placeholder: 'WhatsApp, Instagram...' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">{label}</label>
                  <input
                    type="text"
                    value={editForm[key]}
                    onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-500"
                  />
                </div>
              ))}

              <CampoInteres
                tipo={editForm.interes_tipo}
                destino={editForm.interes_destino}
                onChange={cambios => setEditForm(p => ({ ...p, ...cambios }))}
                ayuda={!seleccionado.interes_tipo && !seleccionado.interes_destino && seleccionado.excursion_interes
                  ? 'Antes: ' + seleccionado.excursion_interes : undefined}
              />

              {extrasDisponibles && (
                <>
                  <CampoEtiquetas
                    etiquetas={editForm.etiquetas}
                    onChange={etiquetas => setEditForm(p => ({ ...p, etiquetas }))}
                    sugerencias={todasLasEtiquetas}
                  />
                  <div>
                    <label htmlFor="valor-lead" className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Valor (R$)</label>
                    <input
                      id="valor-lead"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={editForm.valor}
                      onChange={e => setEditForm(p => ({ ...p, valor: e.target.value }))}
                      placeholder="0,00"
                      className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-500"
                    />
                  </div>
                </>
              )}

              {autoDisponibles && (
                <div>
                  <label htmlFor="responsable-lead" className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Responsable</label>
                  <select
                    id="responsable-lead"
                    value={editForm.responsable_id}
                    onChange={e => setEditForm(p => ({ ...p, responsable_id: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-500"
                  >
                    <option value="">Sin responsable</option>
                    {usuarios.filter(u => u.activo !== false).map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Etapa del embudo</label>
                <select
                  value={editForm.estado}
                  onChange={e => setEditForm(p => ({ ...p, estado: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-500"
                >
                  {etapas.map(e => <option key={e.clave} value={e.clave}>{e.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Notas</label>
                <textarea
                  rows={4}
                  value={editForm.notas}
                  onChange={e => setEditForm(p => ({ ...p, notas: e.target.value }))}
                  placeholder="Observaciones, preferencias, detalles..."
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-500 resize-none"
                />
              </div>

              {/* Guardar cambios */}
              <button
                onClick={guardarLead}
                disabled={guardandoLead}
                className="w-full bg-gray-900 dark:bg-zinc-100 hover:bg-gray-700 dark:hover:bg-zinc-300 disabled:opacity-50 text-white dark:text-zinc-900 font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                {guardandoLead ? 'Guardando...' : 'Guardar cambios'}
              </button>

              {/* Recordatorios de seguimiento */}
              <div className="border-t border-gray-100 dark:border-zinc-800 pt-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Recordatorios de seguimiento</p>

                {recordatoriosDeLead(seleccionado.id).length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-zinc-500">Sin recordatorios pendientes.</p>
                )}

                <div className="space-y-2">
                  {recordatoriosDeLead(seleccionado.id).map(r => (
                    <div key={r.id} className="flex items-start gap-2 bg-gray-50 dark:bg-zinc-800/60 rounded-xl px-3 py-2">
                      <button
                        onClick={() => completarRecordatorio(r.id)}
                        title="Marcar como hecho"
                        className="mt-0.5 w-4 h-4 rounded border border-gray-300 dark:border-zinc-600 shrink-0 hover:bg-green-100 dark:hover:bg-green-950/40 hover:border-green-400 transition-colors"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium ${r.fecha < hoyISO() ? 'text-red-500 dark:text-red-400' : 'text-gray-700 dark:text-zinc-300'}`}>
                          {new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 break-words">{r.nota}</p>
                      </div>
                      <button onClick={() => eliminarRecordatorio(r.id)} className="text-gray-300 dark:text-zinc-600 hover:text-red-400 dark:hover:text-red-400 shrink-0" title="Eliminar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="date"
                    value={nuevoRecFecha}
                    onChange={e => setNuevoRecFecha(e.target.value)}
                    className="border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400 w-32 shrink-0"
                  />
                  <input
                    type="text"
                    value={nuevoRecNota}
                    onChange={e => setNuevoRecNota(e.target.value)}
                    placeholder="Ej: Llamar para confirmar fechas"
                    onKeyDown={e => e.key === 'Enter' && agregarRecordatorio()}
                    className="flex-1 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <button
                    onClick={agregarRecordatorio}
                    disabled={guardandoRec || !nuevoRecNota.trim()}
                    className="bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-semibold px-3 rounded-xl transition-colors shrink-0"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-zinc-800 pt-4 space-y-3">
                {/* Convertir a cliente */}
                {convertidoMsg === 'ok' && (
                  <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm px-4 py-3 rounded-xl">
                    Convertido a cliente correctamente
                  </div>
                )}
                {convertidoMsg === 'ya_existe' && (
                  <div className="bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 text-sm px-4 py-3 rounded-xl">
                    Ya existe como cliente con ese WhatsApp
                  </div>
                )}
                <button
                  onClick={() => convertirACliente(seleccionado)}
                  disabled={convirtiendo || convertidoMsg === 'ok'}
                  className="w-full flex items-center justify-center gap-2 bg-brand-600 dark:bg-zinc-100 hover:bg-brand-700 dark:hover:bg-zinc-200 disabled:opacity-50 text-white dark:text-zinc-900 font-semibold py-2.5 rounded-xl transition-colors text-sm"
                >
                  {convirtiendo ? 'Convirtiendo...' : convertidoMsg === 'ok' ? 'Ya es cliente' : 'Convertir a cliente'}
                </button>

                {clienteConvertidoId && (
                  <button
                    onClick={() => navigate(`/admin/clientes?cliente=${clienteConvertidoId}`)}
                    className="w-full flex items-center justify-center gap-2 bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
                  >
                    Ver perfil del cliente
                  </button>
                )}

                {seleccionado.whatsapp && (
                  <button
                    onClick={() => { setSeleccionado(null); setConvertidoMsg(''); navigate(`/admin/crm/whatsapp?phone=${seleccionado.whatsapp}`) }}
                    className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
                  >
                    Abrir en WhatsApp
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {panelAuto && <AutomatizacionesEmbudo etapas={etapas} usuarios={usuarios} alCerrar={() => setPanelAuto(false)} />}
    </div>
  )
}
