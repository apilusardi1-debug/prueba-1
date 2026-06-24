import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase, conversacionesApi, mensajesApi, leadsApi, enviarWhatsApp, sincronizarWhatsApp } from '../../../lib/supabase.js'

const ETIQUETAS = {
  lead:        { label: 'Lead',        color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500',   creaLead: true  },
  interesado:  { label: 'Interesado',  color: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400',  creaLead: false },
  cliente:     { label: 'Cliente',     color: 'bg-green-100 text-green-700',  dot: 'bg-green-500',  creaLead: false },
  no_interesa: { label: 'No interesa', color: 'bg-red-100 text-red-700',      dot: 'bg-red-400',    creaLead: false },
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
    <div className={`${sizeClass} rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 shrink-0`}>
      {(nombre || '?')[0].toUpperCase()}
    </div>
  )
}

export default function WhatsAppCRM() {
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
  const [searchParams, setSearchParams] = useSearchParams()
  const chatBottomRef = useRef(null)
  const inputRef = useRef(null)
  const menuEtiquetaRef = useRef(null)

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

  // Cerrar menú de etiqueta al hacer click afuera
  useEffect(() => {
    function handler(e) {
      if (menuEtiquetaRef.current && !menuEtiquetaRef.current.contains(e.target)) {
        setMenuEtiqueta(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function seleccionarConversacion(conv) {
    setSeleccionada(conv)
    setMenuEtiqueta(false)
    setTimeout(() => inputRef.current?.focus(), 100)
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

  const convsFiltradas = conversaciones.filter(c =>
    c.contacto_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.whatsapp?.includes(busqueda)
  )

  return (
    <div className="flex h-full bg-white">
      {/* Panel izquierdo — lista de conversaciones */}
      <div className="w-80 border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-bold text-gray-900 text-lg">💬 WhatsApp</h1>
            <button
              onClick={sincronizar}
              disabled={sincronizando}
              className="text-xs bg-green-50 hover:bg-green-100 text-green-700 font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {sincronizando ? 'Sincronizando...' : '↻ Sincronizar'}
            </button>
          </div>
          <input
            type="text"
            placeholder="Buscar contacto o número..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full bg-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <p className="text-sm text-gray-400 text-center py-10">Cargando...</p>
          )}

          {!loading && convsFiltradas.length === 0 && (
            <div className="text-center py-12 text-gray-400 px-4">
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
              className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                seleccionada?.id === conv.id ? 'bg-green-50 border-l-2 border-l-green-500' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <Avatar nombre={conv.contacto_nombre} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="font-semibold text-sm text-gray-900 truncate">{conv.contacto_nombre}</p>
                    <p className="text-xs text-gray-400 shrink-0">{formatTiempo(conv.ultimo_mensaje_at)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-xs text-gray-400 truncate flex-1">{conv.ultimo_mensaje || '–'}</p>
                    {conv.etiqueta && ETIQUETAS[conv.etiqueta] && (
                      <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ETIQUETAS[conv.etiqueta].color}`}>
                        {ETIQUETAS[conv.etiqueta].label}
                      </span>
                    )}
                  </div>
                </div>
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
          <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-3 shadow-sm">
            <Avatar nombre={seleccionada.contacto_nombre} />
            <div>
              <p className="font-semibold text-gray-900">{seleccionada.contacto_nombre}</p>
              <p className="text-xs text-gray-400">{formatPhone(seleccionada.whatsapp)}</p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {/* Selector de etiqueta */}
              <div className="relative" ref={menuEtiquetaRef}>
                <button
                  onClick={() => setMenuEtiqueta(v => !v)}
                  disabled={etiquetando}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
                    seleccionada.etiqueta && ETIQUETAS[seleccionada.etiqueta]
                      ? `${ETIQUETAS[seleccionada.etiqueta].color} border-transparent`
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {seleccionada.etiqueta && ETIQUETAS[seleccionada.etiqueta]
                    ? `${ETIQUETAS[seleccionada.etiqueta].label} ▾`
                    : '＋ Etiquetar'}
                </button>
                {menuEtiqueta && (
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-10 min-w-[140px]">
                    {Object.entries(ETIQUETAS).map(([id, info]) => (
                      <button
                        key={id}
                        onClick={() => asignarEtiqueta(id)}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 ${
                          seleccionada.etiqueta === id ? 'font-semibold' : ''
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${info.dot}`} />
                        {info.label}
                        {seleccionada.etiqueta === id && <span className="ml-auto text-gray-400">✓</span>}
                      </button>
                    ))}
                    {seleccionada.etiqueta && (
                      <>
                        <div className="border-t border-gray-100 my-1" />
                        <button
                          onClick={() => asignarEtiqueta(seleccionada.etiqueta)}
                          className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50"
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
                className="text-xs text-green-600 hover:text-green-700 font-medium"
              >
                Abrir en WhatsApp ↗
              </a>
            </div>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
            {mensajes.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">No hay mensajes aún</p>
            )}
            {mensajes.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.direccion === 'saliente' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-2 rounded-2xl shadow-sm text-sm ${
                  msg.direccion === 'saliente'
                    ? 'bg-[#dcf8c6] text-gray-900 rounded-br-sm'
                    : 'bg-white text-gray-900 rounded-bl-sm'
                } ${msg.id?.toString().startsWith('temp-') ? 'opacity-70' : ''}`}>
                  <p className="whitespace-pre-wrap break-words">{msg.texto}</p>
                  <p className="text-xs text-gray-400 mt-1 text-right">
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
          <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-end gap-3">
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
              className="flex-1 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 resize-none overflow-hidden"
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
          <div className="text-center text-gray-500">
            <p className="text-6xl mb-4">💬</p>
            <p className="font-semibold text-lg text-gray-700">WhatsApp CRM</p>
            <p className="text-sm mt-1 text-gray-400">Seleccioná una conversación para ver los mensajes</p>
          </div>
        </div>
      )}
    </div>
  )
}
