import { useState, useEffect } from 'react'
import { supabase, reservasApi } from '../../lib/supabase.js'
import { hoyISO } from '../../lib/embudo.js'
import Ic from '../../components/admin/dashboard/Ic.jsx'

const ETIQUETA = 'text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-500'

function estadoAviso(a) {
  if (a.confirmado_at) return { texto: 'Recibido', clase: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' }
  if (a.leido_at) return { texto: 'Leído', clase: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' }
  return { texto: 'Sin abrir', clase: 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-zinc-400' }
}

function fechaLarga(fecha) {
  if (!fecha) return 'Sin fecha'
  const texto = new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function Chip({ estado }) {
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${estado.clase}`}>{estado.texto}</span>
}

export default function OperacionesEnCurso() {
  const [operaciones, setOperaciones] = useState([])
  const [reservas, setReservas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const hoy = hoyISO()
    Promise.all([
      supabase?.from('operaciones')
        .select('id, excursion_id, fecha, cerrada_at, excursiones(nombre, hora_salida), guias(nombre), operaciones_avisos(id, destinatario, leido_at, confirmado_at, choferes(nombre), guias(nombre))')
        .gte('fecha', hoy)
        .order('fecha'),
      reservasApi.getEnCursoDesde(hoy),
    ]).then(([ops, res]) => {
      setOperaciones(ops?.data || [])
      setReservas(res?.data || [])
      setCargando(false)
    })
  }, [])

  if (cargando) return <p className="text-sm text-gray-400 dark:text-zinc-500">Cargando operaciones...</p>

  if (operaciones.length === 0) {
    return (
      <div className="dash-card py-16 text-center">
        <Ic n="car" className="mx-auto mb-3 h-8 w-8 text-gray-300 dark:text-zinc-600" />
        <p className="text-sm text-gray-500 dark:text-zinc-400">No hay operaciones en curso.</p>
        <p className="mt-1 text-xs text-gray-400 dark:text-zinc-600">Aparecen cuando se cierra una operación desde Agenda.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {operaciones.map(op => {
        const avisos = op.operaciones_avisos || []
        const choferes = avisos.filter(a => a.destinatario === 'chofer')
        const guias = avisos.filter(a => a.destinatario === 'guia')
        const pendientes = avisos.filter(a => !a.confirmado_at).length
        const clientes = reservas.filter(r => r.excursion_id === op.excursion_id && r.fecha === op.fecha)
        const personas = clientes.reduce((s, r) => s + (r.personas || 0), 0)

        return (
          <section key={op.id} className="dash-card space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-gray-900 dark:text-zinc-100">{op.excursiones?.nombre || 'Paseo'}</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  {fechaLarga(op.fecha)}{op.excursiones?.hora_salida ? ` · sale ${op.excursiones.hora_salida}` : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-bold text-sky-700 dark:text-hero-sky">{personas}</p>
                <p className="text-[11px] text-gray-500 dark:text-zinc-500">personas</p>
              </div>
            </div>

            {pendientes > 0 && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                {pendientes} {pendientes === 1 ? 'aviso sin recibir' : 'avisos sin recibir'}
              </p>
            )}

            <div>
              <p className={`${ETIQUETA} mb-2`}>Choferes</p>
              {choferes.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-zinc-600">Sin chofer asignado</p>
              ) : (
                <div className="space-y-1.5">
                  {choferes.map(a => (
                    <div key={a.id} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-gray-800 dark:text-zinc-200">{a.choferes?.nombre || 'Chofer'}</span>
                      <Chip estado={estadoAviso(a)} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className={`${ETIQUETA} mb-2`}>Guía</p>
              {guias.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-zinc-600">Sin guía asignado</p>
              ) : (
                <div className="space-y-1.5">
                  {guias.map(a => (
                    <div key={a.id} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-gray-800 dark:text-zinc-200">{a.guias?.nombre || op.guias?.nombre || 'Guía'}</span>
                      <Chip estado={estadoAviso(a)} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className={`${ETIQUETA} mb-2`}>Clientes · {clientes.length}</p>
              {clientes.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-zinc-600">Sin clientes en esta fecha</p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-white/10">
                  {clientes.map(r => (
                    <div key={r.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-zinc-100">{r.cliente_nombre || 'Cliente'}</p>
                        {(r.hospedaje || r.ubicacion) && (
                          <p className="truncate text-xs text-gray-500 dark:text-zinc-500">{r.hospedaje || r.ubicacion}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs font-medium text-gray-600 dark:text-zinc-400">{r.personas} {r.personas === 1 ? 'persona' : 'personas'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
