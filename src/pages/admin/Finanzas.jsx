import { useState, useEffect, useMemo } from 'react'
import { movimientosApi, costosExcursionApi, excursionesApi } from '../../lib/supabase.js'

// ── Helpers ──────────────────────────────────────────────────────────────────
function hoy() { return new Date().toISOString().split('T')[0] }

function rangoFechas(periodo) {
  const hoyStr = hoy()
  if (periodo === 'hoy') return { desde: hoyStr, hasta: hoyStr }
  if (periodo === 'semana') {
    const d = new Date(); d.setDate(d.getDate() - 6)
    return { desde: d.toISOString().split('T')[0], hasta: hoyStr }
  }
  if (periodo === 'mes') {
    const d = new Date(); d.setDate(1)
    return { desde: d.toISOString().split('T')[0], hasta: hoyStr }
  }
  return { desde: hoyStr, hasta: hoyStr }
}

function formatMonto(monto, moneda) {
  const sym = moneda === 'BRL' ? 'R$' : moneda === 'ARS' ? '$' : 'U$D'
  return `${sym} ${Number(monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
}

function formatFecha(f) {
  if (!f) return ''
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

const CATEGORIAS = [
  { id: 'reserva',   label: 'Reserva',   color: 'bg-blue-100 text-blue-700' },
  { id: 'guia',      label: 'Guía',      color: 'bg-purple-100 text-purple-700' },
  { id: 'chofer',    label: 'Chofer',    color: 'bg-orange-100 text-orange-700' },
  { id: 'proveedor', label: 'Proveedor', color: 'bg-yellow-100 text-yellow-700' },
  { id: 'comision',  label: 'Comisión',  color: 'bg-pink-100 text-pink-700' },
  { id: 'otro',      label: 'Otro',      color: 'bg-gray-100 text-gray-600' },
]

const METODOS = ['efectivo', 'transferencia', 'qr', 'tarjeta']
const MONEDAS = ['USD', 'BRL', 'ARS']

const FORM_EMPTY = {
  fecha: hoy(), tipo: 'ingreso', categoria: 'reserva',
  concepto: '', monto: '', moneda: 'USD',
  persona_nombre: '', metodo: 'efectivo', estado: 'confirmado', notas: '',
}

// ── Íconos ────────────────────────────────────────────────────────────────────
const IcoIngreso = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
)
const IcoEgreso = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>
  </svg>
)
const IcoBalance = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
)
const IcoPlus = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const IcoTrash = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)

// ── Componente principal ──────────────────────────────────────────────────────
export default function Finanzas() {
  const [tab, setTab] = useState('movimientos')
  const [periodo, setPeriodo] = useState('mes')
  const [movimientos, setMovimientos] = useState([])
  const [excursiones, setExcursiones] = useState([])
  const [costos, setCostos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [modalMovimiento, setModalMovimiento] = useState(false)
  const [form, setForm] = useState(FORM_EMPTY)
  const [guardando, setGuardando] = useState(false)
  const [eliminandoId, setEliminandoId] = useState(null)

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setCargando(true)
    const [rm, re, rc] = await Promise.all([
      movimientosApi.getAll(),
      excursionesApi.getAll(),
      costosExcursionApi.getAll(),
    ])
    setMovimientos(rm.data || [])
    setExcursiones(re.data || [])
    setCostos(rc.data || [])
    setCargando(false)
  }

  // ── Filtrado y balance ──────────────────────────────────────────────────────
  const { desde, hasta } = rangoFechas(periodo)

  const movimientosFiltradosPeriodo = useMemo(() =>
    movimientos.filter(m => m.fecha >= desde && m.fecha <= hasta),
    [movimientos, desde, hasta]
  )

  const movimientosFiltrados = useMemo(() => {
    let list = movimientosFiltradosPeriodo
    if (filtroTipo !== 'todos') list = list.filter(m => m.tipo === filtroTipo)
    if (filtroCategoria !== 'todas') list = list.filter(m => m.categoria === filtroCategoria)
    return list.sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [movimientosFiltradosPeriodo, filtroTipo, filtroCategoria])

  const totalIngresos = useMemo(() =>
    movimientosFiltradosPeriodo.filter(m => m.tipo === 'ingreso' && m.moneda === 'USD')
      .reduce((s, m) => s + Number(m.monto), 0),
    [movimientosFiltradosPeriodo]
  )
  const totalEgresos = useMemo(() =>
    movimientosFiltradosPeriodo.filter(m => m.tipo === 'egreso' && m.moneda === 'USD')
      .reduce((s, m) => s + Number(m.monto), 0),
    [movimientosFiltradosPeriodo]
  )
  const balance = totalIngresos - totalEgresos

  // Desglose por categoría
  const porCategoria = useMemo(() => {
    const map = {}
    movimientosFiltradosPeriodo.forEach(m => {
      if (m.moneda !== 'USD') return
      if (!map[m.categoria]) map[m.categoria] = { ingreso: 0, egreso: 0 }
      map[m.categoria][m.tipo] += Number(m.monto)
    })
    return map
  }, [movimientosFiltradosPeriodo])

  // ── Acciones ────────────────────────────────────────────────────────────────
  async function guardarMovimiento() {
    if (!form.concepto.trim() || !form.monto) return
    setGuardando(true)
    await movimientosApi.create({
      fecha: form.fecha, tipo: form.tipo, categoria: form.categoria,
      concepto: form.concepto, monto: parseFloat(form.monto),
      moneda: form.moneda, persona_nombre: form.persona_nombre || null,
      metodo: form.metodo, estado: form.estado,
      notas: form.notas || null,
    })
    setGuardando(false)
    setModalMovimiento(false)
    setForm(FORM_EMPTY)
    cargarTodo()
  }

  async function eliminarMovimiento(id) {
    await movimientosApi.delete(id)
    setMovimientos(prev => prev.filter(m => m.id !== id))
    setEliminandoId(null)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finanzas</h1>
          <p className="text-gray-400 text-sm">Balance, movimientos y costos operativos</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-1">
            {['hoy', 'semana', 'mes'].map(p => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  periodo === p ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {p === 'hoy' ? 'Hoy' : p === 'semana' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setForm(FORM_EMPTY); setModalMovimiento(true) }}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <IcoPlus /> Registrar movimiento
          </button>
        </div>
      </div>

      {/* Cards de balance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center text-green-600"><IcoIngreso /></div>
            <span className="text-sm font-medium text-gray-500">Ingresos</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatMonto(totalIngresos, 'USD')}</p>
          <p className="text-xs text-gray-400 mt-1">{movimientosFiltradosPeriodo.filter(m => m.tipo === 'ingreso').length} movimientos</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center text-red-500"><IcoEgreso /></div>
            <span className="text-sm font-medium text-gray-500">Egresos</span>
          </div>
          <p className="text-2xl font-bold text-red-500">{formatMonto(totalEgresos, 'USD')}</p>
          <p className="text-xs text-gray-400 mt-1">{movimientosFiltradosPeriodo.filter(m => m.tipo === 'egreso').length} movimientos</p>
        </div>

        <div className={`rounded-2xl border shadow-sm p-5 ${balance >= 0 ? 'bg-brand-50 border-brand-100' : 'bg-red-50 border-red-100'}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${balance >= 0 ? 'bg-brand-100 text-brand-700' : 'bg-red-100 text-red-600'}`}><IcoBalance /></div>
            <span className="text-sm font-medium text-gray-500">Balance neto</span>
          </div>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-brand-700' : 'text-red-600'}`}>{formatMonto(balance, 'USD')}</p>
          <p className="text-xs text-gray-400 mt-1">Solo movimientos en USD</p>
        </div>
      </div>

      {/* Desglose rápido */}
      {Object.keys(porCategoria).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Desglose por categoría (USD)</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {CATEGORIAS.map(cat => {
              const d = porCategoria[cat.id]
              if (!d) return null
              return (
                <div key={cat.id} className="bg-gray-50 rounded-xl p-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cat.color}`}>{cat.label}</span>
                  {d.ingreso > 0 && <p className="text-xs text-green-600 mt-1.5 font-medium">+{formatMonto(d.ingreso, 'USD')}</p>}
                  {d.egreso > 0 && <p className="text-xs text-red-500 font-medium">-{formatMonto(d.egreso, 'USD')}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-1.5 w-fit">
        {[
          { id: 'movimientos', label: '📋 Movimientos' },
          { id: 'costos', label: '⚙️ Costos operativos' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Movimientos ─────────────────────────────────────────────────── */}
      {tab === 'movimientos' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          {/* Filtros */}
          <div className="flex flex-wrap gap-3 p-4 border-b border-gray-50">
            <select
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="todos">Todos los tipos</option>
              <option value="ingreso">Solo ingresos</option>
              <option value="egreso">Solo egresos</option>
            </select>
            <select
              value={filtroCategoria}
              onChange={e => setFiltroCategoria(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="todas">Todas las categorías</option>
              {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <span className="ml-auto text-sm text-gray-400 self-center">{movimientosFiltrados.length} registros</span>
          </div>

          {cargando ? (
            <div className="text-center py-12 text-gray-400">Cargando...</div>
          ) : movimientosFiltrados.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">💰</p>
              <p className="font-medium">No hay movimientos en este período.</p>
              <button onClick={() => { setForm(FORM_EMPTY); setModalMovimiento(true) }} className="mt-3 text-sm text-brand-600 hover:text-brand-800 font-medium underline">
                Registrar el primero
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Fecha</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Tipo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Categoría</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Concepto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Persona</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Método</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Monto</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {movimientosFiltrados.map(m => {
                    const cat = CATEGORIAS.find(c => c.id === m.categoria)
                    return (
                      <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{formatFecha(m.fecha)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                            m.tipo === 'ingreso' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                          }`}>
                            {m.tipo === 'ingreso' ? '↑' : '↓'} {m.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cat?.color}`}>{cat?.label}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px] truncate">{m.concepto}</td>
                        <td className="px-4 py-3 text-gray-500">{m.persona_nombre || '—'}</td>
                        <td className="px-4 py-3 text-gray-400 capitalize">{m.metodo}</td>
                        <td className={`px-4 py-3 text-right font-bold font-mono ${
                          m.tipo === 'ingreso' ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {m.tipo === 'ingreso' ? '+' : '-'}{formatMonto(m.monto, m.moneda)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            m.estado === 'confirmado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {m.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {eliminandoId === m.id ? (
                            <span className="flex items-center gap-1 justify-center text-xs">
                              <button onClick={() => eliminarMovimiento(m.id)} className="text-red-500 font-semibold hover:text-red-700">Sí</button>
                              <span className="text-gray-300">/</span>
                              <button onClick={() => setEliminandoId(null)} className="text-gray-400 hover:text-gray-600">No</button>
                            </span>
                          ) : (
                            <button onClick={() => setEliminandoId(m.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                              <IcoTrash />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Costos operativos ───────────────────────────────────────────── */}
      {tab === 'costos' && (
        <TabCostos excursiones={excursiones} costos={costos} onRefresh={cargarTodo} />
      )}

      {/* ── Modal: Nuevo movimiento ──────────────────────────────────────────── */}
      {modalMovimiento && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setModalMovimiento(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-lg">Registrar movimiento</h2>
              <button onClick={() => setModalMovimiento(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="p-5 space-y-4">
              {/* Tipo */}
              <div className="flex gap-2">
                {['ingreso', 'egreso'].map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(f => ({ ...f, tipo: t }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                      form.tipo === t
                        ? t === 'ingreso' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {t === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Fecha */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Fecha</label>
                  <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                {/* Categoría */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Categoría</label>
                  <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Concepto */}
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Concepto *</label>
                <input type="text" value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))}
                  placeholder="Ej: Seña Maragogi — Juan Pérez"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>

              {/* Persona */}
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Persona (guía / chofer / vendedor)</label>
                <input type="text" value={form.persona_nombre} onChange={e => setForm(f => ({ ...f, persona_nombre: e.target.value }))}
                  placeholder="Nombre (opcional)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Monto */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Monto *</label>
                  <input type="number" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                    placeholder="0.00" min="0" step="0.01"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                {/* Moneda */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Moneda</label>
                  <select value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                {/* Método */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Método</label>
                  <select value={form.metodo} onChange={e => setForm(f => ({ ...f, metodo: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Estado */}
              <div className="flex gap-2">
                {['confirmado', 'pendiente'].map(e => (
                  <button key={e} onClick={() => setForm(f => ({ ...f, estado: e }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      form.estado === e ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}>
                    {e === 'confirmado' ? '✅ Confirmado' : '⏳ Pendiente'}
                  </button>
                ))}
              </div>

              {/* Notas */}
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Notas</label>
                <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                  rows={2} placeholder="Opcional..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" />
              </div>
            </div>

            <div className="px-5 pb-5">
              <button onClick={guardarMovimiento} disabled={guardando || !form.concepto.trim() || !form.monto}
                className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
                {guardando ? 'Guardando...' : 'Guardar movimiento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab Costos ────────────────────────────────────────────────────────────────
function TabCostos({ excursiones, costos, onRefresh }) {
  const [excSeleccionada, setExcSeleccionada] = useState(null)
  const [formCosto, setFormCosto] = useState({ concepto: '', monto_por_persona: '', moneda: 'BRL' })
  const [guardando, setGuardando] = useState(false)

  const costosDeExcursion = excSeleccionada
    ? costos.filter(c => c.excursion_id === excSeleccionada)
    : []

  async function agregarCosto() {
    if (!excSeleccionada || !formCosto.concepto.trim() || !formCosto.monto_por_persona) return
    setGuardando(true)
    await costosExcursionApi.create({
      excursion_id: excSeleccionada,
      concepto: formCosto.concepto,
      monto_por_persona: parseFloat(formCosto.monto_por_persona),
      moneda: formCosto.moneda,
    })
    setFormCosto({ concepto: '', monto_por_persona: '', moneda: 'BRL' })
    setGuardando(false)
    onRefresh()
  }

  async function eliminarCosto(id) {
    await costosExcursionApi.delete(id)
    onRefresh()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Lista excursiones */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Excursiones</p>
        <div className="space-y-1">
          {excursiones.map(exc => {
            const nCostos = costos.filter(c => c.excursion_id === exc.id).length
            return (
              <button
                key={exc.id}
                onClick={() => setExcSeleccionada(exc.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors flex items-center justify-between ${
                  excSeleccionada === exc.id ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="truncate">{exc.nombre}</span>
                {nCostos > 0 && (
                  <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">{nCostos}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Costos de la excursión seleccionada */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {!excSeleccionada ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-3xl mb-2">⚙️</p>
            <p className="text-sm">Seleccioná una excursión para ver sus costos</p>
          </div>
        ) : (
          <>
            <p className="font-semibold text-gray-800 mb-4">
              {excursiones.find(e => e.id === excSeleccionada)?.nombre}
            </p>

            {/* Costos existentes */}
            {costosDeExcursion.length > 0 ? (
              <div className="space-y-2 mb-5">
                {costosDeExcursion.map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{c.concepto}</p>
                      <p className="text-xs text-gray-400">por persona</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-700">{formatMonto(c.monto_por_persona, c.moneda)}</span>
                      <button onClick={() => eliminarCosto(c.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                        <IcoTrash />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 mb-5">Sin costos cargados todavía.</p>
            )}

            {/* Agregar costo */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Agregar costo</p>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  value={formCosto.concepto}
                  onChange={e => setFormCosto(f => ({ ...f, concepto: e.target.value }))}
                  placeholder="Ej: Catamarán, Day use, Entrada..."
                  className="flex-1 min-w-[150px] border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <input
                  type="number"
                  value={formCosto.monto_por_persona}
                  onChange={e => setFormCosto(f => ({ ...f, monto_por_persona: e.target.value }))}
                  placeholder="Monto"
                  className="w-28 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <select
                  value={formCosto.moneda}
                  onChange={e => setFormCosto(f => ({ ...f, moneda: e.target.value }))}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <button
                  onClick={agregarCosto}
                  disabled={guardando || !formCosto.concepto.trim() || !formCosto.monto_por_persona}
                  className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-1"
                >
                  <IcoPlus /> Agregar
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
