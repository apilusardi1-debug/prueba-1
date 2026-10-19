// Envíos del chat del CRM que no son texto libre (pedido de Cristian, 2026-10-17):
// - BotonFormulario: manda a mano el formulario "Datos del viaje", el mismo que manda el
//   asistente al elegir Paquetes. La respuesta entra sola al chat.
// - PanelPlantillas: cuando pasaron más de 24 hs desde el último mensaje del contacto,
//   Meta solo deja escribirle con una plantilla aprobada. Muestra las aprobadas del número
//   del CRM (las crea el equipo en WhatsApp Manager) y completa sus variables.
// Los dos piden confirmación antes de enviar: un mensaje a un cliente no se puede deshacer.
import { useState, useRef, useEffect } from 'react'
import { enviarFormularioWhatsApp, plantillasWhatsAppCrm, enviarPlantillaWhatsApp } from '../../lib/supabase.js'
import { primerNombre } from '../../lib/respuestasRapidas.js'
import { avisar } from '../ui/Avisos.jsx'
import Ic from '../admin/dashboard/Ic.jsx'

const COSTO_CATEGORIA = { MARKETING: 'marketing, unos R$ 0,34', UTILITY: 'utilidad, unos R$ 0,04', AUTHENTICATION: 'autenticación, unos R$ 0,17' }

// La función devuelve el error de Meta en el cuerpo: el mensaje genérico no dice nada útil
async function detalleError(error) {
  try {
    const cuerpo = await error.context?.json()
    const crudo = cuerpo?.detail || cuerpo?.error || ''
    try { return JSON.parse(crudo)?.error?.message || crudo } catch { return crudo }
  } catch {
    return error?.message || 'Sin respuesta del servidor.'
  }
}

export function BotonFormulario({ conversacion, usuarioId, onEnviado }) {
  const [abierto, setAbierto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!abierto) return
    const cerrar = e => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abierto])

  async function enviar() {
    setEnviando(true)
    const { error } = await enviarFormularioWhatsApp({
      phone: conversacion.whatsapp,
      nombre: conversacion.contacto_nombre,
      conversacionId: conversacion.id,
      usuarioId,
    })
    setEnviando(false)
    if (error) {
      avisar('No se pudo enviar el formulario: ' + await detalleError(error))
      return
    }
    setAbierto(false)
    onEnviado?.()
    avisar('Formulario enviado. Cuando lo complete, las respuestas aparecen en el chat.')
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setAbierto(v => !v)}
        title="Enviar el formulario de datos del viaje"
        className="w-8 h-8 sm:w-[42px] sm:h-[42px] flex items-center justify-center rounded-2xl border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
      >
        <Ic n="list" className="w-4 h-4" />
      </button>
      {abierto && (
        <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-zinc-900 rounded-xl shadow-lg dark:shadow-black/40 border border-gray-100 dark:border-zinc-700 z-10 w-[280px] max-w-[calc(100vw-2rem)] p-3 space-y-2">
          <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100">Enviar formulario de viaje</p>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            Le llega a {conversacion.contacto_nombre || conversacion.whatsapp} el formulario "Datos del viaje" (destino, pasajeros, presupuesto y fechas). Sus respuestas aparecen en este chat.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setAbierto(false)} disabled={enviando}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800">
              Cancelar
            </button>
            <button onClick={enviar} disabled={enviando}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-hero-sky !text-zinc-950 hover:brightness-95 disabled:opacity-50">
              {enviando ? 'Enviando...' : 'Enviar formulario'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function PanelPlantillas({ conversacion, usuarioId, onEnviado }) {
  const [plantillas, setPlantillas] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [elegida, setElegida] = useState(null)
  const [valores, setValores] = useState([])
  const [enviando, setEnviando] = useState(false)

  // Al cambiar de conversación se vuelve a la lista cerrada
  useEffect(() => { setElegida(null); setValores([]) }, [conversacion.id])

  async function abrir() {
    setCargando(true)
    const { data, error } = await plantillasWhatsAppCrm()
    setCargando(false)
    if (error) {
      avisar('No se pudieron cargar las plantillas: ' + await detalleError(error))
      return
    }
    setPlantillas(data?.plantillas || [])
  }

  function elegir(p) {
    setElegida(p)
    // {{1}} suele ser el nombre del contacto: se completa solo, se puede cambiar
    setValores(Array.from({ length: p.variables }, (_, i) => (i === 0 ? primerNombre(conversacion.contacto_nombre) : '')))
  }

  const vistaPrevia = elegida ? elegida.texto.replace(/\{\{(\d+)\}\}/g, (m, n) => valores[Number(n) - 1] || m) : ''
  const faltanDatos = valores.some(v => !String(v).trim())

  async function enviar() {
    setEnviando(true)
    const { error } = await enviarPlantillaWhatsApp({
      phone: conversacion.whatsapp,
      nombre: conversacion.contacto_nombre,
      conversacionId: conversacion.id,
      usuarioId,
      plantilla: { name: elegida.name, language: elegida.language, category: elegida.category, texto: elegida.texto, params: valores },
    })
    setEnviando(false)
    if (error) {
      avisar('No se pudo enviar la plantilla: ' + await detalleError(error))
      return
    }
    setElegida(null)
    onEnviado?.()
    avisar('Plantilla enviada. Cuando el contacto responda, se puede seguir con texto libre.')
  }

  if (plantillas === null) {
    return (
      <button onClick={abrir} disabled={cargando}
        className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">
        {cargando ? 'Cargando plantillas...' : 'Enviar una plantilla'}
      </button>
    )
  }

  if (plantillas.length === 0) {
    return <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">No hay plantillas aprobadas. Se crean en WhatsApp Manager y aparecen acá cuando Meta las aprueba.</p>
  }

  if (!elegida) {
    return (
      <div className="mt-3 space-y-2">
        {plantillas.map(p => (
          <button key={`${p.name}-${p.language}`} onClick={() => elegir(p)}
            className="w-full text-left rounded-lg border border-amber-200 dark:border-amber-900 bg-white dark:bg-zinc-900 px-3 py-2 hover:border-amber-400">
            <p className="text-xs font-semibold text-gray-800 dark:text-zinc-100">{p.name}</p>
            <p className="text-xs text-gray-500 dark:text-zinc-400 line-clamp-2">{p.texto}</p>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-white dark:bg-zinc-900 p-3 space-y-2">
      <p className="text-xs font-semibold text-gray-800 dark:text-zinc-100">{elegida.name}</p>
      {valores.map((v, i) => (
        <div key={i}>
          <label htmlFor={`plantilla-var-${i}`} className="block text-[11px] text-gray-500 dark:text-zinc-400 mb-0.5">{`Dato {{${i + 1}}}`}</label>
          <input id={`plantilla-var-${i}`} value={v} onChange={e => setValores(prev => prev.map((x, j) => (j === i ? e.target.value : x)))}
            className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-hero-sky" />
        </div>
      ))}
      <p className="whitespace-pre-wrap text-xs text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-800 rounded-lg p-2">{vistaPrevia}</p>
      <p className="text-[11px] text-gray-500 dark:text-zinc-400">
        Meta la cobra como {COSTO_CATEGORIA[elegida.category] || 'plantilla'} por envío.
      </p>
      <div className="flex justify-end gap-2">
        <button onClick={() => setElegida(null)} disabled={enviando}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800">
          Volver
        </button>
        <button onClick={enviar} disabled={enviando || faltanDatos}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">
          {enviando ? 'Enviando...' : 'Enviar plantilla'}
        </button>
      </div>
    </div>
  )
}
