import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Ic from '../admin/dashboard/Ic.jsx'
import { useAlertas } from '../../lib/useAlertas.jsx'
import { tieneAcceso } from '../../lib/roles.js'

// Campanita de alertas de operaciones, al lado de la de mensajes: el número es la cantidad de
// alertas activas (rojo si hay alguna urgente). Abre la lista; tocar una lleva a donde se arregla.
export default function MenuAlertas() {
  const { alertas, sonidoActivo, alternarSonido, permitirNotificaciones, cargando } = useAlertas()
  const navigate = useNavigate()
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

  const rol = JSON.parse(localStorage.getItem('admin_session') || '{}').role
  const urgentes = alertas.filter(a => a.gravedad === 'alta').length
  const permiso = typeof Notification === 'undefined' ? 'no-disponibles' : Notification.permission

  function ir(ruta) {
    setAbierto(false)
    navigate(ruta)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAbierto(v => !v)}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-label={alertas.length ? `Alertas de operaciones: ${alertas.length}` : 'Alertas de operaciones: ninguna'}
        title="Alertas de operaciones"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <Ic n="alert" className="h-4 w-4" />
        {alertas.length > 0 && (
          <span className={`absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-zinc-950 ${urgentes ? 'bg-red-500' : 'bg-amber-500'}`}>
            {alertas.length > 99 ? '99+' : alertas.length}
          </span>
        )}
      </button>

      {abierto && (
        <div role="dialog" aria-label="Alertas de operaciones"
          className="absolute right-0 top-full z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/50">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-zinc-800">
            <p className="text-sm font-bold text-gray-900 dark:text-white">Alertas de operaciones</p>
            {tieneAcceso(rol, '/admin/alertas') && (
              <button onClick={() => ir('/admin/alertas')} className="text-xs font-semibold text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white">Configurar</button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {cargando && <p className="px-4 py-6 text-center text-xs text-gray-400 dark:text-zinc-500">Cargando...</p>}
            {!cargando && !alertas.length && <p className="px-4 py-6 text-center text-xs text-gray-400 dark:text-zinc-500">Todo en orden: no hay alertas.</p>}
            {alertas.map(a => (
              <button key={a.id} onClick={() => ir(a.ruta)}
                className="flex w-full items-start gap-3 border-b border-gray-50 px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-gray-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/60">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.gravedad === 'alta' ? 'bg-red-500' : 'bg-amber-400'}`} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold leading-snug text-gray-900 dark:text-zinc-100">{a.titulo}</span>
                  <span className="block text-xs text-gray-500 dark:text-zinc-400">{a.detalle}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-2 border-t border-gray-100 px-4 py-3 text-xs dark:border-zinc-800">
            <label className="flex items-center justify-between gap-3 text-gray-600 dark:text-zinc-300">
              Sonido cuando aparece una alerta nueva
              <button role="switch" aria-checked={sonidoActivo} onClick={alternarSonido}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${sonidoActivo ? 'bg-gray-900 dark:bg-zinc-100' : 'bg-gray-200 dark:bg-zinc-700'}`}>
                <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform dark:bg-zinc-900 ${sonidoActivo ? 'translate-x-4' : ''}`} />
              </button>
            </label>
            <div className="flex items-center justify-between gap-3 text-gray-600 dark:text-zinc-300">
              <span>Notificación del navegador</span>
              {permiso === 'granted' && <span className="font-medium text-green-600 dark:text-green-400">Activada</span>}
              {permiso === 'default' && (
                <button onClick={permitirNotificaciones} className="rounded-lg border border-gray-200 px-2.5 py-1 font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">Permitir</button>
              )}
              {permiso === 'denied' && <span className="font-medium text-red-600 dark:text-red-400">Bloqueada en el navegador</span>}
              {permiso === 'no-disponibles' && <span className="font-medium text-gray-400 dark:text-zinc-500">No disponible</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
