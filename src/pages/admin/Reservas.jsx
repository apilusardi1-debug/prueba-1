import { useState, useEffect, useMemo } from 'react'
import { reservasApi, excursionesApi, choferesApi, comisionesAgenciaApi } from '../../lib/supabase.js'
import ModalReservaPlanilla from '../../components/admin/ModalReservaPlanilla.jsx'
import { confirmar } from '../../components/ui/Avisos.jsx'
import { IcGrande } from '../../components/admin/dashboard/Ic.jsx'
import { nombrePaseo, saldoDe, formatMonto, fechaCorta, claveTexto, distintos } from '../../lib/reservasPlanilla.js'

// Reservas de paseos y traslados, con las mismas columnas y filtros que la planilla de
// Excel con la que trabajaba el equipo de paseos ("NUEVA PLANILLA"), para que carguen
// acá en vez de en el Excel. La comisión de la agencia ("COMISION DREAM") se carga por
// día, no por reserva: va aparte, en "Comisión diaria".

const ESTADOS = {
  pendiente:   { label: 'Pendiente',   color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400' },
  confirmada:  { label: 'Confirmada',  color: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' },
  completada:  { label: 'Completada',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' },
  cancelada:   { label: 'Cancelada',   color: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' },
}

const FILTRO = 'border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:text-zinc-100 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400'
const FILTROS_VACIOS = { texto: '', paseo: '', vendedor: '', chofer: '', paseoDesde: '', paseoHasta: '', ventaDesde: '', ventaHasta: '', sinTraslado: false }

const hoy = () => new Date().toISOString().slice(0, 10)

// Suma por moneda: { BRL: 1200, USD: 50 } → "R$ 1.200 · US$ 50"
function sumaPorMoneda(lista, valor) {
  const t = {}
  for (const r of lista) {
    const v = valor(r)
    if (v == null || Number.isNaN(Number(v))) continue
    const m = r.moneda || 'BRL'
    t[m] = (t[m] || 0) + Number(v)
  }
  const partes = Object.entries(t).filter(([, v]) => v).map(([m, v]) => formatMonto(v, m))
  return partes.length ? partes.join(' · ') : formatMonto(0)
}

export default function Reservas() {
  const [reservas, setReservas] = useState([])
  const [excursiones, setExcursiones] = useState([])
  const [choferes, setChoferes] = useState([])
  const [comisiones, setComisiones] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [f, setF] = useState(FILTROS_VACIOS)
  const [editando, setEditando] = useState(null) // null | 'nueva' | reserva
  const [verComisiones, setVerComisiones] = useState(false)
  const [seleccionadas, setSeleccionadas] = useState(new Set())
  const [editandoSaldo, setEditandoSaldo] = useState(null) // { id, valor }

  useEffect(() => {
    async function cargar() {
      try {
        const [rRes, eRes, cRes, comRes] = await Promise.all([
          reservasApi.getAll(), excursionesApi.getAll(), choferesApi.getAll(), comisionesAgenciaApi.getAll(),
        ])
        if (rRes?.error) throw rRes.error
        setExcursiones(eRes?.data || [])
        setChoferes(cRes?.data || [])
        setComisiones(comRes?.data || [])
        const r = rRes?.data || []
        // Lo confirmado con fecha ya pasada se da por hecho
        const vencidas = r.filter(x => x.estado === 'confirmada' && x.fecha < hoy())
        if (vencidas.length) {
          await Promise.all(vencidas.map(x => reservasApi.updateEstado(x.id, 'completada')))
          const ids = new Set(vencidas.map(x => x.id))
          setReservas(r.map(x => ids.has(x.id) ? { ...x, estado: 'completada' } : x))
        } else {
          setReservas(r)
        }
      } catch (e) {
        setErrorCarga(e?.message || 'No se pudieron cargar las reservas.')
      }
      setLoading(false)
    }
    cargar()
  }, [])

  const setFiltro = (k, v) => setF(p => ({ ...p, [k]: v }))

  // Opciones de los filtros y sugerencias del formulario: lo que ya está cargado
  const opciones = useMemo(() => ({
    paseos: distintos([...excursiones.filter(e => e.categoria === 'excursiones').map(e => e.nombre), ...reservas.map(nombrePaseo).filter(p => p !== '—')]),
    choferes: distintos([...choferes.map(c => c.nombre), ...reservas.map(r => r.chofer_texto)]),
    vendedores: distintos(reservas.map(r => r.vendedor_texto)),
  }), [reservas, excursiones, choferes])

  // Por defecto ("Todas") no se muestran las completadas: la vista diaria es lo que viene
  const filtradas = useMemo(() => {
    const texto = claveTexto(f.texto)
    const digitos = f.texto.replace(/\D/g, '')
    return reservas.filter(r => {
      if (filtroEstado ? r.estado !== filtroEstado : r.estado === 'completada') return false
      if (texto && !claveTexto(r.cliente_nombre).includes(texto) && !(digitos.length >= 3 && String(r.cliente_whatsapp || '').includes(digitos))) return false
      if (f.paseo && claveTexto(nombrePaseo(r)) !== claveTexto(f.paseo)) return false
      if (f.vendedor && claveTexto(r.vendedor_texto) !== claveTexto(f.vendedor)) return false
      if (f.chofer && claveTexto(r.chofer_texto) !== claveTexto(f.chofer)) return false
      if (f.paseoDesde && (!r.fecha || r.fecha < f.paseoDesde)) return false
      if (f.paseoHasta && (!r.fecha || r.fecha > f.paseoHasta)) return false
      if (f.ventaDesde && (!r.fecha_venta || r.fecha_venta < f.ventaDesde)) return false
      if (f.ventaHasta && (!r.fecha_venta || r.fecha_venta > f.ventaHasta)) return false
      if (f.sinTraslado && !r.sin_traslado) return false
      return true
    }).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (a.cliente_nombre || '').localeCompare(b.cliente_nombre || ''))
  }, [reservas, filtroEstado, f])

  const hayFiltros = Object.entries(f).some(([k, v]) => v !== FILTROS_VACIOS[k])
  const activas = filtradas.filter(r => r.estado !== 'cancelada')

  // Comisión de la agencia de los días del filtro de fecha del paseo (o de los días que aparecen)
  const comisionDelPeriodo = useMemo(() => {
    const dias = new Set(activas.map(r => r.fecha))
    const enRango = comisiones.filter(c => (f.paseoDesde || f.paseoHasta)
      ? (!f.paseoDesde || c.fecha >= f.paseoDesde) && (!f.paseoHasta || c.fecha <= f.paseoHasta)
      : dias.has(c.fecha))
    return sumaPorMoneda(enRango, c => c.monto)
  }, [comisiones, activas, f.paseoDesde, f.paseoHasta])

  async function guardarReserva(datos) {
    if (editando === 'nueva') {
      const { data, error } = await reservasApi.create(datos)
      if (error) throw error
      if (data) setReservas(prev => [...prev, data])
    } else {
      const { data, error } = await reservasApi.update(editando.id, datos)
      if (error) throw error
      if (data) setReservas(prev => prev.map(r => r.id === editando.id ? data : r))
    }
    setEditando(null)
  }

  async function cambiarEstado(id, estado) {
    setReservas(prev => prev.map(r => r.id === id ? { ...r, estado } : r))
    await reservasApi.updateEstado(id, estado)
  }

  async function eliminar(r) {
    if (!await confirmar(`¿Eliminar la reserva de ${r.cliente_nombre || 'este cliente'} (${nombrePaseo(r)}, ${fechaCorta(r.fecha)})? No se puede deshacer.`)) return
    await reservasApi.delete(r.id)
    setReservas(prev => prev.filter(x => x.id !== r.id))
  }

  // Los clientes pagan el saldo al terminar el paseo: se marca desde la tabla, sin abrir la reserva
  async function guardarSaldo(ids, saldo) {
    setReservas(prev => prev.map(r => ids.includes(r.id) ? { ...r, saldo_cliente: saldo } : r))
    const res = await Promise.all(ids.map(id => reservasApi.update(id, { saldo_cliente: saldo })))
    const fallo = res.find(x => x?.error)
    if (fallo) setErrorCarga('No se pudo guardar el saldo: ' + fallo.error.message)
  }

  function confirmarSaldoEditado() {
    if (!editandoSaldo) return
    const valor = Number(String(editandoSaldo.valor).replace(',', '.'))
    if (String(editandoSaldo.valor).trim() !== '' && !Number.isNaN(valor) && valor >= 0) guardarSaldo([editandoSaldo.id], valor)
    setEditandoSaldo(null)
  }

  async function cobrarSeleccionadas() {
    const ids = [...seleccionadas].filter(id => saldoDe(reservas.find(r => r.id === id)) > 0)
    setSeleccionadas(new Set())
    if (ids.length) await guardarSaldo(ids, 0)
  }

  function toggleSeleccion(id) {
    setSeleccionadas(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  async function cambiarEstadoSeleccionadas(estado) {
    const ids = [...seleccionadas]
    setReservas(prev => prev.map(r => seleccionadas.has(r.id) ? { ...r, estado } : r))
    setSeleccionadas(new Set())
    await Promise.all(ids.map(id => reservasApi.updateEstado(id, estado)))
  }

  async function eliminarSeleccionadas() {
    const n = seleccionadas.size
    if (!await confirmar(`¿Eliminar ${n} reserva${n !== 1 ? 's' : ''}? No se puede deshacer.`)) return
    const ids = [...seleccionadas]
    await Promise.all(ids.map(id => reservasApi.delete(id)))
    setReservas(prev => prev.filter(r => !seleccionadas.has(r.id)))
    setSeleccionadas(new Set())
  }

  if (loading) return <div className="p-8 text-gray-400 dark:text-zinc-500">Cargando reservas...</div>

  const th = 'px-3 py-2.5 text-left font-semibold whitespace-nowrap'
  const td = 'px-3 py-2 align-top'

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Reservas</h1>
          <p className="text-gray-400 dark:text-zinc-500 text-sm">Paseos y traslados · {reservas.length} en total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setVerComisiones(true)}
            className="text-sm font-semibold text-gray-700 dark:text-zinc-200 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl px-4 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
            Comisión diaria
          </button>
          <button onClick={() => setEditando('nueva')}
            className="flex items-center gap-2 text-sm font-semibold text-white dark:text-zinc-900 bg-brand-600 dark:bg-zinc-100 rounded-xl px-4 py-2 hover:bg-brand-700 dark:hover:bg-zinc-200 transition-colors shadow-sm">
            <span className="text-base leading-none">+</span> Nueva reserva
          </button>
        </div>
      </div>

      {errorCarga && <p className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400 rounded-xl px-4 py-3">No se pudieron cargar las reservas: {errorCarga}</p>}

      {/* Resumen de lo filtrado (sin canceladas) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        {[
          { label: 'Reservas', value: activas.length },
          { label: 'Pasajeros', value: activas.reduce((a, r) => a + (r.personas || 0), 0) },
          { label: 'Total vendido', value: sumaPorMoneda(activas, r => r.total) },
          { label: 'Señas (com. vendedores)', value: sumaPorMoneda(activas, r => r.sena) },
          { label: 'Saldo a cobrar', value: sumaPorMoneda(activas, saldoDe) },
          { label: 'Comisión agencia', value: comisionDelPeriodo },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white dark:bg-zinc-900 rounded-2xl p-3.5 border border-gray-100 dark:border-zinc-800 shadow-sm">
            <p className="text-[11px] text-gray-400 dark:text-zinc-500 mb-1">{label}</p>
            <p className="text-base font-bold text-gray-900 dark:text-zinc-100 leading-tight">{value}</p>
          </div>
        ))}
      </div>

      {/* Estado */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {[['', 'Todas'], ...Object.entries(ESTADOS).map(([k, v]) => [k, v.label])].map(([k, label]) => (
          <button key={k || 'todas'} onClick={() => setFiltroEstado(k)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filtroEstado === k ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Filtros como los del Excel */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-3 mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[11px] text-gray-500 dark:text-zinc-400 font-medium">
          Cliente
          <input value={f.texto} onChange={e => setFiltro('texto', e.target.value)} placeholder="Nombre o teléfono" className={FILTRO + ' w-44'} />
        </label>
        {[['paseo', 'Paseo', opciones.paseos], ['vendedor', 'Vendedor', opciones.vendedores], ['chofer', 'Chofer', opciones.choferes]].map(([k, label, lista]) => (
          <label key={k} className="flex flex-col gap-1 text-[11px] text-gray-500 dark:text-zinc-400 font-medium">
            {label}
            <select value={f[k]} onChange={e => setFiltro(k, e.target.value)} className={FILTRO + ' max-w-[220px]'}>
              <option value="">Todos</option>
              {lista.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        ))}
        <div className="flex flex-col gap-1 text-[11px] text-gray-500 dark:text-zinc-400 font-medium">
          Fecha del paseo
          <div className="flex items-center gap-1.5">
            <input type="date" value={f.paseoDesde} onChange={e => setFiltro('paseoDesde', e.target.value)} className={FILTRO} />
            <span className="text-gray-300">–</span>
            <input type="date" value={f.paseoHasta} onChange={e => setFiltro('paseoHasta', e.target.value)} className={FILTRO} />
          </div>
        </div>
        <div className="flex flex-col gap-1 text-[11px] text-gray-500 dark:text-zinc-400 font-medium">
          Fecha de venta
          <div className="flex items-center gap-1.5">
            <input type="date" value={f.ventaDesde} onChange={e => setFiltro('ventaDesde', e.target.value)} className={FILTRO} />
            <span className="text-gray-300">–</span>
            <input type="date" value={f.ventaHasta} onChange={e => setFiltro('ventaHasta', e.target.value)} className={FILTRO} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-300 pb-1.5">
          <input type="checkbox" checked={f.sinTraslado} onChange={e => setFiltro('sinTraslado', e.target.checked)}
            className="rounded border-gray-300 dark:border-zinc-600 text-brand-600 focus:ring-brand-400" />
          Sin traslado
        </label>
        {hayFiltros && (
          <button onClick={() => setF(FILTROS_VACIOS)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 underline pb-2">
            Limpiar filtros
          </button>
        )}
      </div>

      {seleccionadas.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 bg-brand-50 dark:bg-brand-950/40 border border-brand-100 dark:border-brand-900 rounded-xl px-4 py-2.5">
          <span className="text-sm font-medium text-brand-700 dark:text-brand-400">{seleccionadas.size} seleccionada{seleccionadas.size !== 1 ? 's' : ''}</span>
          <div className="flex-1" />
          <button onClick={cobrarSeleccionadas}
            className="text-xs font-semibold px-3 py-1 rounded-full bg-green-600 text-white hover:bg-green-700">
            Marcar saldo cobrado
          </button>
          <span className="text-xs text-gray-500 dark:text-zinc-400">Cambiar estado:</span>
          {Object.entries(ESTADOS).map(([k, v]) => (
            <button key={k} onClick={() => cambiarEstadoSeleccionadas(k)} className={`text-xs font-medium px-2.5 py-1 rounded-full hover:opacity-80 ${v.color}`}>{v.label}</button>
          ))}
          <button onClick={eliminarSeleccionadas} className="text-xs font-semibold text-red-500 hover:text-red-700 px-2 py-1">Eliminar</button>
          <button onClick={() => setSeleccionadas(new Set())} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">Cancelar</button>
        </div>
      )}

      {filtradas.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-zinc-500">
          <IcGrande n="file" />
          <p>No hay reservas{(filtroEstado || hayFiltros) ? ' con estos filtros' : ''}.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-auto max-h-[70vh]">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 uppercase tracking-wider text-[10px] sticky top-0 z-10">
              <tr>
                <th className={th}>
                  <input type="checkbox" checked={seleccionadas.size === filtradas.length}
                    onChange={() => setSeleccionadas(prev => prev.size === filtradas.length ? new Set() : new Set(filtradas.map(r => r.id)))}
                    className="rounded border-gray-300 dark:border-zinc-600 text-brand-600 focus:ring-brand-500 cursor-pointer" />
                </th>
                <th className={th}>Venta</th>
                <th className={th}>Cliente</th>
                <th className={th}>Cant.</th>
                <th className={th}>Paseo</th>
                <th className={th}>Fecha paseo</th>
                <th className={th}>Valor venta</th>
                <th className={th}>Saldo cliente</th>
                <th className={th}>Chofer del día</th>
                <th className={th}>Com. chofer</th>
                <th className={th}>Hospedaje</th>
                <th className={th}>Obs.</th>
                <th className={th}>Seña / com. vend.</th>
                <th className={th}>Contacto</th>
                <th className={th}>Vendedor</th>
                <th className={th}>Estado</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800 text-gray-700 dark:text-zinc-300">
              {filtradas.map(r => {
                const est = ESTADOS[r.estado] || ESTADOS.pendiente
                return (
                  <tr key={r.id} onDoubleClick={() => setEditando(r)}
                    className={`hover:bg-gray-50 dark:hover:bg-zinc-800/50 ${seleccionadas.has(r.id) ? 'bg-brand-50 dark:bg-brand-950/20' : ''} ${r.estado === 'cancelada' ? 'opacity-50' : ''}`}>
                    <td className={td}>
                      <input type="checkbox" checked={seleccionadas.has(r.id)} onChange={() => toggleSeleccion(r.id)}
                        className="rounded border-gray-300 dark:border-zinc-600 text-brand-600 focus:ring-brand-500 cursor-pointer" />
                    </td>
                    <td className={td + ' whitespace-nowrap text-gray-400'}>{fechaCorta(r.fecha_venta)}</td>
                    <td className={td + ' font-medium text-gray-900 dark:text-zinc-100 min-w-[130px]'}>{r.cliente_nombre || '—'}</td>
                    <td className={td + ' text-center'}>{r.personas}</td>
                    <td className={td + ' min-w-[150px]'}>
                      {nombrePaseo(r)}
                      {r.sin_traslado && <span className="ml-1.5 inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 whitespace-nowrap">Sin traslado</span>}
                    </td>
                    <td className={td + ' whitespace-nowrap font-medium'}>{fechaCorta(r.fecha)}</td>
                    <td className={td + ' whitespace-nowrap'}>{formatMonto(r.total, r.moneda)}</td>
                    <td className={td + ' whitespace-nowrap'}>
                      {editandoSaldo?.id === r.id ? (
                        <input autoFocus inputMode="decimal" value={editandoSaldo.valor}
                          onChange={e => setEditandoSaldo({ id: r.id, valor: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') confirmarSaldoEditado(); if (e.key === 'Escape') setEditandoSaldo(null) }}
                          onBlur={confirmarSaldoEditado}
                          className="w-20 border border-brand-300 rounded-md px-1.5 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400 dark:bg-zinc-800 dark:text-zinc-100" />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button title="Cambiar el saldo" onClick={() => setEditandoSaldo({ id: r.id, valor: String(saldoDe(r) ?? '') })}
                            className={`font-medium hover:underline decoration-dotted ${saldoDe(r) > 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            {formatMonto(saldoDe(r), r.moneda)}
                          </button>
                          {saldoDe(r) > 0 && (
                            <button onClick={() => guardarSaldo([r.id], 0)} title="El cliente pagó el saldo"
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950/40">
                              Cobrado
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className={td}>{r.chofer_texto || r.choferes?.nombre || '—'}</td>
                    <td className={td + ' whitespace-nowrap'}>{r.comision_chofer != null ? formatMonto(r.comision_chofer) : '—'}</td>
                    <td className={td + ' min-w-[120px]'}>{r.hospedaje || '—'}</td>
                    <td className={td + ' min-w-[160px] max-w-[260px] text-gray-500 dark:text-zinc-400'}><p className="line-clamp-2" title={r.notas || ''}>{r.notas || '—'}</p></td>
                    <td className={td + ' whitespace-nowrap'}>{r.sena != null ? formatMonto(r.sena, r.moneda) : '—'}</td>
                    <td className={td + ' whitespace-nowrap'}>
                      {r.cliente_whatsapp
                        ? <a href={`https://wa.me/${r.cliente_whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-green-600 dark:text-green-400 hover:underline">{r.cliente_whatsapp}</a>
                        : '—'}
                    </td>
                    <td className={td}>{r.vendedor_texto || '—'}</td>
                    <td className={td}>
                      <select value={r.estado} onChange={e => cambiarEstado(r.id, e.target.value)}
                        className={`text-[11px] font-medium px-2 py-1 rounded-full border-0 outline-none cursor-pointer ${est.color}`}>
                        {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                    <td className={td + ' whitespace-nowrap'}>
                      <button onClick={() => setEditando(r)} className="text-brand-600 dark:text-brand-400 hover:underline font-medium mr-3">Editar</button>
                      <button onClick={() => eliminar(r)} title="Eliminar" className="text-gray-300 dark:text-zinc-600 hover:text-red-500">✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <ModalReservaPlanilla
          reserva={editando === 'nueva' ? null : editando}
          excursiones={excursiones}
          sugerencias={opciones}
          onGuardar={guardarReserva}
          onCerrar={() => setEditando(null)}
        />
      )}

      {verComisiones && (
        <ModalComisiones comisiones={comisiones} setComisiones={setComisiones} onCerrar={() => setVerComisiones(false)} />
      )}
    </div>
  )
}

// Comisión de la agencia por día: una fila por fecha (guardar una fecha que ya existe la reemplaza)
function ModalComisiones({ comisiones, setComisiones, onCerrar }) {
  const [form, setForm] = useState({ fecha: hoy(), monto: '', moneda: 'BRL', notas: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const input = 'w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'

  const existente = comisiones.find(c => c.fecha === form.fecha)

  async function guardar(e) {
    e.preventDefault()
    const monto = Number(String(form.monto).replace(',', '.'))
    if (!form.fecha || !String(form.monto).trim() || Number.isNaN(monto)) { setError('Poné la fecha y el monto.'); return }
    setGuardando(true)
    const { data, error } = await comisionesAgenciaApi.guardar({ fecha: form.fecha, monto, moneda: form.moneda, notas: form.notas.trim() || null })
    setGuardando(false)
    if (error || !data) { setError('No se pudo guardar: ' + (error?.message || 'intentá de nuevo')); return }
    setComisiones(prev => [data, ...prev.filter(c => c.fecha !== data.fecha)].sort((a, b) => b.fecha.localeCompare(a.fecha)))
    setForm(p => ({ ...p, monto: '', notas: '' }))
  }

  async function borrar(c) {
    if (!await confirmar(`¿Borrar la comisión del ${fechaCorta(c.fecha)}?`)) return
    await comisionesAgenciaApi.delete(c.id)
    setComisiones(prev => prev.filter(x => x.id !== c.id))
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={onCerrar}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg text-gray-900 dark:text-zinc-100">Comisión diaria de la agencia</h2>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Lo que gana DreamTours en el día (en el Excel, "COMISION DREAM")</p>
          </div>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={guardar} className="px-6 pb-4 grid grid-cols-2 sm:grid-cols-[1fr_1fr_80px] gap-2 items-end">
          <label className="block"><span className="block text-xs text-gray-500 mb-1">Día</span>
            <input type="date" value={form.fecha} onChange={e => { setForm(p => ({ ...p, fecha: e.target.value })); setError('') }} className={input} /></label>
          <label className="block"><span className="block text-xs text-gray-500 mb-1">Monto</span>
            <input inputMode="decimal" value={form.monto} onChange={e => { setForm(p => ({ ...p, monto: e.target.value })); setError('') }} className={input} /></label>
          <label className="block"><span className="block text-xs text-gray-500 mb-1">Moneda</span>
            <select value={form.moneda} onChange={e => setForm(p => ({ ...p, moneda: e.target.value }))} className={input}>
              <option value="BRL">R$</option><option value="USD">US$</option>
            </select></label>
          <label className="block col-span-2 sm:col-span-3"><span className="block text-xs text-gray-500 mb-1">Nota (opcional)</span>
            <input value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} className={input} /></label>
          {existente && <p className="col-span-2 sm:col-span-3 text-xs text-amber-600">Ese día ya tiene {formatMonto(existente.monto, existente.moneda)}: si guardás, se reemplaza.</p>}
          {error && <p className="col-span-2 sm:col-span-3 text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={guardando} className="col-span-2 sm:col-span-3 bg-brand-600 dark:bg-brand-500 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar comisión del día'}
          </button>
        </form>
        <div className="flex-1 overflow-y-auto border-t border-gray-100 dark:border-zinc-800">
          {comisiones.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Todavía no hay comisiones cargadas.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                {comisiones.map(c => (
                  <tr key={c.id}>
                    <td className="px-6 py-2 text-gray-500 whitespace-nowrap">{fechaCorta(c.fecha)}</td>
                    <td className="px-2 py-2 font-semibold text-gray-900 dark:text-zinc-100 whitespace-nowrap">{formatMonto(c.monto, c.moneda)}</td>
                    <td className="px-2 py-2 text-gray-400 text-xs">{c.notas}</td>
                    <td className="px-6 py-2 text-right"><button onClick={() => borrar(c)} className="text-gray-300 hover:text-red-500">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
