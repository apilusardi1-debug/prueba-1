// Avisos de mensaje nuevo del CRM: sonido y notificación del navegador. Se
// engancha desde el layout del panel, así funciona en cualquier pantalla.
// Solo avisa mientras el panel esté abierto en alguna pestaña.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, conversacionesApi, usuariosAdminApi } from './supabase.js'
import { avisoPorMensaje, avisoPorDerivacion, recortar } from './avisosReglas.js'

const CLAVE = 'crm_avisos'
const RUTA_CRM = '/admin/crm/whatsapp'

function leerPreferencia() {
  try { return localStorage.getItem(CLAVE) === 'on' } catch { return false }
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

export function useAvisosMensajes({ habilitado, navigate }) {
  const [activo, setActivo] = useState(leerPreferencia)
  const yoId = useRef(null)
  const conversaciones = useRef(new Map())
  const ultimoSonido = useRef(0)
  const irA = useRef(navigate)
  irA.current = navigate

  useEffect(() => {
    if (!habilitado || !activo || !supabase) return

    // Si la página se abrió ya con los avisos activados, el audio queda bloqueado
    // hasta el primer gesto: se destraba con el primer clic o toque.
    const destrabar = () => { audio()?.resume?.().catch(() => {}) }
    window.addEventListener('pointerdown', destrabar, { once: true })

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
      // Lo que se está mirando en este momento no hace falta avisarlo
      if (conversacionAbierta === conv.id && tienePestanaEnfoque()) return

      const ahora = Date.now()
      if (ahora - ultimoSonido.current > 1500) { // varios mensajes seguidos: un solo sonido
        ultimoSonido.current = ahora
        sonar()
      }

      // La notificación del sistema es para cuando no se está mirando el chat
      const viendoElCRM = window.location.pathname.startsWith(RUTA_CRM) && tienePestanaEnfoque()
      if (viendoElCRM || !notificacionesPermitidas()) return
      const n = new Notification(aviso.titulo, {
        body: aviso.cuerpo,
        tag: `crm-${conv.id}`, // un aviso nuevo de la misma conversación reemplaza al anterior
        silent: true,          // el sonido ya lo pone la app
      })
      n.onclick = () => {
        window.focus()
        irA.current?.(`${RUTA_CRM}?phone=${conv.whatsapp}`)
        n.close()
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
        const aviso = avisoPorDerivacion(anterior, nueva, yoId.current)
        if (aviso) avisar(aviso, nueva)
      })
      .subscribe()

    return () => {
      canal.unsubscribe()
      window.removeEventListener('pointerdown', destrabar)
    }
  }, [habilitado, activo])

  const alternar = useCallback(async () => {
    if (activo) {
      guardarPreferencia(false)
      setActivo(false)
      return
    }
    guardarPreferencia(true)
    setActivo(true)
    sonar() // confirma que suena y destraba el audio del navegador

    if (typeof Notification === 'undefined') return
    let permiso = Notification.permission
    if (permiso === 'default') permiso = await Notification.requestPermission()
    if (permiso === 'denied') {
      alert('El navegador tiene bloqueadas las notificaciones de este sitio, así que solo va a sonar el aviso. Para ver también la notificación, habilitala desde el candado de la barra de direcciones.')
    }
  }, [activo])

  return { activo, alternar }
}
