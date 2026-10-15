// "En curso" (dentro de Agenda): todas las actividades de HOY que tienen reservas
// (catamarán, jet ski, lancha, buggy, cualquier paseo), con la operación ya cerrada o no.
// Pedido de Cristian, 2026-10-15. Antes la pantalla de Operaciones mostraba solo las
// operaciones ya cerradas, de hoy en adelante.
//
// De cada actividad: horario, personas, si la operación ya se cerró, guía y choferes (con el
// estado de su aviso si ya se cerró; si no, los asignados en las reservas) y los clientes.
import { useState, useEffect } from 'react'
import { supabase, reservasApi, excursionesApi } from '../../lib/supabase.js'
import { hoyISO } from '../../lib/embudo.js'
import Ic from './dashboard/Ic.jsx'

const ETIQUETA = 'text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-500'

function estadoAviso(a) {
  if (a.confirmado_at) return { texto: 'Recibido', clase: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' }
  if (a.leido_at) return { texto: 'Leído', clase: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' }
  return { texto: 'Sin abrir', clase: 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-zinc-400' }
}
const SIN_AVISO = { texto: 'Sin aviso', clase: 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-zinc-400' }

function Chip({ estado }) {
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${estado.clase}`}>{estado.texto}</span>
}

function hoyLargo() {
  const texto = new Date(hoyISO() + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

// Personas (chofer o guía) sin repetir, a partir de las reservas de la actividad
function unicos(lista) {
  const porId = new Map()
  for (const p of lista) if (p?.id && !porId.has(p.id)) porId.set(p.id, p)
  return [...porId.values()]
}

export default function OperacionesDelDia() {
  const [actividades, setActividades] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const hoy = hoyISO()
    Promise.all([
      reservasApi.getEnCursoDesde(hoy),
      supabase?.from('operaciones')
        .select('id, excursion_id, fecha, cerrada_at, excursiones(nombre, hora_salida), guias(nombre), operaciones_avisos(id, destinatario, leido_at, confirmado_at, choferes(nombre), guias(nombre))')
        .eq('fecha', hoy),
      excursionesApi.getAll(),
    ]).then(([res, ops, exc]) => {
      if (res?.error || ops?.error) setError('No se pudieron cargar todas las actividades de hoy. Recargá la página.')
      const reservas = (res?.data || []).filter(r => r.fecha === hoy && r.estado !== 'cancelada')
      const operaciones = ops?.data || []
      const excursiones = new Map((exc?.data || []).map(e => [e.id, e]))

      // Una tarjeta por actividad: las que tienen reservas hoy y las que tienen la operación cerrada
      const ids = new Set([...reservas.map(r => r.excursion_id), ...operaciones.map(o => o.excursion_id)].filter(Boolean))
      const lista = [...ids].map(id => {
        const op = operaciones.find(o => o.excursion_id === id) || null
        const clientes = reservas.filter(r => r.excursion_id === id)
        const excursion = excursiones.get(id)
        return {
          id,
          nombre: op?.excursiones?.nombre || excursion?.nombre || clientes[0]?.excursiones?.nombre || 'Actividad',
          hora: op?.excursiones?.hora_salida || excursion?.hora_salida || '',
          op,
          clientes,
          personas: clientes.reduce((s, r) => s + (r.personas || 0), 0),
        }
      })
      // Sin reservas pero sin excursión asociada (reservas viejas sin excursion_id): se agrupan aparte
      const sueltas = reservas.filter(r => !r.excursion_id)
      if (sueltas.length) lista.push({ id: 'sin-actividad', nombre: 'Reservas sin actividad asignada', hora: '', op: null, clientes: sueltas, personas: sueltas.reduce((s, r) => s + (r.personas || 0), 0) })

      lista.sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99') || a.nombre.localeCompare(b.nombre))
      setActividades(lista)
      setCargando(false)
    })
  }, [])

  if (cargando) return <p className="text-sm text-gray-400 dark:text-zinc-500">Cargando las actividades de hoy...</p>

  const sinCerrar = actividades.filter(a => !a.op).length
  const totalPersonas = actividades.reduce((s, a) => s + a.personas, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-base font-bold text-gray-900 dark:text-zinc-100">{hoyLargo()}</p>
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          {actividades.length} {actividades.length === 1 ? 'actividad' : 'actividades'} · {totalPersonas} {totalPersonas === 1 ? 'persona' : 'personas'}
          {sinCerrar > 0 && <span className="font-semibold text-amber-600 dark:text-amber-400"> · {sinCerrar} sin cerrar</span>}
        </p>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

      {actividades.length === 0 ? (
        <div className="dash-card py-16 text-center">
          <Ic n="car" className="mx-auto mb-3 h-8 w-8 text-gray-300 dark:text-zinc-600" />
          <p className="text-sm text-gray-500 dark:text-zinc-400">No hay actividades con reservas para hoy.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {actividades.map(a => {
            const avisos = a.op?.operaciones_avisos || []
            const choferesCerrada = avisos.filter(x => x.destinatario === 'chofer')
            const guiasCerrada = avisos.filter(x => x.destinatario === 'guia')
            const pendientes = avisos.filter(x => !x.confirmado_at).length
            const choferesReservas = unicos(a.clientes.map(r => r.choferes))
            const guiasReservas = unicos(a.clientes.map(r => r.guias))

            return (
              <section key={a.id} className="dash-card space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-gray-900 dark:text-zinc-100">{a.nombre}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">{a.hora ? `Sale ${a.hora}` : 'Sin horario de salida'}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold text-sky-700 tabular-nums dark:text-hero-sky">{a.personas}</p>
                    <p className="text-[11px] text-gray-500 dark:text-zinc-500">personas</p>
                  </div>
                </div>

                {a.op ? (
                  <p className="rounded-xl bg-green-50 px-3 py-2 text-xs font-medium text-green-700 dark:bg-green-950/30 dark:text-green-400">
                    Operación cerrada{pendientes > 0 ? ` · ${pendientes} ${pendientes === 1 ? 'aviso sin recibir' : 'avisos sin recibir'}` : ' · todos los avisos recibidos'}
                  </p>
                ) : (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                    Sin cerrar: falta "Cerrar operación" en el calendario para avisar a guía y choferes.
                  </p>
                )}

                <div>
                  <p className={`${ETIQUETA} mb-2`}>Choferes</p>
                  {a.op ? (
                    choferesCerrada.length === 0 ? <p className="text-sm text-gray-400 dark:text-zinc-600">Sin chofer asignado</p> : (
                      <div className="space-y-1.5">
                        {choferesCerrada.map(x => (
                          <div key={x.id} className="flex items-center justify-between gap-3">
                            <span className="text-sm text-gray-800 dark:text-zinc-200">{x.choferes?.nombre || 'Chofer'}</span>
                            <Chip estado={estadoAviso(x)} />
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    choferesReservas.length === 0 ? <p className="text-sm text-gray-400 dark:text-zinc-600">Sin chofer asignado</p> : (
                      <div className="space-y-1.5">
                        {choferesReservas.map(c => (
                          <div key={c.id} className="flex items-center justify-between gap-3">
                            <span className="text-sm text-gray-800 dark:text-zinc-200">{c.nombre}</span>
                            <Chip estado={SIN_AVISO} />
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>

                <div>
                  <p className={`${ETIQUETA} mb-2`}>Guía</p>
                  {a.op ? (
                    guiasCerrada.length === 0 ? <p className="text-sm text-gray-400 dark:text-zinc-600">Sin guía asignado</p> : (
                      <div className="space-y-1.5">
                        {guiasCerrada.map(x => (
                          <div key={x.id} className="flex items-center justify-between gap-3">
                            <span className="text-sm text-gray-800 dark:text-zinc-200">{x.guias?.nombre || a.op.guias?.nombre || 'Guía'}</span>
                            <Chip estado={estadoAviso(x)} />
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    guiasReservas.length === 0 ? <p className="text-sm text-gray-400 dark:text-zinc-600">Sin guía asignado</p> : (
                      <div className="space-y-1.5">
                        {guiasReservas.map(g => (
                          <div key={g.id} className="flex items-center justify-between gap-3">
                            <span className="text-sm text-gray-800 dark:text-zinc-200">{g.nombre}</span>
                            <Chip estado={SIN_AVISO} />
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>

                <div>
                  <p className={`${ETIQUETA} mb-2`}>Clientes · {a.clientes.length}</p>
                  {a.clientes.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-zinc-600">Sin clientes en esta fecha</p>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-white/10">
                      {a.clientes.map(r => (
                        <div key={r.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-zinc-100">{r.cliente_nombre || 'Cliente'}</p>
                            {(r.hospedaje || r.ubicacion) && <p className="truncate text-xs text-gray-500 dark:text-zinc-500">{r.hospedaje || r.ubicacion}</p>}
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
      )}
    </div>
  )
}
