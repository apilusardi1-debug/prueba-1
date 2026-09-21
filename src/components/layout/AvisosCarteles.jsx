import { useEffect, useState } from 'react'
import Ic from '../admin/dashboard/Ic.jsx'

const DURACION_MS = 15000

// Un cartel de aviso: se cierra solo a los 15 segundos (se detiene mientras el
// mouse está encima) y al hacer clic abre la conversación.
function Cartel({ cartel, alCerrar, alAbrir }) {
  const [encima, setEncima] = useState(false)

  useEffect(() => {
    if (encima) return
    const t = setTimeout(() => alCerrar(cartel.id), DURACION_MS)
    return () => clearTimeout(t)
  }, [encima, cartel.id, alCerrar])

  const abrible = !!cartel.whatsapp

  return (
    <div
      role="alert"
      onMouseEnter={() => setEncima(true)}
      onMouseLeave={() => setEncima(false)}
      onClick={() => (abrible ? alAbrir(cartel) : alCerrar(cartel.id))}
      className="aviso-cartel pointer-events-auto flex cursor-pointer items-start gap-3 rounded-2xl border border-green-500/40 bg-white p-3.5 shadow-xl ring-1 ring-green-500/20 dark:border-green-400/30 dark:bg-zinc-900 dark:shadow-black/60"
    >
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-content-center rounded-full bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400">
        <Ic n="chat" className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{cartel.titulo}</p>
        <p className="mt-0.5 line-clamp-2 break-words text-xs text-gray-600 dark:text-zinc-300">{cartel.cuerpo}</p>
        {abrible && <p className="mt-1.5 text-[11px] font-bold text-green-700 dark:text-green-400">Abrir conversación</p>}
      </div>
      <button
        onClick={e => { e.stopPropagation(); alCerrar(cartel.id) }}
        aria-label="Cerrar aviso"
        className="-mr-1 -mt-1 grid h-6 w-6 shrink-0 place-content-center rounded-md text-base leading-none text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-zinc-200"
      >
        ×
      </button>
    </div>
  )
}

// Carteles de mensaje nuevo, arriba a la derecha. Se ven aunque el sistema
// operativo bloquee las notificaciones del navegador.
export default function AvisosCarteles({ carteles, alCerrar, alAbrir }) {
  if (!carteles.length) return null
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-20 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3"
    >
      {carteles.map(c => (
        <Cartel key={c.id} cartel={c} alCerrar={alCerrar} alAbrir={alAbrir} />
      ))}
    </div>
  )
}
