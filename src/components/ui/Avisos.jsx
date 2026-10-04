import { useEffect, useState } from 'react'

// Reemplazo de alert() y confirm(): el aviso aparece en el centro de la pagina
// con el diseño del panel, en vez de la ventana del navegador. Se monta una vez
// (AvisosPagina en App.jsx) y se llama desde cualquier lado con avisar() o
// confirmar(). Los avisos se muestran de a uno, en orden.

let cola = []
const oyentes = new Set()
let siguienteId = 1

function notificar() {
  oyentes.forEach(fn => fn([...cola]))
}

export function avisar(mensaje) {
  return new Promise(resolver => {
    cola.push({ id: siguienteId++, mensaje, tipo: 'aviso', resolver })
    notificar()
  })
}

export function confirmar(mensaje) {
  return new Promise(resolver => {
    cola.push({ id: siguienteId++, mensaje, tipo: 'confirmar', resolver })
    notificar()
  })
}

function cerrar(id, aceptado) {
  const item = cola.find(x => x.id === id)
  cola = cola.filter(x => x.id !== id)
  notificar()
  item?.resolver(item.tipo === 'confirmar' ? aceptado : undefined)
}

export function AvisosPagina() {
  const [items, setItems] = useState([])
  const actual = items[0]

  useEffect(() => {
    oyentes.add(setItems)
    return () => oyentes.delete(setItems)
  }, [])

  useEffect(() => {
    if (!actual) return
    const teclado = e => {
      if (e.key === 'Escape') cerrar(actual.id, false)
      if (e.key === 'Enter') cerrar(actual.id, true)
    }
    window.addEventListener('keydown', teclado)
    return () => window.removeEventListener('keydown', teclado)
  }, [actual?.id])

  if (!actual) return null
  const esConfirmacion = actual.tipo === 'confirmar'

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={() => cerrar(actual.id, false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 dark:shadow-black/40"
        onClick={e => e.stopPropagation()}
      >
        <p className="whitespace-pre-line text-sm leading-relaxed text-gray-800 dark:text-zinc-200">{actual.mensaje}</p>
        <div className="mt-5 flex justify-end gap-2">
          {esConfirmacion && (
            <button
              onClick={() => cerrar(actual.id, false)}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
          )}
          <button
            autoFocus
            onClick={() => cerrar(actual.id, true)}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {esConfirmacion ? 'Aceptar' : 'Entendido'}
          </button>
        </div>
      </div>
    </div>
  )
}
