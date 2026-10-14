// Campos de la ficha del lead que comparten el tablero de Leads y la ficha única
// (src/components/ficha/FichaPersona.jsx).
import { useState } from 'react'
import { TIPOS_INTERES, DESTINOS_INTERES } from '../../../supabase/functions/_shared/interes.ts'
import { EMBUDOS, etapasDelEmbudo } from '../../lib/embudo.js'

// Motivos de pérdida que se piden al mover un lead a mano a una etapa
// "perdida" (como el combo de Kommo). Lista corta a propósito, por ahora.
export const RAZONES_PERDIDA = [
  { id: 'no_responde', label: 'No responde' },
  { id: 'no_aplica', label: 'No aplica' },
]

// Tipo de servicio + destino. El destino es texto libre con sugerencias, porque
// un lead puede interesarse en más de uno ("Porto de Galinhas + Maragogi").
export function CampoInteres({ tipo, destino, onChange, ayuda, grande }) {
  const campo = grande
    ? 'w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'
    : 'w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-500'
  return (
    <div>
      <label className={grande ? 'text-sm font-medium text-gray-700 dark:text-zinc-300 block mb-1' : 'text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1'}>Interés</label>
      <div className="grid grid-cols-2 gap-2">
        <select value={tipo || ''} onChange={e => onChange({ interes_tipo: e.target.value })} className={campo}>
          <option value="">— Tipo</option>
          {TIPOS_INTERES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <input
          type="text"
          list="destinos-interes"
          value={destino || ''}
          onChange={e => onChange({ interes_destino: e.target.value })}
          placeholder="Destino"
          className={campo}
        />
      </div>
      <datalist id="destinos-interes">
        {DESTINOS_INTERES.map(d => <option key={d} value={d} />)}
      </datalist>
      {ayuda && <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-1">{ayuda}</p>}
    </div>
  )
}

// Todo el dinero del sistema va en reales
const FORMATO_REALES = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export function formatoReales(n) {
  return FORMATO_REALES.format(Number(n) || 0)
}

// Etiquetas libres de un lead (VIVO, ENTRO POR PASEOS...): se escriben con
// Enter o coma, se quitan con la cruz y sugieren las que ya usan otros leads.
export function CampoEtiquetas({ etiquetas, onChange, sugerencias }) {
  const [texto, setTexto] = useState('')

  function agregar(valor) {
    const limpio = valor.trim().replace(/\s+/g, ' ').slice(0, 30)
    setTexto('')
    if (!limpio || etiquetas.some(e => e.toLowerCase() === limpio.toLowerCase())) return
    onChange([...etiquetas, limpio])
  }

  return (
    <div>
      <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Etiquetas</label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2.5 py-2 focus-within:ring-2 focus-within:ring-brand-400/30 dark:border-zinc-700 dark:bg-zinc-800">
        {etiquetas.map(e => (
          <span key={e} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:border-white/15 dark:text-zinc-300">
            {e}
            <button
              type="button"
              onClick={() => onChange(etiquetas.filter(x => x !== e))}
              aria-label={`Quitar la etiqueta ${e}`}
              className="text-sm leading-none text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          list="etiquetas-leads"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); agregar(texto) }
            else if (e.key === 'Backspace' && !texto && etiquetas.length) onChange(etiquetas.slice(0, -1))
          }}
          onBlur={() => agregar(texto)}
          placeholder={etiquetas.length ? '' : 'Escribí y apretá Enter'}
          aria-label="Agregar una etiqueta"
          className="min-w-[90px] flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none dark:text-zinc-100 dark:placeholder-zinc-500"
        />
      </div>
      <datalist id="etiquetas-leads">
        {sugerencias.filter(x => !etiquetas.includes(x)).map(x => <option key={x} value={x} />)}
      </datalist>
    </div>
  )
}

// Opciones de un selector de etapa. Con más de un embudo se agrupan por embudo, así
// también sirve para pasar un lead de un embudo a otro.
export function OpcionesEtapas({ etapas, claseOpcion }) {
  const grupos = EMBUDOS.map(e => ({ ...e, lista: etapasDelEmbudo(etapas, e.clave) })).filter(g => g.lista.length)
  const opcion = e => <option key={e.clave} value={e.clave} className={claseOpcion}>{e.nombre}</option>
  if (grupos.length <= 1) return etapas.map(opcion)
  return grupos.map(g => <optgroup key={g.clave} label={g.nombre}>{g.lista.map(opcion)}</optgroup>)
}
