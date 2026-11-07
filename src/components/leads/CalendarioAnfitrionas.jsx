// Calendario de las anfitrionas (solo embudo de Anfitriona, aparte del tablero). Pedido de Cristian,
// Florencia y Marcos, 2026-11.
//  - Tareas: los recordatorios que arma el embudo solo (creado_por = 'Automatización'). Son las
//    que ordenan el trabajo; un cliente sin tareas ni recordatorios no aparece.
//  - Recordatorios: los que crea una persona a mano. Se ven con borde punteado.
//  - Eventos del viaje: llegada, regreso, check in y check out. Solo de clientes que tienen tareas.
// La anfitriona de cada ítem es el responsable del lead. Un color por anfitriona (fijado por ahora).
import { useState, useMemo } from 'react'
import Ic from '../admin/dashboard/Ic.jsx'
import { hoyISO } from '../../lib/embudo.js'

// Tonos fijos por ahora (hasta definir la estética): Vicky celeste, Agostina violeta
const TONOS = {
  vicky: { nombre: 'Vicky', punto: 'bg-sky-500', tarea: 'bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-100', borde: 'border-sky-400 text-sky-800 dark:border-sky-500 dark:text-sky-200' },
  agostina: { nombre: 'Agostina', punto: 'bg-violet-500', tarea: 'bg-violet-100 text-violet-900 dark:bg-violet-950/60 dark:text-violet-100', borde: 'border-violet-400 text-violet-800 dark:border-violet-500 dark:text-violet-200' },
}
const TONO_SIN = { nombre: 'Sin asignar', punto: 'bg-gray-400', tarea: 'bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-zinc-200', borde: 'border-gray-400 text-gray-700 dark:border-zinc-500 dark:text-zinc-300' }
const EVENTO = 'bg-transparent text-gray-500 dark:text-zinc-400'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const esTarea = r => r.creado_por === 'Automatización'
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

function claveTono(usuario) {
  const primero = String(usuario?.nombre || '').trim().toLowerCase().split(/\s+/)[0]
  return TONOS[primero] ? primero : null
}

function fechaLarga(f) {
  const d = new Date(f + 'T12:00:00')
  const t = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function nombreSesion() {
  try {
    const s = JSON.parse(localStorage.getItem('admin_session') || '{}')
    return s.nombre || s.email || ''
  } catch (_) { return '' }
}

export default function CalendarioAnfitrionas({ leads, recordatorios, hospedajes, usuarios, onAbrirLead, onCompletar, onEliminar, onCrear }) {
  const hoy = hoyISO()
  const [mes, setMes] = useState(() => ({ y: Number(hoy.slice(0, 4)), m: Number(hoy.slice(5, 7)) - 1 }))
  const [dia, setDia] = useState(hoy)
  const [filtro, setFiltro] = useState('todas') // todas | vicky | agostina | sin
  const [nuevo, setNuevo] = useState({ leadId: '', nota: '' })
  const [guardando, setGuardando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(0)

  const tonoDeLead = useMemo(() => {
    const porId = new Map(usuarios.map(u => [u.id, u]))
    return lead => {
      const clave = claveTono(porId.get(lead?.responsable_id))
      return clave ? { clave, ...TONOS[clave] } : { clave: 'sin', ...TONO_SIN }
    }
  }, [usuarios])

  const leadPorId = useMemo(() => new Map(leads.map(l => [l.id, l])), [leads])

  // Todos los ítems del calendario, por fecha
  const porFecha = useMemo(() => {
    const items = []
    const conTareas = new Set()
    for (const r of recordatorios) {
      const lead = leadPorId.get(r.lead_id)
      if (!lead || !r.fecha) continue
      if (esTarea(r)) conTareas.add(lead.id)
      items.push({ clave: 'r' + r.id, tipo: esTarea(r) ? 'tarea' : 'recordatorio', fecha: r.fecha, texto: r.nota, lead, rec: r })
    }
    const evento = (lead, fecha, texto) => { if (fecha && conTareas.has(lead.id)) items.push({ clave: `e${lead.id}${texto}${fecha}`, tipo: 'evento', fecha, texto, lead }) }
    for (const l of leads) {
      evento(l, l.fecha_vuelo_ida, 'Llega')
      evento(l, l.fecha_vuelo_vuelta, 'Regresa')
    }
    for (const h of hospedajes) {
      const lead = leadPorId.get(h.lead_id)
      if (!lead) continue
      evento(lead, h.fecha_checkin, `Check in ${h.nombre}`)
      evento(lead, h.fecha_checkout, `Check out ${h.nombre}`)
    }
    const orden = { tarea: 0, recordatorio: 1, evento: 2 }
    const mapa = {}
    for (const it of items) {
      if (it.fecha < hoy) continue // el calendario muestra solo desde hoy en adelante (pedido de Cristian, 2026-11-07)
      const tono = tonoDeLead(it.lead)
      if (filtro !== 'todas' && tono.clave !== filtro) continue
      ;(mapa[it.fecha] ||= []).push({ ...it, tono })
    }
    for (const f of Object.keys(mapa)) mapa[f].sort((a, b) => orden[a.tipo] - orden[b.tipo] || a.lead.nombre.localeCompare(b.lead.nombre))
    return mapa
  }, [recordatorios, leads, hospedajes, leadPorId, tonoDeLead, filtro, hoy])

  // Grilla del mes (empieza en lunes)
  const celdas = useMemo(() => {
    const primero = new Date(mes.y, mes.m, 1)
    const hueco = (primero.getDay() + 6) % 7
    const total = new Date(mes.y, mes.m + 1, 0).getDate()
    const lista = []
    for (let i = 0; i < hueco; i++) lista.push(null)
    for (let d = 1; d <= total; d++) lista.push(iso(mes.y, mes.m, d))
    while (lista.length % 7) lista.push(null)
    return lista
  }, [mes])

  const moverMes = delta => setMes(({ y, m }) => { const d = new Date(y, m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  const irHoy = () => { setMes({ y: Number(hoy.slice(0, 4)), m: Number(hoy.slice(5, 7)) - 1 }); setDia(hoy) }

  const delDia = porFecha[dia] || []

  async function crear(e) {
    e.preventDefault()
    if (!nuevo.leadId || !nuevo.nota.trim() || guardando) return
    setGuardando(true)
    const ok = await onCrear({ lead_id: nuevo.leadId, fecha: dia, nota: nuevo.nota.trim(), creado_por: nombreSesion() || 'Manual' })
    setGuardando(false)
    if (ok) setNuevo({ leadId: nuevo.leadId, nota: '' })
  }

  const filtros = [['todas', 'Todas', null], ['vicky', 'Vicky', TONOS.vicky.punto], ['agostina', 'Agostina', TONOS.agostina.punto], ['sin', 'Sin asignar', TONO_SIN.punto]]
  const clientes = [...leads].sort((a, b) => a.nombre.localeCompare(b.nombre))

  // Buscador de cliente: se escribe y filtra (sin mayúsculas ni acentos, también por teléfono)
  const sinAcentos = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const coincidencias = useMemo(() => {
    const q = sinAcentos(busqueda).trim()
    if (!q) return clientes.slice(0, 8)
    const solo = q.replace(/\D/g, '')
    return clientes.filter(l => sinAcentos(l.nombre).includes(q) || (solo.length >= 3 && String(l.whatsapp || '').replace(/\D/g, '').includes(solo))).slice(0, 8)
  }, [busqueda, clientes])
  const elegirCliente = l => { setNuevo(p => ({ ...p, leadId: l.id })); setBusqueda(l.nombre); setAbierto(false) }
  const teclaBuscador = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setActivo(i => Math.min(i + 1, coincidencias.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && abierto && coincidencias[activo]) { e.preventDefault(); elegirCliente(coincidencias[activo]) }
    else if (e.key === 'Escape') setAbierto(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => moverMes(-1)} aria-label="Mes anterior" className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">‹</button>
          <p className="min-w-[10rem] text-center text-base font-bold text-gray-900 dark:text-zinc-100">{MESES[mes.m]} {mes.y}</p>
          <button onClick={() => moverMes(1)} aria-label="Mes siguiente" className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">›</button>
        </div>
        <button onClick={irHoy} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">Hoy</button>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por anfitriona">
          {filtros.map(([clave, nombre, punto]) => (
            <button key={clave} onClick={() => setFiltro(clave)} aria-pressed={filtro === clave}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${filtro === clave ? 'bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'border border-gray-300 text-gray-600 dark:border-zinc-600 dark:text-zinc-300'}`}>
              {punto && <i className={`h-2 w-2 rounded-full ${punto}`} />}{nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 overflow-x-auto">
          <div className="grid min-w-[640px] grid-cols-7 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 dark:border-white/10 dark:bg-white/10">
            {DIAS.map(d => <div key={d} className="bg-gray-50 px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:bg-zinc-900 dark:text-zinc-500">{d}</div>)}
            {celdas.map((f, i) => {
              if (!f) return <div key={'v' + i} className="min-h-[92px] bg-gray-50/60 dark:bg-zinc-950/40" />
              const lista = porFecha[f] || []
              const esHoy = f === hoy
              const elegido = f === dia
              return (
                <button key={f} onClick={() => setDia(f)} aria-label={fechaLarga(f)}
                  className={`flex min-h-[92px] flex-col gap-1 bg-white p-1.5 text-left align-top transition-colors hover:bg-gray-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/80 ${elegido ? 'ring-2 ring-inset ring-gray-900 dark:ring-zinc-100' : ''}`}>
                  <span className={`self-start rounded-full px-1.5 text-xs font-bold tabular-nums ${esHoy ? 'bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : f < hoy ? 'text-gray-400 dark:text-zinc-600' : 'text-gray-700 dark:text-zinc-300'}`}>{Number(f.slice(8))}</span>
                  {lista.slice(0, 3).map(it => (
                    <span key={it.clave} title={`${it.lead.nombre}: ${it.texto}`}
                      className={`block truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight ${it.tipo === 'tarea' ? it.tono.tarea : it.tipo === 'recordatorio' ? `border border-dashed ${it.tono.borde}` : EVENTO}`}>
                      {it.tipo === 'evento' ? `${it.texto}: ` : ''}{it.lead.nombre}
                    </span>
                  ))}
                  {lista.length > 3 && <span className="text-[10px] font-semibold text-gray-500 dark:text-zinc-500">+{lista.length - 3} más</span>}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-zinc-500">
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-4 rounded bg-sky-100 dark:bg-sky-950/60" />Tarea del embudo</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-4 rounded border border-dashed border-gray-400" />Recordatorio</span>
            <span>Texto gris: evento del viaje</span>
          </div>
        </div>

        <aside className="min-w-0 space-y-3 rounded-xl border border-gray-200 p-4 dark:border-white/10">
          <p className="text-sm font-bold text-gray-900 dark:text-zinc-100">{fechaLarga(dia)}</p>

          {delDia.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-zinc-600">Nada para este día.</p>
          ) : (
            <ul className="space-y-2">
              {delDia.map(it => (
                <li key={it.clave} className="flex items-start gap-2">
                  <i className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${it.tono.punto}`} title={it.tono.nombre} />
                  <div className="min-w-0 flex-1">
                    <button onClick={() => onAbrirLead(it.lead)} className="block max-w-full truncate text-sm font-semibold text-gray-900 hover:underline dark:text-zinc-100">{it.lead.nombre}</button>
                    <p className="text-xs text-gray-600 dark:text-zinc-400">
                      <span className="font-semibold">{it.tipo === 'tarea' ? 'Tarea' : it.tipo === 'recordatorio' ? 'Recordatorio' : 'Viaje'}: </span>{it.texto}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-zinc-600">{it.tono.nombre}</p>
                  </div>
                  {it.tipo !== 'evento' && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => onCompletar(it.rec.id)} title="Marcar como hecha" aria-label="Marcar como hecha"
                        className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"><Ic n="check" className="h-3.5 w-3.5" /></button>
                      {it.tipo === 'recordatorio' && (
                        <button onClick={() => onEliminar(it.rec.id)} title="Eliminar el recordatorio" aria-label="Eliminar el recordatorio"
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">✕</button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={crear} className="space-y-2 border-t border-gray-100 pt-3 dark:border-white/10">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Nuevo recordatorio para este día</p>
            <div className="relative">
              <input value={busqueda} role="combobox" aria-expanded={abierto} aria-label="Buscar cliente" autoComplete="off"
                placeholder="Buscar cliente por nombre o teléfono..."
                onChange={e => { setBusqueda(e.target.value); setNuevo(p => ({ ...p, leadId: '' })); setActivo(0); setAbierto(true) }}
                onFocus={() => setAbierto(true)} onBlur={() => setTimeout(() => setAbierto(false), 120)} onKeyDown={teclaBuscador}
                className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500" />
              {abierto && !nuevo.leadId && (
                <ul role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  {coincidencias.length === 0 && <li className="px-3 py-2 text-xs text-gray-400 dark:text-zinc-500">Ningún cliente coincide.</li>}
                  {coincidencias.map((l, i) => (
                    <li key={l.id} role="option" aria-selected={i === activo} onMouseDown={e => { e.preventDefault(); elegirCliente(l) }} onMouseEnter={() => setActivo(i)}
                      className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-sm text-gray-900 dark:text-zinc-100 ${i === activo ? 'bg-gray-100 dark:bg-zinc-800' : ''}`}>
                      <span className="truncate">{l.nombre}</span>
                      <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-gray-500 dark:text-zinc-400">
                        <span className={`h-2 w-2 rounded-full ${tonoDeLead(l).punto}`} />{tonoDeLead(l).nombre}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <input value={nuevo.nota} onChange={e => setNuevo(p => ({ ...p, nota: e.target.value }))} placeholder="Ej: Llamar para confirmar el traslado" aria-label="Nota del recordatorio"
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500" />
            <button type="submit" disabled={!nuevo.leadId || !nuevo.nota.trim() || guardando}
              className="w-full rounded-lg bg-brand-600 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-40 dark:bg-brand-500 dark:hover:bg-brand-600">
              {guardando ? 'Guardando...' : 'Agregar recordatorio'}
            </button>
            <p className="text-[11px] text-gray-400 dark:text-zinc-600">Queda a cargo de la anfitriona asignada al cliente. Las tareas nuevas se suman al embudo, no acá.</p>
          </form>
        </aside>
      </div>
    </div>
  )
}
