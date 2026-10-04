import { useState, useEffect, useMemo } from 'react'
import { trasladosApi, choferesApi } from '../../lib/supabase.js'
import Ic from '../../components/admin/dashboard/Ic.jsx'
import { avisar, confirmar } from '../../components/ui/Avisos.jsx'
import { hoyISO } from '../../lib/embudo.js'

const ESTADOS = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400' },
  realizado: { label: 'Realizado', color: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' },
}

const TIPOS_EQUIPAJE = ['Valija grande', 'Valija mediana', 'Valija de mano', 'Mochila', 'Bolso de mano', 'Caja de surf', 'Bicicleta', 'Cochecito']

const CAMPO = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500'
const ETIQUETA = 'mb-1 block text-xs font-medium text-gray-500 dark:text-zinc-400'

function formularioNuevo() {
  return {
    fecha: hoyISO(), hora: '', cliente: '', vuelo: '', origen: '', destino: '',
    personas: '', equipaje_cantidad: '', equipaje_tipo: '', chofer_id: '', estado: 'pendiente', observaciones: '',
  }
}

function aFormulario(t) {
  return {
    fecha: t.fecha || '',
    hora: t.hora?.slice(0, 5) || '',
    cliente: t.cliente || '',
    vuelo: t.vuelo || '',
    origen: t.origen || '',
    destino: t.destino || '',
    personas: String(t.personas ?? ''),
    equipaje_cantidad: String(t.equipaje_cantidad ?? ''),
    equipaje_tipo: t.equipaje_tipo || '',
    chofer_id: t.chofer_id || '',
    estado: t.estado || 'pendiente',
    observaciones: t.observaciones || '',
  }
}

function aPayload(f) {
  return {
    fecha: f.fecha,
    hora: f.hora,
    cliente: f.cliente.trim() || null,
    vuelo: f.vuelo.trim() || null,
    origen: f.origen.trim() || null,
    destino: f.destino.trim(),
    personas: parseInt(f.personas, 10),
    equipaje_cantidad: parseInt(f.equipaje_cantidad, 10) || 0,
    equipaje_tipo: f.equipaje_tipo.trim() || null,
    chofer_id: f.chofer_id || null,
    estado: f.estado,
    observaciones: f.observaciones.trim() || null,
  }
}

function faltantes(f) {
  const falta = []
  if (!f.fecha) falta.push('fecha')
  if (!f.hora) falta.push('hora')
  if (!f.destino.trim()) falta.push('destino')
  if (!(parseInt(f.personas, 10) > 0)) falta.push('cantidad de personas')
  return falta
}

function fechaCorta(fecha) {
  return fecha ? new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }) : '–'
}

function FormularioTraslado({ form, onCampo, choferes }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label className={ETIQUETA}>Fecha</label>
        <input type="date" value={form.fecha} onChange={e => onCampo('fecha', e.target.value)} className={CAMPO} />
      </div>
      <div>
        <label className={ETIQUETA}>Hora de recogida</label>
        <input type="time" value={form.hora} onChange={e => onCampo('hora', e.target.value)} className={CAMPO} />
      </div>
      <div>
        <label className={ETIQUETA}>Cliente</label>
        <input value={form.cliente} onChange={e => onCampo('cliente', e.target.value)} placeholder="Nombre del pasajero" className={CAMPO} />
      </div>
      <div>
        <label className={ETIQUETA}>Vuelo</label>
        <input value={form.vuelo} onChange={e => onCampo('vuelo', e.target.value)} placeholder="Ej: LA 3456, llega 14:20" className={CAMPO} />
      </div>
      <div>
        <label className={ETIQUETA}>Lugar de recogida</label>
        <input value={form.origen} onChange={e => onCampo('origen', e.target.value)} placeholder="Ej: Aeropuerto de Salvador" className={CAMPO} />
      </div>
      <div>
        <label className={ETIQUETA}>Destino</label>
        <input value={form.destino} onChange={e => onCampo('destino', e.target.value)} placeholder="Ej: Hotel en Porto da Barra" className={CAMPO} />
      </div>
      <div>
        <label className={ETIQUETA}>Cantidad de personas</label>
        <input type="number" min="1" value={form.personas} onChange={e => onCampo('personas', e.target.value)} className={CAMPO} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={ETIQUETA}>Bultos de equipaje</label>
          <input type="number" min="0" value={form.equipaje_cantidad} onChange={e => onCampo('equipaje_cantidad', e.target.value)} className={CAMPO} />
        </div>
        <div>
          <label className={ETIQUETA}>Tipo de equipaje</label>
          <input list="tipos-equipaje" value={form.equipaje_tipo} onChange={e => onCampo('equipaje_tipo', e.target.value)} placeholder="Ej: Valija grande" className={CAMPO} />
          <datalist id="tipos-equipaje">
            {TIPOS_EQUIPAJE.map(t => <option key={t} value={t} />)}
          </datalist>
        </div>
      </div>
      <div>
        <label className={ETIQUETA}>Chofer</label>
        <select value={form.chofer_id} onChange={e => onCampo('chofer_id', e.target.value)} className={CAMPO}>
          <option value="">Sin asignar</option>
          {choferes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <div>
        <label className={ETIQUETA}>Estado</label>
        <select value={form.estado} onChange={e => onCampo('estado', e.target.value)} className={CAMPO}>
          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className={ETIQUETA}>Observaciones</label>
        <textarea rows={2} value={form.observaciones} onChange={e => onCampo('observaciones', e.target.value)} placeholder="Silla de bebé, parada en el camino, etc." className={CAMPO} />
      </div>
    </div>
  )
}

function Resumen({ titulo, valor }) {
  return (
    <div className="dash-card">
      <p className="text-xs text-gray-400 dark:text-zinc-500">{titulo}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-zinc-100 tabular-nums">{valor}</p>
    </div>
  )
}

export default function Traslados() {
  const [filas, setFilas] = useState([])
  const [choferes, setChoferes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [desde, setDesde] = useState(hoyISO())
  const [hasta, setHasta] = useState('')
  const [modal, setModal] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    async function cargar() {
      const [res, resChoferes] = await Promise.all([trasladosApi.getAll(), choferesApi.getAll()])
      if (res?.error) setErrorCarga(res.error.message)
      else setFilas(res?.data || [])
      setChoferes(resChoferes?.data || [])
      setCargando(false)
    }
    cargar()
  }, [])

  const filtradas = useMemo(() => filas
    .filter(t => !filtroEstado || t.estado === filtroEstado)
    .filter(t => !desde || t.fecha >= desde)
    .filter(t => !hasta || t.fecha <= hasta)
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)),
  [filas, filtroEstado, desde, hasta])

  const hayFiltrosFecha = desde || hasta
  const pasajeros = filtradas.reduce((s, t) => s + (t.personas || 0), 0)
  const bultos = filtradas.reduce((s, t) => s + (t.equipaje_cantidad || 0), 0)

  function setCampo(campo, valor) {
    setModal(m => ({ ...m, form: { ...m.form, [campo]: valor } }))
  }

  async function guardar() {
    const falta = faltantes(modal.form)
    if (falta.length) return avisar('Para guardar el traslado faltan: ' + falta.join(', ') + '.')
    setGuardando(true)
    const datos = aPayload(modal.form)
    const res = modal.id
      ? await trasladosApi.update(modal.id, datos)
      : await trasladosApi.create(datos)
    setGuardando(false)
    if (res?.error || !res?.data) return avisar('No se pudo guardar el traslado: ' + (res?.error?.message || 'error desconocido'))
    const fila = res.data
    setFilas(prev => modal.id ? prev.map(t => t.id === fila.id ? fila : t) : [...prev, fila])
    setModal(null)
  }

  async function cambiarEstado(t, estado) {
    setFilas(prev => prev.map(x => x.id === t.id ? { ...x, estado } : x))
    const { error } = await trasladosApi.update(t.id, { estado }) || {}
    if (error) {
      setFilas(prev => prev.map(x => x.id === t.id ? { ...x, estado: t.estado } : x))
      avisar('No se pudo cambiar el estado: ' + error.message)
    }
  }

  async function eliminar(t) {
    const ok = await confirmar(`¿Eliminar el traslado de ${t.cliente || 'sin nombre'} a ${t.destino}? Esta acción no se puede deshacer.`)
    if (!ok) return
    const { error } = await trasladosApi.delete(t.id) || {}
    if (error) return avisar('No se pudo eliminar el traslado: ' + error.message)
    setFilas(prev => prev.filter(x => x.id !== t.id))
  }

  if (cargando) return <div className="p-8 text-gray-400 dark:text-zinc-500">Cargando traslados...</div>

  if (errorCarga) {
    return (
      <div className="dash-card max-w-xl">
        <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">No se pudo cargar la planilla de traslados.</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
          Si es la primera vez, falta correr en el SQL Editor de Supabase la migración
          <span className="font-mono"> 20261005120000_traslados.sql</span>.
        </p>
        <p className="mt-2 text-xs text-gray-400 dark:text-zinc-500">{errorCarga}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-400 dark:text-zinc-500">{filas.length} traslados cargados</p>
        <button
          onClick={() => setModal({ id: null, form: formularioNuevo() })}
          className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          <Ic n="plus" className="h-4 w-4" /> Nuevo traslado
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Resumen titulo="Traslados" valor={filtradas.length} />
        <Resumen titulo="Pasajeros" valor={pasajeros} />
        <Resumen titulo="Bultos de equipaje" valor={bultos} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setFiltroEstado('')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${!filtroEstado ? 'bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'border border-gray-200 bg-white text-gray-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'}`}>
          Todos
        </button>
        {Object.entries(ESTADOS).map(([k, v]) => (
          <button key={k} onClick={() => setFiltroEstado(k)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${filtroEstado === k ? 'bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'border border-gray-200 bg-white text-gray-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'}`}>
            {v.label}
          </button>
        ))}

        <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-zinc-700" />

        <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
          className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400" />
        <span className="text-sm text-gray-300 dark:text-zinc-600">–</span>
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
          className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400" />

        {hayFiltrosFecha && (
          <button onClick={() => { setDesde(''); setHasta('') }}
            className="text-xs text-gray-400 underline hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300">
            Ver todas las fechas
          </button>
        )}
      </div>

      {filtradas.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400 dark:text-zinc-500">
          No hay traslados{(filtroEstado || hayFiltrosFecha) ? ' con estos filtros' : ' cargados'}.
        </div>
      ) : (
        <div className="dash-card overflow-x-auto !p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 dark:bg-zinc-800/60 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 text-left">Fecha y hora</th>
                <th className="px-4 py-3 text-left">Cliente y vuelo</th>
                <th className="px-4 py-3 text-left">Recogida y destino</th>
                <th className="px-4 py-3 text-left">Personas</th>
                <th className="px-4 py-3 text-left">Equipaje</th>
                <th className="px-4 py-3 text-left">Chofer</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {filtradas.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                  <td className="whitespace-nowrap px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-zinc-100">{fechaCorta(t.fecha)}</p>
                    <p className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-400">
                      <Ic n="clock" className="h-3.5 w-3.5" />{t.hora?.slice(0, 5)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900 dark:text-zinc-100">{t.cliente || '–'}</p>
                    {t.vuelo && <p className="text-xs text-gray-500 dark:text-zinc-400">{t.vuelo}</p>}
                  </td>
                  <td className="max-w-[280px] px-4 py-3">
                    {t.origen && <p className="flex items-center gap-1 truncate text-xs text-gray-400 dark:text-zinc-500"><Ic n="pin" className="h-3.5 w-3.5 shrink-0" />{t.origen}</p>}
                    <p className="font-medium text-gray-900 dark:text-zinc-100">{t.destino}</p>
                    {t.observaciones && <p className="truncate text-xs text-gray-500 dark:text-zinc-400" title={t.observaciones}>{t.observaciones}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-zinc-300">
                    <span className="flex items-center gap-1"><Ic n="user" className="h-3.5 w-3.5" />{t.personas}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {t.equipaje_cantidad > 0
                      ? <span className="text-gray-900 dark:text-zinc-100">{t.equipaje_cantidad} <span className="text-xs text-gray-500 dark:text-zinc-400">{t.equipaje_tipo || 'bultos'}</span></span>
                      : <span className="text-xs text-gray-400 dark:text-zinc-500">Sin equipaje</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-zinc-300">
                    {t.choferes?.nombre || <span className="text-xs text-gray-400 dark:text-zinc-500">Sin asignar</span>}
                  </td>
                  <td className="px-4 py-3">
                    <select value={t.estado} onChange={e => cambiarEstado(t, e.target.value)}
                      className={`cursor-pointer rounded-full border-0 px-2 py-1 text-xs font-medium outline-none ${ESTADOS[t.estado]?.color}`}>
                      {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setModal({ id: t.id, form: aFormulario(t) })}
                        title="Editar traslado"
                        className="text-gray-400 transition-colors hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200">
                        <Ic n="pencil" className="h-4 w-4" />
                      </button>
                      <button onClick={() => eliminar(t)}
                        title="Eliminar traslado"
                        className="text-gray-300 transition-colors hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400">
                        <Ic n="trash" className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true"
            className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">
                {modal.id ? 'Editar traslado' : 'Nuevo traslado'}
              </h2>
              <button onClick={() => setModal(null)} aria-label="Cerrar"
                className="text-gray-400 transition-colors hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-5">
              <FormularioTraslado form={modal.form} onCampo={setCampo} choferes={choferes} />
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4 dark:border-zinc-800">
              <button onClick={() => setModal(null)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
