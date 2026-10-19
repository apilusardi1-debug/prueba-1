// Notas rápidas del panel del chat: observaciones que el equipo anota mientras conversa.
// Son las mismas notas de la ficha única (tabla notas_clientes, por lead y/o cliente), así
// lo que se escribe acá aparece en la ficha y al revés. Enter guarda; Shift+Enter, otra línea.
import { useState, useEffect } from 'react'
import { notasClienteApi } from '../../lib/supabase.js'
import { avisar, confirmar } from '../ui/Avisos.jsx'

function fmtFechaHora(f) {
  return new Date(f).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function NotasRapidas({ leadId, clienteId }) {
  const [notas, setNotas] = useState([])
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let cancelado = false
    setNotas([])
    notasClienteApi.getByPersona(leadId, clienteId).then(({ data }) => {
      if (!cancelado) setNotas(data || [])
    })
    return () => { cancelado = true }
  }, [leadId, clienteId])

  async function agregar() {
    const contenido = texto.trim()
    if (!contenido || guardando) return
    setGuardando(true)
    const { data, error } = await notasClienteApi.create({ lead_id: leadId || null, cliente_id: clienteId || null, contenido })
    setGuardando(false)
    if (error) return avisar('No se pudo guardar la nota: ' + error.message)
    if (data) { setNotas(prev => [data, ...prev]); setTexto('') }
  }

  async function borrar(id) {
    if (!await confirmar('¿Borrar esta nota?')) return
    const { error } = await notasClienteApi.delete(id)
    if (error) return avisar('No se pudo borrar la nota: ' + error.message)
    setNotas(prev => prev.filter(n => n.id !== id))
  }

  const sinFicha = !leadId && !clienteId

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-400/20 dark:bg-amber-400/[0.06]" aria-label="Notas rápidas">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">Notas rápidas</p>
      {sinFicha ? (
        <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400">Este contacto todavía no tiene ficha. Las notas se pueden cargar cuando se cree su lead.</p>
      ) : (
        <>
          <label htmlFor="nota-rapida" className="sr-only">Nota rápida</label>
          <textarea
            id="nota-rapida"
            rows={2}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); agregar() } }}
            placeholder="Anotá algo importante de la charla..."
            className="mt-2 w-full resize-none rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="text-[11px] text-gray-400 dark:text-zinc-500">Enter para guardar · también se ven en la ficha</p>
            <button
              onClick={agregar}
              disabled={!texto.trim() || guardando}
              className="shrink-0 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
          {notas.length > 0 && (
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {notas.map(n => (
                <li key={n.id} className="flex items-start justify-between gap-2 rounded-lg bg-white px-3 py-2 dark:bg-zinc-900/70">
                  <div className="min-w-0">
                    <p className="whitespace-pre-line break-words text-sm text-gray-800 dark:text-zinc-200">{n.contenido}</p>
                    <p className="mt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">{n.autor && <span className="font-medium">{n.autor} · </span>}{fmtFechaHora(n.created_at)}</p>
                  </div>
                  <button onClick={() => borrar(n.id)} aria-label="Borrar nota" className="shrink-0 text-sm text-gray-300 transition-colors hover:text-red-400 dark:text-zinc-600 dark:hover:text-red-400">×</button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
