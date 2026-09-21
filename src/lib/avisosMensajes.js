// Avisos de mensaje nuevo del CRM: sonido, cartel dentro de la página y, si la
// persona está en otra ventana, notificación del navegador y título parpadeando.
// Se engancha desde el layout del panel, así funciona en cualquier pantalla.
// Solo avisa mientras el panel esté abierto en alguna pestaña.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, conversacionesApi, usuariosAdminApi } from './supabase.js'
import { avisoPorMensaje, avisoPorDerivacion, avisoPorSinAsignar, recortar } from './avisosReglas.js'

const CLAVE = 'crm_avisos'
const RUTA_CRM = '/admin/crm/whatsapp'

function leerPreferencia() {
  try { return localStorage.getItem(CLAVE) === 'on' } catch { return false }
}
// "Configurado" = la persona ya eligió alguna vez (activar o desactivar). Sirve
// para señalar la campana solo a quien todavía no la tocó.
function leerConfigurado() {
  try { return localStorage.getItem(CLAVE) !== null } catch { return true }
}
function guardarPreferencia(activo) {
  try { localStorage.setItem(CLAVE, activo ? 'on' : 'off') } catch { /* sin almacenamiento */ }
}

// Conversación que esta persona tiene abierta en el chat: no se le avisa de lo
// que ya está viendo. La informa la pantalla del CRM.
let conversacionAbierta = null
export function setConversacionAbierta(id) { conversacionAbierta = id }

// ── Sonido: dos tonos cortos generados en el momento (no hay archivo de audio).
// Los navegadores solo dejan sonar después de un gesto de la persona.
let contextoAudio = null
function audio() {
  if (!contextoAudio) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (AC) contextoAudio = new AC()
  }
  return contextoAudio
}

export function sonar() {
  const c = audio()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  const t0 = c.currentTime
  ;[[880, 0], [1320, 0.16]].forEach(([frecuencia, desfase]) => {
    const osc = c.createOscillator()
    const vol = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = frecuencia
    vol.gain.setValueAtTime(0.0001, t0 + desfase)
    vol.gain.exponentialRampToValueAtTime(0.18, t0 + desfase + 0.02)
    vol.gain.exponentialRampToValueAtTime(0.0001, t0 + desfase + 0.32)
    osc.connect(vol)
    vol.connect(c.destination)
    osc.start(t0 + desfase)
    osc.stop(t0 + desfase + 0.34)
  })
}

function notificacionesPermitidas() {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

function tienePestanaEnfoque() {
  return document.visibilityState === 'visible' && document.hasFocus()
}

// Con el panel en otra ventana o pestaña, el título de la pestaña parpadea con el
// aviso hasta que la persona vuelve. Sirve aunque el sistema bloquee las
// notificaciones.
let parpadeo = null
function detenerParpadeo() {
  if (!parpadeo) return
  clearInterval(parpadeo.intervalo)
  window.removeEventListener('focus', parpadeo.alVolver)
  document.removeEventListener('visibilitychange', parpadeo.alVolver)
  document.title = parpadeo.tituloOriginal
  parpadeo = null
}
function parpadearTitulo(texto) {
  detenerParpadeo()
  const tituloOriginal = document.title
  let alterna = false
  const intervalo = setInterval(() => {
    alterna = !alterna
    document.title = alterna ? texto : tituloOriginal
  }, 1000)
  const alVolver = () => { if (tienePestanaEnfoque()) detenerParpadeo() }
  window.addEventListener('focus', alVolver)
  document.addEventListener('visibilitychange', alVolver)
  parpadeo = { intervalo, alVolver, tituloOriginal }
}

// Qué está listo y qué no en este navegador, para mostrarlo en el panel de la
// campana. Sonido "pendiente" = el navegador lo bloquea hasta el primer clic o
// tecla en la página.
export function leerEstadoAvisos() {
  const AC = window.AudioContext || window.webkitAudioContext
  const sonido = !AC ? 'no-disponible' : contextoAudio?.state === 'running' ? 'listo' : 'pendiente'
  const notificaciones =
    typeof Notification === 'undefined' ? 'no-disponibles'
    : Notification.permission === 'granted' ? 'activadas'
    : Notification.permission === 'denied' ? 'bloqueadas'
    : 'sin-permitir'
  return { sonido, notificaciones }
}

function mostrarNotificacion({ titulo, cuerpo, tag, alHacerClic }) {
  if (!notificacionesPermitidas()) return
  const n = new Notification(titulo, {
    body: cuerpo,
    tag,          // un aviso nuevo con el mismo tag reemplaza al anterior
    silent: true, // el sonido ya lo pone la app
  })
  n.onclick = () => {
    window.focus()
    alHacerClic?.()
    n.close()
  }
}

export function useAvisosMensajes({ habilitado, navigate }) {
  const [activo, setActivo] = useState(leerPreferencia)
  const [configurado, setConfigurado] = useState(leerConfigurado)
  const [, setVersion] = useState(0)
  const refrescar = useCallback(() => setVersion(v => v + 1), [])
  // Carteles dentro de la página: se ven aunque el sistema bloquee las notificaciones
  const [carteles, setCarteles] = useState([])
  const cerrarCartel = useCallback(id => setCarteles(prev => prev.filter(c => c.id !== id)), [])
  const mostrarCartel = useCallback((aviso, conv) => {
    const nuevo = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      convId: conv.id,
      whatsapp: conv.whatsapp || null,
      titulo: aviso.titulo,
      cuerpo: aviso.cuerpo,
    }
    // Un mensaje nuevo de la misma conversación reemplaza a su cartel; el más nuevo va arriba
    setCarteles(prev => [nuevo, ...prev.filter(c => c.convId !== conv.id)].slice(0, 4))
  }, [])
  const yoId = useRef(null)
  const conversaciones = useRef(new Map())
  const ultimoSonido = useRef(0)
  const irA = useRef(navigate)
  irA.current = navigate

  useEffect(() => {
    if (!habilitado || !activo || !supabase) return

    // Si la página se abrió ya con los avisos activados, el audio queda bloqueado
    // hasta el primer gesto: se destraba con el primer clic o tecla.
    const destrabar = () => { audio()?.resume?.().then(refrescar).catch(() => {}) }
    window.addEventListener('pointerdown', destrabar, { once: true })
    window.addEventListener('keydown', destrabar, { once: true })

    // "Yo" = el usuario del panel que coincide con el email de la sesión
    usuariosAdminApi.getAll().then(({ ok, usuarios }) => {
      if (!ok) return
      try {
        const sesion = JSON.parse(localStorage.getItem('admin_session') || '{}')
        const email = String(sesion.email || '').trim().toLowerCase()
        const yo = (usuarios || []).find(u => String(u.email || '').trim().toLowerCase() === email)
        yoId.current = yo?.id ?? null
      } catch { /* sesión ilegible: solo llegan los avisos de "sin asignar" */ }
    })

    conversacionesApi.getAll().then(({ data }) => {
      for (const c of data || []) conversaciones.current.set(c.id, c)
    })

    function avisar(aviso, conv) {
      const enfocado = tienePestanaEnfoque()
      // Lo que se está mirando en este momento no hace falta avisarlo
      if (conversacionAbierta === conv.id && enfocado) return

      const ahora = Date.now()
      if (ahora - ultimoSonido.current > 1500) { // varios mensajes seguidos: un solo sonido
        ultimoSonido.current = ahora
        sonar()
      }

      mostrarCartel(aviso, conv)

      // Si la persona está en otra ventana: notificación del sistema y título parpadeando
      if (!enfocado) {
        mostrarNotificacion({
          ...aviso,
          tag: `crm-${conv.id}`,
          alHacerClic: () => irA.current?.(`${RUTA_CRM}?phone=${conv.whatsapp}`),
        })
        parpadearTitulo(aviso.titulo)
      }
    }

    const canal = supabase
      .channel('avisos-mensajes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, async ({ new: msg }) => {
        if (msg?.direccion !== 'entrante') return
        let conv = conversaciones.current.get(msg.conversacion_id)
        if (!conv) {
          const { data } = await supabase.from('conversaciones').select('*').eq('id', msg.conversacion_id).maybeSingle()
          conv = data
          if (conv) conversaciones.current.set(conv.id, conv)
        }
        const aviso = avisoPorMensaje(conv, recortar(msg.texto), yoId.current)
        if (aviso) avisar(aviso, conv)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones' }, ({ eventType, new: nueva }) => {
        if (!nueva?.id) return
        const anterior = conversaciones.current.get(nueva.id)
        conversaciones.current.set(nueva.id, nueva)
        if (eventType !== 'UPDATE') return
        const aviso = avisoPorDerivacion(anterior, nueva, yoId.current) || avisoPorSinAsignar(anterior, nueva)
        if (aviso) avisar(aviso, nueva)
      })
      .subscribe()

    return () => {
      canal.unsubscribe()
      window.removeEventListener('pointerdown', destrabar)
      window.removeEventListener('keydown', destrabar)
    }
  }, [habilitado, activo, refrescar, mostrarCartel])

  // Activar pide el permiso de notificaciones (el navegador solo lo permite en
  // respuesta a un clic) y hace sonar un aviso para confirmar y destrabar el audio.
  const alternar = useCallback(async () => {
    setConfigurado(true)
    if (activo) {
      guardarPreferencia(false)
      setActivo(false)
      return
    }
    guardarPreferencia(true)
    setActivo(true)
    sonar()
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    refrescar()
  }, [activo, refrescar])

  const permitirNotificaciones = useCallback(async () => {
    if (typeof Notification === 'undefined') return
    await Notification.requestPermission()
    refrescar()
  }, [refrescar])

  // Prueba a mano lo que pasa cuando llega un mensaje: sonido, cartel y
  // notificación del sistema, para que se vea cuál de los tres funciona
  const probar = useCallback(() => {
    sonar()
    mostrarCartel({ titulo: 'Aviso de prueba', cuerpo: 'Si ves este cartel y escuchaste el sonido, los avisos funcionan.' }, { id: 'prueba' })
    mostrarNotificacion({
      titulo: 'Aviso de prueba',
      cuerpo: 'Si ves esta notificación, el sistema también las está mostrando.',
      tag: 'crm-prueba',
    })
    setTimeout(refrescar, 300)
  }, [mostrarCartel, refrescar])

  return { activo, configurado, alternar, permitirNotificaciones, probar, refrescar, carteles, cerrarCartel }
}
