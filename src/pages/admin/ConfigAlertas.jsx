// Configuración > Alertas (pedido de Cristian, 2026-10-29): qué alertas de operaciones están
// prendidas y con qué números (hora, días, horas). Vale para todo el equipo. Las alertas
// se ven en la campanita del panel y en el Dashboard (ver src/lib/alertas.js).
import { useState, useEffect } from 'react'
import { useAlertas } from '../../lib/useAlertas.jsx'
import { REGLAS, configCompleta, configPorDefecto, guardarConfigAlertas } from '../../lib/alertas.js'
import { avisar } from '../../components/ui/Avisos.jsx'

const CAMPO = 'w-20 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2 text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-400'
const TARJETA = 'bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm'
const BTN_PRINCIPAL = 'text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors bg-brand-500 dark:bg-brand-600 hover:bg-brand-600 dark:hover:bg-brand-700 text-white disabled:opacity-40'
const BTN_SECUNDARIO = 'text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors border bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 disabled:opacity-40'

export default function ConfigAlertas() {
  const { config, columnaFalta, alertas, recargar } = useAlertas()
  const [borrador, setBorrador] = useState(config)
  const [guardando, setGuardando] = useState(false)
  useEffect(() => { setBorrador(config) }, [config])

  const cambiado = JSON.stringify(configCompleta(borrador)) !== JSON.stringify(config)
  const cuantas = (clave) => alertas.filter(a => a.regla === clave).length

  function poner(regla, campo, valor) {
    setBorrador(prev => ({ ...prev, [regla]: { ...prev[regla], [campo]: valor } }))
  }

  async function guardar() {
    setGuardando(true)
    const { error } = await guardarConfigAlertas(borrador)
    setGuardando(false)
    if (error) {
      avisar(columnaFalta
        ? 'No se pudo guardar: falta correr el SQL de las alertas en Supabase (migración 20261029110000_alertas_config.sql).'
        : `No se pudo guardar: ${error.message || 'error desconocido'}`)
      return
    }
    await recargar()
    avisar('Guardado. Las alertas se recalculan con los números nuevos.')
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Alertas de operaciones</h1>
        <p className="text-gray-400 dark:text-zinc-500 text-sm">
          Qué avisos aparecen en la campanita y en el Dashboard. Lo ven todos los que tienen acceso a Agenda, y solo con el panel abierto.
        </p>
      </div>

      {columnaFalta && (
        <p className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Todavía no se corrió el SQL de las alertas en Supabase (<code>20261029110000_alertas_config.sql</code>). Mientras tanto valen los números de fábrica y no se puede guardar.
        </p>
      )}

      <div className="space-y-3">
        {REGLAS.map(r => {
          const c = borrador[r.clave]
          return (
            <div key={r.clave} className={`${TARJETA} p-5`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                    {r.titulo}
                    {cuantas(r.clave) > 0 && <span className="ml-2 text-xs font-medium text-gray-400 dark:text-zinc-500">{cuantas(r.clave)} ahora</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">{r.descripcion}</p>
                </div>
                <button role="switch" aria-checked={c.activa} aria-label={`Activar: ${r.titulo}`} onClick={() => poner(r.clave, 'activa', !c.activa)}
                  className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${c.activa ? 'bg-gray-900 dark:bg-zinc-100' : 'bg-gray-200 dark:bg-zinc-700'}`}>
                  <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform dark:bg-zinc-900 ${c.activa ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              {c.activa && r.campos.map(campo => (
                <div key={campo.clave} className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-zinc-300">
                  {campo.etiqueta}
                  <input type="number" min={campo.min} max={campo.max} className={CAMPO} value={c[campo.clave] ?? ''}
                    onChange={e => poner(r.clave, campo.clave, e.target.value)} />
                  {campo.unidad}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button onClick={() => setBorrador(configPorDefecto())} className={BTN_SECUNDARIO}>Volver a los valores de fábrica</button>
        <button onClick={guardar} disabled={!cambiado || guardando} className={BTN_PRINCIPAL}>{guardando ? 'Guardando...' : 'Guardar'}</button>
      </div>
    </div>
  )
}
