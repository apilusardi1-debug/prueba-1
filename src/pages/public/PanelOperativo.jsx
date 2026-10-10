// Link personal del guía o del chofer (sin sesión de admin): ve el aviso de cada
// operación que le toca, en portugués, con un botón "Recebido" y, por cada
// pasajero, un botón para mandarle el mensaje por SU PROPIO WhatsApp (gratis,
// no sale por la API de Meta). Reemplaza las plantillas aviso_guia/aviso_chofer.
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { panelOperativoApi } from '../../lib/supabase.js'
import { useSincronizado } from '../../lib/useSincronizado.js'
import Ic, { IcGrande } from '../../components/admin/dashboard/Ic.jsx'

const TABLA = { guia: 'guias', chofer: 'choferes' }
const CAMPO = { guia: 'guia_id', chofer: 'chofer_id' }
const TITULO = { guia: 'Guia', chofer: 'Motorista' }

function formatoFecha(iso) {
  if (!iso) return ''
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}
function formatoHora(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function Aviso({ aviso, onConfirmar, cambiando }) {
  const confirmado = !!aviso.confirmado_at
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-zinc-100">{aviso.operaciones?.excursiones?.nombre}</p>
          <p className="text-xs capitalize text-zinc-500">{formatoFecha(aviso.operaciones?.fecha)}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${confirmado ? 'bg-emerald-950/50 text-emerald-400' : 'bg-amber-950/40 text-amber-400'}`}>
          {confirmado ? `Recebido às ${formatoHora(aviso.confirmado_at)}` : 'Novo aviso'}
        </span>
      </div>

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{aviso.mensaje}</p>

      <div className="mt-4 space-y-2 border-t border-zinc-800 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Mandar mensagem para os passageiros</p>
        {(aviso.pasajeros || []).map((p, i) => (
          <a
            key={i}
            href={p.whatsapp ? `https://wa.me/${p.whatsapp}?text=${encodeURIComponent(p.mensajeWa)}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!p.whatsapp}
            className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
              p.whatsapp
                ? 'border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
                : 'pointer-events-none border-zinc-800 bg-zinc-900 text-zinc-600'
            }`}
          >
            <span className="truncate">{p.nombre} <span className="text-zinc-500">· {p.personas} {p.personas === 1 ? 'pessoa' : 'pessoas'}</span></span>
            <Ic n="send" className="h-4 w-4 shrink-0 text-emerald-400" />
          </a>
        ))}
      </div>

      <button
        onClick={() => onConfirmar(aviso)}
        disabled={cambiando}
        className={`mt-4 w-full rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
          confirmado ? 'border border-zinc-700 text-zinc-400 hover:bg-zinc-800' : 'bg-emerald-600 text-white hover:bg-emerald-500'
        }`}
      >
        {confirmado ? 'Desfazer "Recebido"' : 'Recebido'}
      </button>
    </div>
  )
}

// Instalable como ícono en el celular — solo para choferes por ahora (pedido de Cristian,
// 2026-10-09). Cada tag se agrega/saca a mano del <head> porque esta es una SPA con un solo
// index.html: todas las rutas comparten el mismo documento, así que no se puede dejar esto
// fijo ahí (rompería el resto del sitio). El manifest es por chofer (ver api/chofer-manifest.js)
// para que el ícono instalado abra siempre SU link, no uno genérico.
function useInstalablePWA(activo, token) {
  useEffect(() => {
    if (!activo) return
    const agregados = []
    const agregar = (tag, attrs) => {
      const el = document.createElement(tag)
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
      document.head.appendChild(el)
      agregados.push(el)
    }
    agregar('link', { rel: 'manifest', href: `/api/chofer-manifest?token=${token}` })
    agregar('link', { rel: 'apple-touch-icon', href: '/icon-chofer-192.png' })
    agregar('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' })
    agregar('meta', { name: 'apple-mobile-web-app-title', content: 'DT Motorista' })
    agregar('meta', { name: 'theme-color', content: '#000000' })

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw-chofer.js', { scope: '/chofer/' }).catch(() => {})
    }

    return () => agregados.forEach((el) => el.remove())
  }, [activo, token])
}

// Notificaciones push (parte 2 del ícono instalable, pedido de Cristian 2026-10-09) — solo
// choferes, igual que useInstalablePWA. Hay que pedirle permiso al usuario con un toque suyo
// (no se puede pedir solo al entrar), por eso es un botón y no algo automático.
const VAPID_PUBLIC_KEY = 'BJoB-50M9BKcf0or8UrCaxPvIOoD4_H60od0lBCOGHTFXj1J4tTBSn60yQExLUBpZogGjCq45tTtHbTQgewF2_g'

function urlBase64ToUint8Array(base64url) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

function BotonNotificaciones({ choferId }) {
  // cargando | no_soportado | denegado | inactivo | activando | activo
  const [estado, setEstado] = useState('cargando')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setEstado('no_soportado')
      return
    }
    if (Notification.permission === 'denied') { setEstado('denegado'); return }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEstado(sub ? 'activo' : 'inactivo'))
      .catch(() => setEstado('inactivo'))
  }, [])

  async function activar() {
    setEstado('activando')
    setError('')
    try {
      const permiso = await Notification.requestPermission()
      if (permiso !== 'granted') { setEstado('denegado'); return }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      const { error: errGuardar } = await panelOperativoApi.guardarPush(choferId, sub.toJSON())
      if (errGuardar) throw errGuardar
      setEstado('activo')
    } catch (err) {
      setError(err.message || 'Não foi possível ativar')
      setEstado('inactivo')
    }
  }

  if (estado === 'cargando' || estado === 'no_soportado') return null

  if (estado === 'activo') {
    return (
      <p className="flex items-center justify-center gap-1.5 text-xs text-emerald-400">
        <Ic n="check" className="h-3.5 w-3.5" /> Notificações ativadas
      </p>
    )
  }

  return (
    <div className="text-center">
      <button
        onClick={activar}
        disabled={estado === 'activando' || estado === 'denegado'}
        className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
      >
        <Ic n="bell" className="h-3.5 w-3.5" />
        {estado === 'activando' ? 'Ativando...' : estado === 'denegado' ? 'Notificações bloqueadas no celular' : 'Ativar notificações'}
      </button>
      {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
    </div>
  )
}

export default function PanelOperativo({ tipo }) {
  const { token } = useParams()
  const [persona, setPersona] = useState(undefined) // undefined = cargando, null = no existe
  const [avisos, setAvisos] = useState([])
  const [cambiandoId, setCambiandoId] = useState(null)
  useInstalablePWA(tipo === 'chofer', token)

  const cargarAvisos = useCallback(async (personaId) => {
    if (!personaId) return
    const { data } = await panelOperativoApi.getAvisos(CAMPO[tipo], personaId)
    setAvisos(data || [])
    // El primer vistazo marca leído lo que todavía no lo estaba (no bloquea la pantalla).
    // Ojo: el builder de supabase-js es "lazy" (thenable) y no manda el pedido hasta que
    // algo llama a su .then()/await, por eso va con Promise.all en vez de dejarlo suelto.
    const sinLeer = (data || []).filter((a) => !a.leido_at)
    if (sinLeer.length) Promise.all(sinLeer.map((a) => panelOperativoApi.marcarLeido(a.id))).catch(() => {})
  }, [tipo])

  useEffect(() => {
    panelOperativoApi.getPorToken(TABLA[tipo], token).then(({ data }) => {
      setPersona(data || null)
      if (data) cargarAvisos(data.id)
    })
  }, [tipo, token, cargarAvisos])

  useSincronizado(() => cargarAvisos(persona?.id), ['operaciones_avisos'])

  async function onConfirmar(aviso) {
    setCambiandoId(aviso.id)
    await panelOperativoApi.marcarConfirmado(aviso.id, !aviso.confirmado_at)
    await cargarAvisos(persona.id)
    setCambiandoId(null)
  }

  return (
    <div className="min-h-screen bg-black px-4 py-8 text-zinc-100">
      <div className="mx-auto max-w-md space-y-5">
        <div className="text-center">
          <img src="/logo-panel.png" alt="DreamTours" className="mx-auto mb-3 h-auto w-28" />
          {persona && <p className="text-sm text-zinc-500">{TITULO[tipo]} · <span className="font-semibold text-zinc-200">{persona.nombre}</span></p>}
        </div>

        {persona && tipo === 'chofer' && <BotonNotificaciones choferId={persona.id} />}

        {persona === undefined && <p className="text-center text-sm text-zinc-500">Carregando...</p>}

        {persona === null && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
            <IcGrande n="alert" />
            <p className="text-sm text-zinc-400">Este link não é válido. Fale com a DreamTours para receber o link correto.</p>
          </div>
        )}

        {persona && avisos.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
            <IcGrande n="chat" />
            <p className="text-sm text-zinc-400">Ainda não tem nenhum aviso.</p>
          </div>
        )}

        {persona && avisos.map((a) => (
          <Aviso key={a.id} aviso={a} onConfirmar={onConfirmar} cambiando={cambiandoId === a.id} />
        ))}
      </div>
    </div>
  )
}
