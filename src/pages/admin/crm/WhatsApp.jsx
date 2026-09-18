import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase, conversacionesApi, mensajesApi, leadsApi, usuariosAdminApi, respuestasRapidasApi, clientesApi, reservasClienteApi, reservasApi, propuestasApi, excursionesApi, enviarWhatsApp, sincronizarWhatsApp } from '../../../lib/supabase.js'
import ModalNuevaReserva from '../../../components/ui/ModalNuevaReserva.jsx'

const ETIQUETAS = {
  lead:        { label: 'Lead',        color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',    dot: 'bg-blue-500',   creaLead: true  },
  interesado:  { label: 'Interesado',  color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',  dot: 'bg-amber-400',  creaLead: false },
  cliente:     { label: 'Cliente',     color: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',  dot: 'bg-green-500',  creaLead: false },
  no_interesa: { label: 'No interesa', color: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',      dot: 'bg-red-400',    creaLead: false },
}

function formatTiempo(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const mins = Math.floor((Date.now() - d) / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function formatHora(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function formatPhone(phone) {
  if (!phone) return ''
  const d = phone.replace(/\D/g, '')
  // Argentina: 54 9 XXX XXXXXXX
  if (d.startsWith('54') && d.length >= 12) {
    return `+54 9 ${d.slice(3, 6)} ${d.slice(6, 10)}-${d.slice(10)}`
  }
  return `+${d}`
}

function Avatar({ nombre, size = 'md' }) {
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base'
  return (
    <div className={`${sizeClass} rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center font-bold text-green-700 dark:text-green-400 shrink-0`}>
      {(nombre || '?')[0].toUpperCase()}
    </div>
  )
}

export default function WhatsAppCRM() {
  const navigate = useNavigate()
  const [conversaciones, setConversaciones] = useState([])
  const [seleccionada, setSeleccionada] = useState(null)
  const [mensajes, setMensajes] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [etiquetando, setEtiquetando] = useState(false)
  const [menuEtiqueta, setMenuEtiqueta] = useState(false)
  const [usuarios, setUsuarios] = useState([])
  const [miUsuarioId, setMiUsuarioId] = useState(null)
  const [asignando, setAsignando] = useState(false)
  const [menuAsignar, setMenuAsignar] = useState(false)
  const [filtroAsignacion, setFiltroAsignacion] = useState('todas') // todas | sin_asignar | mias
  const [respuestasRapidas, setRespuestasRapidas] = useState([])
  const [menuRespuestas, setMenuRespuestas] = useState(false)
  const [panelCliente, setPanelCliente] = useState(false)
  const [clienteVinculado, setClienteVinculado] = useState(null)
  const [reservasCliente, setReservasCliente] = useState([])
  const [propuestasCliente, setPropuestasCliente] = useState([])
  const [cargandoCliente, setCargandoCliente] = useState(false)
  const [excursiones, setExcursiones] = useState([])
  const [modalReserva, setModalReserva] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const chatBottomRef = useRef(null)
  const inputRef = useRef(null)
  const menuEtiquetaRef = useRef(null)
  const menuAsignarRef = useRef(null)
  const menuRespuestasRef = useRef(null)

  // Cargar respuestas rápidas activas
  useEffect(() => {
    respuestasRapidasApi.getAll().then(({ data }) => {
      setRespuestasRapidas((data || []).filter(r => r.activo))
    })
  }, [])

  // Cargar excursiones (para el modal de Nueva reserva)
  useEffect(() => {
    excursionesApi.getAll().then(({ data }) => setExcursiones(data || []))
  }, [])

  async function crearReservaDesdeChat(form) {
    const personas = (parseInt(form.adultos) || 0) + (parseInt(form.menores) || 0)
    const { data } = await reservasApi.create({
      cliente_nombre: form.cliente_nombre,
      cliente_whatsapp: form.cliente_whatsapp.replace(/\D/g, ''),
      cliente_id: form.cliente_id || null,
      excursion_id: form.excursion_id || null,
      fecha: form.fecha || null,
      adultos: parseInt(form.adultos) || 0,
      menores: parseInt(form.menores) || 0,
      personas,
      hospedaje: form.hospedaje || null,
      ubicacion: form.ubicacion || null,
      total: parseInt(form.total) || null,
      moneda: form.moneda,
      estado: form.estado,
      notas: form.notas || null,
    })
    if (data) {
      setReservasCliente(prev => [data, ...prev])
      setModalReserva(false)
    }
  }

  // Cargar usuarios del panel (para asignar conversaciones) y resolver "mi usuario"
  useEffect(() => {
    usuariosAdminApi.getAll().then(({ ok, usuarios: lista }) => {
      if (!ok) return
      setUsuarios(lista || [])
      try {
        const sesion = JSON.parse(localStorage.getItem('admin_session') || '{}')
        const yo = (lista || []).find(u => u.email === sesion.email)
        if (yo) setMiUsuarioId(yo.id)
      } catch (_) { /* sin sesión parseable, queda sin "mías" */ }
    })
  }, [])

  // Cargar conversaciones + suscripción realtime
  useEffect(() => {
    conversacionesApi.getAll().then(({ data }) => {
      if (data) setConversaciones(data)
      setLoading(false)
    })

    if (!supabase) return
    const channel = supabase
      .channel('crm-conversaciones')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setConversaciones(prev => [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setConversaciones(prev =>
            [...prev.map(c => c.id === payload.new.id ? payload.new : c)]
              .sort((a, b) => new Date(b.ultimo_mensaje_at) - new Date(a.ultimo_mensaje_at))
          )
        }
      })
      .subscribe()

    return () => channel.unsubscribe()
  }, [])

  // Auto-seleccionar conversación si viene ?phone= desde Leads
  useEffect(() => {
    const phone = searchParams.get('phone')
    if (!phone || !conversaciones.length) return
    const match = conversaciones.find(c => c.whatsapp?.replace(/\D/g, '') === phone.replace(/\D/g, ''))
    if (match) {
      setSeleccionada(match)
      setSearchParams({}, { replace: true })
    }
  }, [conversaciones, searchParams])

  // Buscar si la conversación corresponde a un cliente ya existente + su
  // historial (reservas y propuestas), para mostrarlo dentro del chat.
  useEffect(() => {
    setPanelCliente(false)
    setClienteVinculado(null)
    setReservasCliente([])
    setPropuestasCliente([])
    if (!seleccionada) return

    setCargandoCliente(true)
    Promise.all([
      clientesApi.getByWhatsapp(seleccionada.whatsapp),
      propuestasApi.getByWhatsapp(seleccionada.whatsapp),
    ]).then(([{ data: cliente }, { data: propuestas }]) => {
      setPropuestasCliente(propuestas || [])
      if (cliente) {
        setClienteVinculado(cliente)
        reservasClienteApi.getByCliente(cliente.id, seleccionada.whatsapp).then(({ data }) => {
          setReservasCliente(data || [])
          setCargandoCliente(false)
        })
      } else {
        setCargandoCliente(false)
      }
    })
  }, [seleccionada?.id])

  // Cargar mensajes + suscripción realtime al cambiar conversación
  useEffect(() => {
    if (!seleccionada) return
    setMensajes([])

    mensajesApi.getByConversacion(seleccionada.id).then(({ data }) => {
      if (data) setMensajes(data)
    })

    conversacionesApi.marcarLeida(seleccionada.id)
    setConversaciones(prev => prev.map(c => c.id === seleccionada.id ? { ...c, no_leidos: 0 } : c))

    if (!supabase) return
    const channel = supabase
      .channel(`crm-mensajes-${seleccionada.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mensajes',
        filter: `conversacion_id=eq.${seleccionada.id}`,
      }, (payload) => {
        setMensajes(prev => {
          // Reemplazar mensaje optimista si existe con el mismo texto
          const sinTemp = prev.filter(m =>
            !(m.id?.toString().startsWith('temp-') && m.texto === payload.new.texto && m.direccion === payload.new.direccion)
          )
          return [...sinTemp, payload.new]
        })
      })
      .subscribe()

    return () => channel.unsubscribe()
  }, [seleccionada?.id])

  // Scroll al último mensaje
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  // Cerrar menús de etiqueta/asignación al hacer click afuera
  useEffect(() => {
    function handler(e) {
      if (menuEtiquetaRef.current && !menuEtiquetaRef.current.contains(e.target)) {
        setMenuEtiqueta(false)
      }
      if (menuAsignarRef.current && !menuAsignarRef.current.contains(e.target)) {
        setMenuAsignar(false)
      }
      if (menuRespuestasRef.current && !menuRespuestasRef.current.contains(e.target)) {
        setMenuRespuestas(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function insertarRespuesta(texto) {
    setTexto(prev => (prev ? `${prev} ${texto}` : texto))
    setMenuRespuestas(false)
    inputRef.current?.focus()
  }

  async function seleccionarConversacion(conv) {
    setSeleccionada(conv)
    setMenuEtiqueta(false)
    setMenuAsignar(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  async function asignarA(usuarioId) {
    if (!seleccionada || asignando) return
    setMenuAsignar(false)
    setAsignando(true)

    const nuevo = seleccionada.asignado_a === usuarioId ? null : usuarioId

    await conversacionesApi.asignar(seleccionada.id, nuevo)
    const convActualizada = { ...seleccionada, asignado_a: nuevo }
    setSeleccionada(convActualizada)
    setConversaciones(prev => prev.map(c => c.id === seleccionada.id ? convActualizada : c))

    setAsignando(false)
  }

  async function asignarEtiqueta(etiquetaId) {
    if (!seleccionada || etiquetando) return
    setMenuEtiqueta(false)
    setEtiquetando(true)

    const nueva = seleccionada.etiqueta === etiquetaId ? null : etiquetaId

    await conversacionesApi.updateEtiqueta(seleccionada.id, nueva)
    const convActualizada = { ...seleccionada, etiqueta: nueva }
    setSeleccionada(convActualizada)
    setConversaciones(prev => prev.map(c => c.id === seleccionada.id ? convActualizada : c))

    // Si la etiqueta crea lead automáticamente
    if (nueva && ETIQUETAS[nueva]?.creaLead) {
      const { data: existente } = await leadsApi.getAll()
      const yaExiste = existente?.some(l => l.whatsapp === seleccionada.whatsapp)
      if (!yaExiste) {
        await leadsApi.create({
          nombre: seleccionada.contacto_nombre,
          whatsapp: seleccionada.whatsapp,
          origen: 'WhatsApp',
          estado: 'nuevo',
          notas: '',
        })
      }
    }

    setEtiquetando(false)
  }

  async function sincronizar() {
    setSincronizando(true)
    const { data, error } = await sincronizarWhatsApp()
    setSincronizando(false)
    if (error) {
      alert('Error al sincronizar: ' + error.message)
      return
    }
    alert(`Sincronización completa: ${data?.syncedConversaciones ?? 0} conversaciones nuevas importadas.`)
    conversacionesApi.getAll().then(({ data }) => {
      if (data) setConversaciones(data)
    })
  }

  async function enviar() {
    const textoEnviar = texto.trim()
    if (!textoEnviar || !seleccionada || enviando) return

    setTexto('')
    setEnviando(true)

    // Optimistic update
    const tempId = `temp-${Date.now()}`
    const tempMsg = {
      id: tempId,
      conversacion_id: seleccionada.id,
      whatsapp: seleccionada.whatsapp,
      texto: textoEnviar,
      direccion: 'saliente',
      created_at: new Date().toISOString(),
    }
    setMensajes(prev => [...prev, tempMsg])

    const { error } = await enviarWhatsApp({
      phone: seleccionada.whatsapp,
      message: textoEnviar,
      nombre: seleccionada.contacto_nombre,
      conversacionId: seleccionada.id,
    })

    if (error) {
      setMensajes(prev => prev.filter(m => m.id !== tempId))
      setTexto(textoEnviar)
      alert('Error al enviar el mensaje: ' + (error?.message || 'Sin respuesta del servidor. Revisá que Evolution API esté activa.'))
    }

    setEnviando(false)
  }

  function usuarioPorId(id) {
    return usuarios.find(u => u.id === id) || null
  }

  const convsFiltradas = conversaciones
    .filter(c =>
      c.contacto_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.whatsapp?.includes(busqueda)
    )
    .filter(c => {
      if (filtroAsignacion === 'sin_asignar') return !c.asignado_a
      if (filtroAsignacion === 'mias') return c.asignado_a === miUsuarioId
      return true
    })

  return (
    <div className="flex h-full bg-white dark:bg-zinc-900">
      {/* Panel izquierdo — lista de conversaciones */}
      <div className="w-80 border-r border-gray-200 dark:border-zinc-800 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-bold text-gray-900 dark:text-zinc-100 text-lg">💬 WhatsApp</h1>
            <button
              onClick={sincronizar}
              disabled={sincronizando}
              className="text-xs bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-900/40 text-green-700 dark:text-green-400 font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {sincronizando ? 'Sincronizando...' : '↻ Sincronizar'}
            </button>
          </div>
          <input
            type="text"
            placeholder="Buscar contacto o número..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
          />
          <div className="flex gap-1.5 mt-2.5">
            {[
              { id: 'todas', label: 'Todas' },
              { id: 'mias', label: 'Mías' },
              { id: 'sin_asignar', label: 'Sin asignar' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFiltroAsignacion(f.id)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                  filtroAsignacion === f.id
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-10">Cargando...</p>
          )}

          {!loading && convsFiltradas.length === 0 && (
            <div className="text-center py-12 text-gray-400 dark:text-zinc-500 px-4">
              <p className="text-3xl mb-2">💬</p>
              <p className="text-sm">
                {busqueda ? 'Sin resultados' : 'Aún no hay conversaciones. Aparecerán cuando llegue un mensaje de WhatsApp.'}
              </p>
            </div>
          )}

          {convsFiltradas.map(conv => (
            <button
              key={conv.id}
              onClick={() => seleccionarConversacion(conv)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 dark:border-zinc-800/50 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors ${
                seleccionada?.id === conv.id ? 'bg-green-50 dark:bg-green-950/20 border-l-2 border-l-green-500' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <Avatar nombre={conv.contacto_nombre} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="font-semibold text-sm text-gray-900 dark:text-zinc-100 truncate">{conv.contacto_nombre}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500 shrink-0">{formatTiempo(conv.ultimo_mensaje_at)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-xs text-gray-400 dark:text-zinc-500 truncate flex-1">{conv.ultimo_mensaje || '–'}</p>
                    {conv.etiqueta && ETIQUETAS[conv.etiqueta] && (
                      <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ETIQUETAS[conv.etiqueta].color}`}>
                        {ETIQUETAS[conv.etiqueta].label}
                      </span>
                    )}
                  </div>
                </div>
                {conv.asignado_a && usuarioPorId(conv.asignado_a) && (
                  <span
                    title={`Asignada a ${usuarioPorId(conv.asignado_a).nombre}`}
                    className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-950/40 text-brand-700 dark:text-brand-400 text-[10px] font-bold flex items-center justify-center shrink-0"
                  >
                    {usuarioPorId(conv.asignado_a).nombre[0].toUpperCase()}
                  </span>
                )}
                {conv.no_leidos > 0 && (
                  <span className="bg-green-500 text-white text-xs rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center font-medium shrink-0">
                    {conv.no_leidos}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Panel derecho — chat */}
      {seleccionada ? (
        <div className="flex-1 flex flex-col" style={{ backgroundImage: 'radial-gradient(circle, #e5ddd5 1px, transparent 1px)', backgroundSize: '20px 20px', backgroundColor: '#f0ebe3' }}>
          {/* Header del chat */}
          <div className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-5 py-3 flex items-center gap-3 shadow-sm dark:shadow-black/20">
            <Avatar nombre={seleccionada.contacto_nombre} />
            <div>
              <p className="font-semibold text-gray-900 dark:text-zinc-100">{seleccionada.contacto_nombre}</p>
              <p className="text-xs text-gray-400 dark:text-zinc-500">{formatPhone(seleccionada.whatsapp)}</p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {/* Panel de cliente */}
              <button
                onClick={() => setPanelCliente(v => !v)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 ${
                  panelCliente
                    ? 'bg-brand-600 dark:bg-brand-500 text-white border-transparent'
                    : clienteVinculado
                      ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-400 border-transparent'
                      : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700'
                }`}
              >
                {clienteVinculado ? 'Cliente' : 'Sin datos'}
              </button>
              {/* Selector de asignación */}
              <div className="relative" ref={menuAsignarRef}>
                <button
                  onClick={() => setMenuAsignar(v => !v)}
                  disabled={asignando}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
                    seleccionada.asignado_a
                      ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-400 border-transparent'
                      : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700'
                  }`}
                >
                  {seleccionada.asignado_a && usuarioPorId(seleccionada.asignado_a)
                    ? `${usuarioPorId(seleccionada.asignado_a).nombre} ▾`
                    : '＋ Asignar'}
                </button>
                {menuAsignar && (
                  <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-900 rounded-xl shadow-lg dark:shadow-black/40 border border-gray-100 dark:border-zinc-700 py-1 z-10 min-w-[160px] max-h-64 overflow-y-auto">
                    {usuarios.filter(u => u.activo).map(u => (
                      <button
                        key={u.id}
                        onClick={() => asignarA(u.id)}
                        className={`w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 flex items-center gap-2 ${
                          seleccionada.asignado_a === u.id ? 'font-semibold' : ''
                        }`}
                      >
                        {u.nombre}
                        {seleccionada.asignado_a === u.id && <span className="ml-auto text-gray-400 dark:text-zinc-500">✓</span>}
                      </button>
                    ))}
                    {usuarios.filter(u => u.activo).length === 0 && (
                      <p className="px-3 py-2 text-xs text-gray-400 dark:text-zinc-500">Sin usuarios activos</p>
                    )}
                  </div>
                )}
              </div>
              {/* Selector de etiqueta */}
              <div className="relative" ref={menuEtiquetaRef}>
                <button
                  onClick={() => setMenuEtiqueta(v => !v)}
                  disabled={etiquetando}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
                    seleccionada.etiqueta && ETIQUETAS[seleccionada.etiqueta]
                      ? `${ETIQUETAS[seleccionada.etiqueta].color} border-transparent`
                      : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700'
                  }`}
                >
                  {seleccionada.etiqueta && ETIQUETAS[seleccionada.etiqueta]
                    ? `${ETIQUETAS[seleccionada.etiqueta].label} ▾`
                    : '＋ Etiquetar'}
                </button>
                {menuEtiqueta && (
                  <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-900 rounded-xl shadow-lg dark:shadow-black/40 border border-gray-100 dark:border-zinc-700 py-1 z-10 min-w-[140px]">
                    {Object.entries(ETIQUETAS).map(([id, info]) => (
                      <button
                        key={id}
                        onClick={() => asignarEtiqueta(id)}
                        className={`w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 flex items-center gap-2 ${
                          seleccionada.etiqueta === id ? 'font-semibold' : ''
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${info.dot}`} />
                        {info.label}
                        {seleccionada.etiqueta === id && <span className="ml-auto text-gray-400 dark:text-zinc-500">✓</span>}
                      </button>
                    ))}
                    {seleccionada.etiqueta && (
                      <>
                        <div className="border-t border-gray-100 dark:border-zinc-700 my-1" />
                        <button
                          onClick={() => asignarEtiqueta(seleccionada.etiqueta)}
                          className="w-full text-left px-3 py-2 text-xs text-gray-400 dark:text-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-800"
                        >
                          Quitar etiqueta
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <a
                href={`https://wa.me/${seleccionada.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium"
              >
                Abrir en WhatsApp ↗
              </a>
            </div>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
            {mensajes.length === 0 && (
              <p className="text-center text-sm text-gray-400 dark:text-zinc-500 py-8">No hay mensajes aún</p>
            )}
            {mensajes.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.direccion === 'saliente' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-2 rounded-2xl shadow-sm text-sm ${
                  msg.direccion === 'saliente'
                    ? 'bg-[#dcf8c6] dark:bg-green-800 text-gray-900 dark:text-zinc-100 rounded-br-sm'
                    : 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-bl-sm'
                } ${msg.id?.toString().startsWith('temp-') ? 'opacity-70' : ''}`}>
                  <p className="whitespace-pre-wrap break-words">{msg.texto}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-400 mt-1 text-right">
                    {formatHora(msg.created_at)}
                    {msg.direccion === 'saliente' && (
                      <span className="ml-1">{msg.id?.toString().startsWith('temp-') ? '🕐' : '✓✓'}</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>

          {/* Input de envío */}
          <div className="bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 px-4 py-3 flex items-end gap-3">
            <div className="relative shrink-0" ref={menuRespuestasRef}>
              <button
                onClick={() => setMenuRespuestas(v => !v)}
                title="Respuestas rápidas"
                className="w-[42px] h-[42px] flex items-center justify-center rounded-2xl border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
                </svg>
              </button>
              {menuRespuestas && (
                <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-zinc-900 rounded-xl shadow-lg dark:shadow-black/40 border border-gray-100 dark:border-zinc-700 py-1 z-10 min-w-[220px] max-w-[280px] max-h-64 overflow-y-auto">
                  {respuestasRapidas.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-gray-400 dark:text-zinc-500">
                      Sin respuestas guardadas — armalas en Configuración → Respuestas rápidas.
                    </p>
                  ) : (
                    respuestasRapidas.map(r => (
                      <button
                        key={r.id}
                        onClick={() => insertarRespuesta(r.texto)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800"
                      >
                        <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">{r.titulo}</p>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{r.texto}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <textarea
              ref={inputRef}
              rows={1}
              value={texto}
              onChange={e => {
                setTexto(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  enviar()
                }
              }}
              placeholder="Escribí un mensaje... (Enter para enviar, Shift+Enter para nueva línea)"
              className="flex-1 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 resize-none overflow-hidden"
              style={{ minHeight: '42px' }}
            />
            <button
              onClick={enviar}
              disabled={enviando || !texto.trim()}
              className="bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-2xl text-sm transition-colors shrink-0"
            >
              {enviando ? '...' : 'Enviar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#f0ebe3' }}>
          <div className="text-center text-gray-500 dark:text-zinc-400">
            <p className="text-6xl mb-4">💬</p>
            <p className="font-semibold text-lg text-gray-700 dark:text-zinc-300">WhatsApp CRM</p>
            <p className="text-sm mt-1 text-gray-400 dark:text-zinc-500">Seleccioná una conversación para ver los mensajes</p>
          </div>
        </div>
      )}

      {/* Panel derecho — ficha del cliente */}
      {panelCliente && seleccionada && (
        <div className="w-80 border-l border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col shrink-0 overflow-y-auto">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
            <p className="font-semibold text-gray-900 dark:text-zinc-100">Ficha del contacto</p>
          </div>
          <div className="p-5 space-y-5">
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setModalReserva(true)}
                className="w-full bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                + Nueva reserva
              </button>
              <button
                onClick={() => navigate(`/admin/paquetes/generador?nombre=${encodeURIComponent(seleccionada.contacto_nombre || '')}&whatsapp=${seleccionada.whatsapp}${clienteVinculado ? `&cliente=${clienteVinculado.id}` : ''}`)}
                className="w-full border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                + Nueva propuesta
              </button>
            </div>

            {cargandoCliente ? (
              <p className="text-sm text-gray-400 dark:text-zinc-500">Cargando...</p>
            ) : clienteVinculado ? (
              <div>
                <p className="text-xs text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-1">Cliente</p>
                <p className="font-semibold text-gray-900 dark:text-zinc-100">{clienteVinculado.nombre}</p>
                {(clienteVinculado.pais || clienteVinculado.ciudad) && (
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                    {[clienteVinculado.pais, clienteVinculado.ciudad].filter(Boolean).join(', ')}
                  </p>
                )}
                {clienteVinculado.cantidad_pasajeros && (
                  <p className="text-xs text-gray-400 dark:text-zinc-500">
                    {clienteVinculado.cantidad_pasajeros} pasajero{clienteVinculado.cantidad_pasajeros !== 1 ? 's' : ''} habitual
                  </p>
                )}
                <button
                  onClick={() => navigate(`/admin/clientes?cliente=${clienteVinculado.id}`)}
                  className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium mt-2"
                >
                  Ver perfil completo →
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-zinc-400">Todavía no es cliente — sigue siendo un contacto/lead.</p>
            )}

            {reservasCliente.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-2">Reservas ({reservasCliente.length})</p>
                <div className="space-y-2">
                  {reservasCliente.slice(0, 5).map(r => (
                    <div key={r.id} className="bg-gray-50 dark:bg-zinc-800/60 rounded-lg px-3 py-2">
                      <p className="text-xs font-medium text-gray-800 dark:text-zinc-200 truncate">{r.excursiones?.nombre || 'Excursión'}</p>
                      <p className="text-[11px] text-gray-400 dark:text-zinc-500 capitalize">
                        {r.fecha ? new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} · {r.estado}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {propuestasCliente.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-2">Propuestas ({propuestasCliente.length})</p>
                <div className="space-y-2">
                  {propuestasCliente.slice(0, 5).map(p => (
                    <div key={p.id} className="bg-gray-50 dark:bg-zinc-800/60 rounded-lg px-3 py-2">
                      <p className="text-xs font-medium text-gray-800 dark:text-zinc-200">{p.moneda} {Number(p.total || 0).toLocaleString('es-AR')}</p>
                      <p className="text-[11px] text-gray-400 dark:text-zinc-500 capitalize">{p.estado}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {modalReserva && seleccionada && (
        <ModalNuevaReserva
          excursiones={excursiones}
          onGuardar={crearReservaDesdeChat}
          onCerrar={() => setModalReserva(false)}
          valoresIniciales={{
            cliente_nombre: clienteVinculado?.nombre || seleccionada.contacto_nombre || '',
            cliente_whatsapp: seleccionada.whatsapp || '',
            cliente_id: clienteVinculado?.id || null,
          }}
        />
      )}
    </div>
  )
}
