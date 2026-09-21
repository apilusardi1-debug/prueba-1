import { useEffect, useRef, useState } from 'react'
import Ic from '../admin/dashboard/Ic.jsx'
import { leerEstadoAvisos } from '../../lib/avisosMensajes.js'

const VERDE = 'text-green-600 dark:text-green-400'
const AMBAR = 'text-amber-600 dark:text-amber-400'
const ROJO = 'text-red-600 dark:text-red-400'

const SONIDO = {
  listo: { texto: 'Listo', clase: VERDE },
  pendiente: { texto: 'Hacé un clic en la página para habilitarlo', clase: AMBAR },
  'no-disponible': { texto: 'No disponible en este navegador', clase: ROJO },
}
const NOTIFICACIONES = {
  activadas: { texto: 'Activadas', clase: VERDE },
  'sin-permitir': { texto: 'Falta tu permiso', clase: AMBAR },
  bloqueadas: { texto: 'Bloqueadas por el navegador. Habilitalas desde el candado de la barra de direcciones', clase: ROJO },
  'no-disponibles': { texto: 'No disponibles en este navegador', clase: ROJO },
}

// Campana de la barra superior: abre un panel para activar los avisos de mensaje
// nuevo, ver si el sonido y las notificaciones están realmente listos en este
// navegador y probarlos.
export default function MenuAvisos({ avisos }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!abierto) return
    const fuera = e => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    const tecla = e => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  function alternarPanel() {
    setAbierto(v => !v)
    setTimeout(avisos.refrescar, 300) // el clic destraba el audio: se relee el estado
  }

  const estado = leerEstadoAvisos()
  const sonido = SONIDO[estado.sonido]
  const notificaciones = NOTIFICACIONES[estado.notificaciones]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={alternarPanel}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-label={avisos.activo ? 'Avisos de mensajes nuevos: activados' : 'Avisos de mensajes nuevos: desactivados'}
        title={avisos.configurado ? 'Avisos de mensajes nuevos' : 'Todavía no activaste los avisos de mensajes nuevos'}
        className={`relative flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
          avisos.activo
            ? 'border-gray-300 bg-gray-100 text-gray-900 dark:border-zinc-600 dark:bg-white/[0.08] dark:text-white'
            : 'border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800'
        }`}
      >
        <Ic n={avisos.activo ? 'bell' : 'bellOff'} className="h-4 w-4" />
        {!avisos.configurado && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white dark:ring-zinc-950" />
        )}
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Avisos de mensajes nuevos"
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/50"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Avisos de mensajes nuevos</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-zinc-400">
                Suena y muestra una notificación cuando escribe alguien de tus conversaciones o llega una sin asignar. Solo avisa con el panel abierto.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={avisos.activo}
              aria-label="Activar avisos de mensajes nuevos"
              onClick={avisos.alternar}
              className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${avisos.activo ? 'bg-gray-900 dark:bg-zinc-100' : 'bg-gray-200 dark:bg-zinc-700'}`}
            >
              <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform dark:bg-zinc-900 ${avisos.activo ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {avisos.activo && (
            <>
              <dl className="mt-4 grid gap-2.5 text-xs">
                <div>
                  <dt className="font-semibold text-gray-500 dark:text-zinc-400">Sonido</dt>
                  <dd className={`mt-0.5 font-medium ${sonido.clase}`}>{sonido.texto}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-500 dark:text-zinc-400">Notificaciones del navegador</dt>
                  <dd className={`mt-0.5 font-medium ${notificaciones.clase}`}>{notificaciones.texto}</dd>
                  {estado.notificaciones === 'sin-permitir' && (
                    <button
                      onClick={avisos.permitirNotificaciones}
                      className="mt-1.5 rounded-lg border border-gray-200 px-2.5 py-1 font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Permitir notificaciones
                    </button>
                  )}
                </div>
              </dl>
              <button
                onClick={avisos.probar}
                className="mt-4 w-full rounded-xl border border-gray-200 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Probar aviso
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
