import { useState, useEffect } from 'react'
import { propuestasApi } from '../../../lib/supabase.js'

function formatPrecio(n, moneda = 'BRL') {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moneda }).format(n || 0)
}

const TITULOS = {
  enviada: { titulo: 'Propuestas enviadas', vacio: 'No hay propuestas enviadas todavía.' },
  cerrada: { titulo: 'Propuestas cerradas', vacio: 'Todavía no se cerró ninguna propuesta.' },
  rechazada: { titulo: 'Propuestas rechazadas', vacio: 'No hay propuestas rechazadas.' },
}

export default function PropuestasLista({ estado }) {
  const [propuestas, setPropuestas] = useState([])
  const [loading, setLoading] = useState(true)
  const [procesandoId, setProcesandoId] = useState(null)
  const { titulo, vacio } = TITULOS[estado] || TITULOS.enviada

  useEffect(() => { cargar() }, [estado])

  async function cargar() {
    setLoading(true)
    const { data } = await propuestasApi.getByEstado(estado)
    setPropuestas(data || [])
    setLoading(false)
  }

  async function cambiarEstado(id, nuevoEstado) {
    setProcesandoId(id)
    await propuestasApi.actualizarEstado(id, nuevoEstado)
    setPropuestas(prev => prev.filter(p => p.id !== id))
    setProcesandoId(null)
  }

  function fechaTexto(p) {
    if (estado === 'cerrada' && p.cerrada_at) return `Cerrada el ${new Date(p.cerrada_at).toLocaleDateString('es-AR')}`
    if (estado === 'rechazada' && p.cerrada_at) return `Rechazada el ${new Date(p.cerrada_at).toLocaleDateString('es-AR')}`
    return `Enviada el ${new Date(p.created_at).toLocaleDateString('es-AR')}`
  }

  if (loading) return <div className="p-8 text-gray-400 dark:text-zinc-500">Cargando...</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">{titulo}</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">{propuestas.length} propuesta{propuestas.length !== 1 ? 's' : ''}</p>
      </div>

      {propuestas.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-zinc-500 text-sm">{vacio}</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {propuestas.map(p => (
            <div key={p.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-bold text-gray-900 dark:text-zinc-100">{p.cliente_nombre}</p>
                  {p.cliente_whatsapp && (
                    <a href={`https://wa.me/${p.cliente_whatsapp}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-green-600 dark:text-green-400 hover:underline">💬 {p.cliente_whatsapp}</a>
                  )}
                </div>
                <p className="font-bold text-brand-700 dark:text-brand-400 whitespace-nowrap">{formatPrecio(p.total, p.moneda)}</p>
              </div>
              <div className="space-y-1 mb-3">
                {(p.items || []).map((it, i) => (
                  <p key={i} className="text-xs text-gray-500 dark:text-zinc-400">• {it.nombre} x{it.cantidad} — {formatPrecio(it.precio, p.moneda)}</p>
                ))}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-zinc-800">
                <p className="text-xs text-gray-400 dark:text-zinc-500">{fechaTexto(p)}</p>
                {estado === 'enviada' && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => cambiarEstado(p.id, 'rechazada')}
                      disabled={procesandoId === p.id}
                      className="text-xs font-semibold text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
                    >
                      ✕ Rechazada
                    </button>
                    <button
                      onClick={() => cambiarEstado(p.id, 'cerrada')}
                      disabled={procesandoId === p.id}
                      className="text-xs font-semibold text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 disabled:opacity-50"
                    >
                      ✓ Marcar como cerrada
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
