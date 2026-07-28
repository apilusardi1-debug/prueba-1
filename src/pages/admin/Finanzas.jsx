import { useState, useEffect, useMemo } from 'react'
import { movimientosApi, costosExcursionApi, excursionesApi, clientesApi, choferesApi, guiasApi, vendedoresApi, conceptosApi } from '../../lib/supabase.js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

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

const CATEGORIAS_INGRESO = [
  { id: 'ingreso',    label: 'Ingreso',    color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' },
  { id: 'sena',       label: 'Seña',       color: 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400' },
  { id: 'pago_total', label: 'Pago total', color: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' },
]
const CATEGORIAS_EGRESO = [
  { id: 'guia',      label: 'Guía',      color: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400' },
  { id: 'chofer',    label: 'Chofer',    color: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' },
  { id: 'proveedor', label: 'Proveedor', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400' },
  { id: 'comision',  label: 'Comisión',  color: 'bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400' },
  { id: 'otro',      label: 'Otro',      color: 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400' },
]
// Lista completa (incluye 'reserva' legado) — se usa solo para filtrar/mostrar
// movimientos ya cargados, no para elegir categoría al crear uno nuevo.
const CATEGORIAS = [
  { id: 'reserva', label: 'Reserva', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' },
  ...CATEGORIAS_INGRESO,
  ...CATEGORIAS_EGRESO,
]

const METODOS = ['efectivo', 'transferencia', 'qr', 'tarjeta']
const MONEDAS = ['USD', 'BRL', 'ARS']
const CLAVE_EDITAR_MOVIMIENTO = 'dreamtorus'

const FORM_EMPTY = {
  fecha: hoy(), tipo: 'ingreso', categoria: 'ingreso',
  concepto: '', monto: '', moneda: 'BRL',
  cliente_id: null, cliente_nombre: '',
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
const IcoEdit = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
  </svg>
)

// ── Componente principal ──────────────────────────────────────────────────────
export default function Finanzas() {
  const [tab, setTab] = useState('movimientos')
  const [periodo, setPeriodo] = useState('mes')
  const [movimientos, setMovimientos] = useState([])
  const [excursiones, setExcursiones] = useState([])
  const [costos, setCostos] = useState([])
  const [clientes, setClientes] = useState([])
  const [sugerenciasCliente, setSugerenciasCliente] = useState([])
  const [personas, setPersonas] = useState([])
  const [sugerenciasPersona, setSugerenciasPersona] = useState([])
  const [conceptos, setConceptos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [modalMovimiento, setModalMovimiento] = useState(false)
  const [form, setForm] = useState(FORM_EMPTY)
  const [guardando, setGuardando] = useState(false)
  const [eliminandoId, setEliminandoId] = useState(null)
  const [movEditandoId, setMovEditandoId] = useState(null)
  const [passwordParaId, setPasswordParaId] = useState(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setCargando(true)
    const [rm, re, rc, rcl, rch, rg, rv, rco] = await Promise.all([
      movimientosApi.getAll(),
      excursionesApi.getAll(),
      costosExcursionApi.getAll(),
      clientesApi.getAll(),
      choferesApi.getAll(),
      guiasApi.getAll(),
      vendedoresApi.getAll(),
      conceptosApi.getAll(),
    ])
    setMovimientos(rm.data || [])
    setExcursiones(re.data || [])
    setCostos(rc.data || [])
    setClientes(rcl.data || [])
    setPersonas([
      ...(rch.data || []).map(p => ({ nombre: p.nombre, tipo: 'Chofer' })),
      ...(rg.data || []).map(p => ({ nombre: p.nombre, tipo: 'Guía' })),
      ...(rv.data || []).map(p => ({ nombre: p.nombre, tipo: 'Vendedor' })),
    ])
    setConceptos((rco.data || []).filter(c => c.activo))
    setCargando(false)
  }

  function buscarCliente(texto) {
    setForm(f => ({ ...f, cliente_nombre: texto, cliente_id: null }))
    if (texto.length < 2) return setSugerenciasCliente([])
    const lower = texto.toLowerCase()
    setSugerenciasCliente(clientes.filter(c => c.nombre?.toLowerCase().includes(lower) || c.whatsapp?.includes(texto)).slice(0, 5))
  }

  function elegirCliente(c) {
    setForm(f => ({ ...f, cliente_id: c.id, cliente_nombre: c.nombre }))
    setSugerenciasCliente([])
  }

  function buscarPersona(texto) {
    setForm(f => ({ ...f, persona_nombre: texto }))
    if (texto.length < 2) return setSugerenciasPersona([])
    const lower = texto.toLowerCase()
    setSugerenciasPersona(personas.filter(p => p.nombre?.toLowerCase().includes(lower)).slice(0, 5))
  }

  function elegirPersona(p) {
    setForm(f => ({ ...f, persona_nombre: p.nombre }))
    setSugerenciasPersona([])
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
    movimientosFiltradosPeriodo.filter(m => m.tipo === 'ingreso' && m.moneda === 'BRL')
      .reduce((s, m) => s + Number(m.monto), 0),
    [movimientosFiltradosPeriodo]
  )
  const totalEgresos = useMemo(() =>
    movimientosFiltradosPeriodo.filter(m => m.tipo === 'egreso' && m.moneda === 'BRL')
      .reduce((s, m) => s + Number(m.monto), 0),
    [movimientosFiltradosPeriodo]
  )
  const balance = totalIngresos - totalEgresos

  // Desglose por categoría
  const porCategoria = useMemo(() => {
    const map = {}
    movimientosFiltradosPeriodo.forEach(m => {
      if (m.moneda !== 'BRL') return
      if (!map[m.categoria]) map[m.categoria] = { ingreso: 0, egreso: 0 }
      map[m.categoria][m.tipo] += Number(m.monto)
    })
    return map
  }, [movimientosFiltradosPeriodo])

  // ── Acciones ────────────────────────────────────────────────────────────────
  async function guardarMovimiento() {
    if (!form.concepto.trim() || !form.monto) return
    setGuardando(true)
    const payload = {
      fecha: form.fecha, tipo: form.tipo, categoria: form.categoria,
      concepto: form.concepto, monto: parseFloat(form.monto),
      moneda: form.moneda, persona_nombre: form.persona_nombre || null,
      cliente_id: form.cliente_id, cliente_nombre: form.cliente_nombre.trim() || null,
      metodo: form.metodo, estado: form.estado,
      notas: form.notas || null,
    }
    if (movEditandoId) {
      await movimientosApi.update(movEditandoId, payload)
    } else {
      await movimientosApi.create(payload)
    }
    setGuardando(false)
    setModalMovimiento(false)
    setForm(FORM_EMPTY)
    setMovEditandoId(null)
    cargarTodo()
  }

  async function eliminarMovimiento(id) {
    await movimientosApi.delete(id)
    setMovimientos(prev => prev.filter(m => m.id !== id))
    setEliminandoId(null)
  }

  function pedirEdicion(m) {
    setPasswordParaId(m.id)
    setPasswordInput('')
    setPasswordError('')
  }

  function cancelarPassword() {
    setPasswordParaId(null)
    setPasswordInput('')
    setPasswordError('')
  }

  function confirmarPassword() {
    if (passwordInput !== CLAVE_EDITAR_MOVIMIENTO) {
      setPasswordError('Contraseña incorrecta.')
      return
    }
    const m = movimientos.find(mov => mov.id === passwordParaId)
    if (!m) { cancelarPassword(); return }
    setForm({
      fecha: m.fecha, tipo: m.tipo, categoria: m.categoria,
      concepto: m.concepto, monto: String(m.monto), moneda: m.moneda,
      persona_nombre: m.persona_nombre || '', metodo: m.metodo,
      cliente_id: m.cliente_id || null, cliente_nombre: m.cliente_nombre || '',
      estado: m.estado, notas: m.notas || '',
    })
    setMovEditandoId(m.id)
    setModalMovimiento(true)
    cancelarPassword()
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Finanzas</h1>
          <p className="text-gray-400 dark:text-zinc-600 text-sm">Balance, movimientos y costos operativos</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-1 gap-1">
            {['hoy', 'semana', 'mes'].map(p => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  periodo === p ? 'bg-brand-600 dark:bg-brand-500 text-white shadow-sm' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800'
                }`}
              >
                {p === 'hoy' ? 'Hoy' : p === 'semana' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setForm(FORM_EMPTY); setMovEditandoId(null); setModalMovimiento(true) }}
            className="flex items-center gap-2 bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <IcoPlus /> Registrar movimiento
          </button>
        </div>
      </div>

      {/* Cards de balance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-950/40 flex items-center justify-center text-green-600 dark:text-green-400"><IcoIngreso /></div>
            <span className="text-sm font-medium text-gray-500 dark:text-zinc-500">Ingresos</span>
          </div>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatMonto(totalIngresos, 'BRL')}</p>
          <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1">{movimientosFiltradosPeriodo.filter(m => m.tipo === 'ingreso').length} movimientos</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center text-red-500 dark:text-red-400"><IcoEgreso /></div>
            <span className="text-sm font-medium text-gray-500 dark:text-zinc-500">Egresos</span>
          </div>
          <p className="text-2xl font-bold text-red-500 dark:text-red-400">{formatMonto(totalEgresos, 'BRL')}</p>
          <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1">{movimientosFiltradosPeriodo.filter(m => m.tipo === 'egreso').length} movimientos</p>
        </div>

        <div className={`rounded-2xl border shadow-sm p-5 ${balance >= 0 ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-100 dark:border-brand-900' : 'bg-red-50 dark:bg-red-950/40 border-red-100 dark:border-red-900'}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${balance >= 0 ? 'bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-400' : 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'}`}><IcoBalance /></div>
            <span className="text-sm font-medium text-gray-500 dark:text-zinc-500">Balance neto</span>
          </div>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-brand-700 dark:text-brand-400' : 'text-red-600 dark:text-red-400'}`}>{formatMonto(balance, 'BRL')}</p>
          <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1">Solo movimientos en BRL</p>
        </div>
      </div>

      {/* Desglose rápido */}
      {Object.keys(porCategoria).length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-3">Desglose por categoría (BRL)</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {CATEGORIAS.map(cat => {
              const d = porCategoria[cat.id]
              if (!d) return null
              return (
                <div key={cat.id} className="bg-gray-50 dark:bg-zinc-800/60 rounded-xl p-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cat.color}`}>{cat.label}</span>
                  {d.ingreso > 0 && <p className="text-xs text-green-600 dark:text-green-400 mt-1.5 font-medium">+{formatMonto(d.ingreso, 'USD')}</p>}
                  {d.egreso > 0 && <p className="text-xs text-red-500 dark:text-red-400 font-medium">-{formatMonto(d.egreso, 'USD')}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-1.5 w-fit">
        {[
          { id: 'movimientos', label: '📋 Movimientos' },
          { id: 'costos', label: '⚙️ Costos operativos' },
          { id: 'mercadopago', label: '💳 Mercado Pago' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-brand-600 dark:bg-brand-500 text-white shadow-sm' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Movimientos ─────────────────────────────────────────────────── */}
      {tab === 'movimientos' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
          {/* Filtros */}
          <div className="flex flex-wrap gap-3 p-4 border-b border-gray-50 dark:border-zinc-800">
            <select
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
              className="border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="todos">Todos los tipos</option>
              <option value="ingreso">Solo ingresos</option>
              <option value="egreso">Solo egresos</option>
            </select>
            <select
              value={filtroCategoria}
              onChange={e => setFiltroCategoria(e.target.value)}
              className="border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="todas">Todas las categorías</option>
              {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <span className="ml-auto text-sm text-gray-400 dark:text-zinc-600 self-center">{movimientosFiltrados.length} registros</span>
          </div>

          {cargando ? (
            <div className="text-center py-12 text-gray-400 dark:text-zinc-600">Cargando...</div>
          ) : movimientosFiltrados.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-zinc-600">
              <p className="text-4xl mb-3">💰</p>
              <p className="font-medium">No hay movimientos en este período.</p>
              <button onClick={() => { setForm(FORM_EMPTY); setModalMovimiento(true) }} className="mt-3 text-sm text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium underline">
                Registrar el primero
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-zinc-800">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-zinc-600 uppercase tracking-wide">Fecha</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-zinc-600 uppercase tracking-wide">Tipo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-zinc-600 uppercase tracking-wide">Categoría</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-zinc-600 uppercase tracking-wide">Concepto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-zinc-600 uppercase tracking-wide">Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-zinc-600 uppercase tracking-wide">Persona</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-zinc-600 uppercase tracking-wide">Método</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 dark:text-zinc-600 uppercase tracking-wide">Monto</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 dark:text-zinc-600 uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                  {movimientosFiltrados.map(m => {
                    const cat = CATEGORIAS.find(c => c.id === m.categoria)
                    return (
                      <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-4 py-3 text-gray-500 dark:text-zinc-500 font-mono text-xs">{formatFecha(m.fecha)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                            m.tipo === 'ingreso' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                          }`}>
                            {m.tipo === 'ingreso' ? '↑' : '↓'} {m.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cat?.color}`}>{cat?.label}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-zinc-200 max-w-[200px] truncate">{m.concepto}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-zinc-500">{m.cliente_nombre || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-zinc-500">{m.persona_nombre || '—'}</td>
                        <td className="px-4 py-3 text-gray-400 dark:text-zinc-600 capitalize">{m.metodo}</td>
                        <td className={`px-4 py-3 text-right font-bold font-mono ${
                          m.tipo === 'ingreso' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
                        }`}>
                          {m.tipo === 'ingreso' ? '+' : '-'}{formatMonto(m.monto, m.moneda)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            m.estado === 'confirmado' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400'
                          }`}>
                            {m.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {eliminandoId === m.id ? (
                            <span className="flex items-center gap-1 justify-center text-xs">
                              <button onClick={() => eliminarMovimiento(m.id)} className="text-red-500 dark:text-red-400 font-semibold hover:text-red-700 dark:hover:text-red-300">Sí</button>
                              <span className="text-gray-300 dark:text-zinc-700">/</span>
                              <button onClick={() => setEliminandoId(null)} className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300">No</button>
                            </span>
                          ) : (
                            <span className="flex items-center gap-2 justify-center">
                              <button onClick={() => pedirEdicion(m)} className="text-gray-300 dark:text-zinc-700 hover:text-brand-500 dark:hover:text-brand-400 transition-colors" title="Editar (requiere contraseña)">
                                <IcoEdit />
                              </button>
                              <button onClick={() => setEliminandoId(m.id)} className="text-gray-300 dark:text-zinc-700 hover:text-red-400 dark:hover:text-red-400 transition-colors">
                                <IcoTrash />
                              </button>
                            </span>
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
        <TabCostos excursiones={excursiones} costos={costos} setCostos={setCostos} />
      )}

      {/* ── Tab: Mercado Pago ────────────────────────────────────────────────── */}
      {tab === 'mercadopago' && (
        <TabMercadoPago movimientos={movimientos} />
      )}

      {/* ── Modal: Nuevo movimiento ──────────────────────────────────────────── */}
      {modalMovimiento && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setModalMovimiento(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl dark:shadow-black/40 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800">
              <h2 className="font-bold text-lg text-gray-900 dark:text-zinc-100">{movEditandoId ? 'Editar movimiento' : 'Registrar movimiento'}</h2>
              <button onClick={() => { setModalMovimiento(false); setMovEditandoId(null) }} className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 text-xl">✕</button>
            </div>

            <div className="p-5 space-y-4">
              {/* Tipo */}
              <div className="flex gap-2">
                {['ingreso', 'egreso'].map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(f => ({ ...f, tipo: t, categoria: (t === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO)[0].id }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                      form.tipo === t
                        ? t === 'ingreso' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500'
                        : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {t === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Fecha */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-zinc-400 block mb-1">Fecha</label>
                  <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                {/* Categoría */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-zinc-400 block mb-1">Categoría</label>
                  <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    {(form.tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Concepto */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-zinc-400 block mb-1">Concepto *</label>
                <select value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                  <option value="">— Seleccioná un concepto —</option>
                  {conceptos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                </select>
              </div>

              {/* Cliente */}
              <div className="relative">
                <label className="text-xs font-semibold text-gray-500 dark:text-zinc-400 block mb-1">Cliente</label>
                <input type="text" value={form.cliente_nombre} onChange={e => buscarCliente(e.target.value)}
                  placeholder="Buscar cliente..." autoComplete="off"
                  className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                {sugerenciasCliente.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg dark:shadow-black/40 mt-1 overflow-hidden">
                    {sugerenciasCliente.map(c => (
                      <button key={c.id} type="button" onClick={() => elegirCliente(c)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 flex items-center justify-between gap-2">
                        <span className="font-medium text-gray-800 dark:text-zinc-200">{c.nombre}</span>
                        <span className="text-xs text-gray-400 dark:text-zinc-500 font-mono">{c.whatsapp}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Persona */}
              <div className="relative">
                <label className="text-xs font-semibold text-gray-500 dark:text-zinc-400 block mb-1">Persona (guía / chofer / vendedor)</label>
                <input type="text" value={form.persona_nombre} onChange={e => buscarPersona(e.target.value)}
                  placeholder="Nombre (opcional)" autoComplete="off"
                  className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                {sugerenciasPersona.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg dark:shadow-black/40 mt-1 overflow-hidden">
                    {sugerenciasPersona.map((p, i) => (
                      <button key={`${p.nombre}-${i}`} type="button" onClick={() => elegirPersona(p)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 flex items-center justify-between gap-2">
                        <span className="font-medium text-gray-800 dark:text-zinc-200">{p.nombre}</span>
                        <span className="text-xs text-gray-400 dark:text-zinc-500">{p.tipo}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Monto */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-zinc-400 block mb-1">Monto *</label>
                  <input type="number" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                    placeholder="0.00" min="0" step="0.01"
                    className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                {/* Moneda */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-zinc-400 block mb-1">Moneda</label>
                  <select value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                {/* Método */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-zinc-400 block mb-1">Método</label>
                  <select value={form.metodo} onChange={e => setForm(f => ({ ...f, metodo: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Estado */}
              <div className="flex gap-2">
                {['confirmado', 'pendiente'].map(e => (
                  <button key={e} onClick={() => setForm(f => ({ ...f, estado: e }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      form.estado === e ? 'bg-brand-600 dark:bg-brand-500 text-white border-brand-600 dark:border-brand-500' : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                    }`}>
                    {e === 'confirmado' ? '✅ Confirmado' : '⏳ Pendiente'}
                  </button>
                ))}
              </div>

              {/* Notas */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-zinc-400 block mb-1">Notas</label>
                <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                  rows={2} placeholder="Opcional..."
                  className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" />
              </div>
            </div>

            <div className="px-5 pb-5">
              <button onClick={guardarMovimiento} disabled={guardando || !form.concepto.trim() || !form.monto}
                className="w-full bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
                {guardando ? 'Guardando...' : movEditandoId ? 'Guardar cambios' : 'Guardar movimiento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contraseña para editar */}
      {passwordParaId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={cancelarPassword}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl dark:shadow-black/40 w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg text-gray-900 dark:text-zinc-100 mb-1">Contraseña requerida</h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-4">Ingresá la contraseña para poder editar este movimiento.</p>
            <input
              type="password"
              autoFocus
              value={passwordInput}
              onChange={e => { setPasswordInput(e.target.value); setPasswordError('') }}
              onKeyDown={e => e.key === 'Enter' && confirmarPassword()}
              placeholder="••••••••"
              className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            {passwordError && <p className="text-xs text-red-500 dark:text-red-400 mt-2">{passwordError}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={cancelarPassword} className="flex-1 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 font-medium py-2.5 rounded-xl text-sm transition-colors">
                Cancelar
              </button>
              <button onClick={confirmarPassword} className="flex-1 bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab Mercado Pago ──────────────────────────────────────────────────────────
function TabMercadoPago({ movimientos }) {
  const [qrImage, setQrImage] = useState(null)
  const [cargandoQr, setCargandoQr] = useState(true)
  const [errorQr, setErrorQr] = useState(null)

  useEffect(() => {
    async function fetchQr() {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/mp-qr`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        })
        const data = await res.json()
        if (data.qr_image) {
          setQrImage(data.qr_image)
        } else {
          setErrorQr(data.error || 'No se pudo obtener el QR')
        }
      } catch (err) {
        setErrorQr(err.message)
      } finally {
        setCargandoQr(false)
      }
    }
    fetchQr()
  }, [])

  async function descargarQr() {
    if (!qrImage) return
    const res = await fetch(qrImage)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'qr-dreamstour-mercadopago.png'
    link.click()
    URL.revokeObjectURL(url)
  }

  const pagosMp = movimientos.filter(m => m.referencia_mp)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 20)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* QR */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-6 flex flex-col items-center gap-5">
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">QR Mercado Pago</h2>
          <p className="text-sm text-gray-400 dark:text-zinc-600 mt-1">El cliente escanea, ingresa el monto y paga</p>
        </div>

        {cargandoQr ? (
          <div className="w-56 h-56 bg-gray-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-gray-400 dark:text-zinc-600 text-sm">
            Cargando QR...
          </div>
        ) : errorQr ? (
          <div className="w-56 h-56 bg-red-50 dark:bg-red-950/40 rounded-2xl flex items-center justify-center text-center p-4">
            <p className="text-sm text-red-500 dark:text-red-400">{errorQr}</p>
          </div>
        ) : (
          <img
            src={qrImage}
            alt="QR Mercado Pago"
            className="w-56 h-56 rounded-2xl border border-gray-100 dark:border-zinc-800"
          />
        )}

        <div className="w-full space-y-2">
          <button
            onClick={descargarQr}
            disabled={!qrImage}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            Descargar QR
          </button>
          <p className="text-xs text-center text-gray-400 dark:text-zinc-600">
            Los pagos quedan registrados automáticamente en Movimientos
          </p>
        </div>
      </div>

      {/* Últimos pagos MP */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-5">
        <h2 className="text-base font-bold text-gray-900 dark:text-zinc-100 mb-4">Últimos pagos recibidos</h2>

        {pagosMp.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-zinc-600">
            <p className="text-3xl mb-2">💳</p>
            <p className="text-sm">Aún no hay pagos registrados via MP QR</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pagosMp.map(m => (
              <div key={m.id} className="flex items-center justify-between bg-gray-50 dark:bg-zinc-800/60 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">{m.persona_nombre || 'Cliente'}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-600">{formatFecha(m.fecha)} · {m.notas}</p>
                </div>
                <span className="text-sm font-bold text-green-600 dark:text-green-400">+{formatMonto(m.monto, m.moneda)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab Costos ────────────────────────────────────────────────────────────────
function crearTramoHelpers(setState) {
  return {
    setTramo: (idx, campo, valor) => setState(f => ({ ...f, tramos: f.tramos.map((t, i) => i === idx ? { ...t, [campo]: valor } : t) })),
    agregarTramo: () => setState(f => ({ ...f, tramos: [...f.tramos, { hasta: '', monto: '' }] })),
    quitarTramo: (idx) => setState(f => ({ ...f, tramos: f.tramos.filter((_, i) => i !== idx) })),
  }
}

function FormularioCosto({ valor, onChange, tramosHelpers, guardando, onSubmit, onCancelar, textoBoton }) {
  const { setTramo, agregarTramo, quitarTramo } = tramosHelpers
  const deshabilitado = guardando || !valor.concepto.trim() ||
    (valor.tipo === 'por_persona' ? !valor.monto_por_persona : valor.tramos.every(t => !t.hasta || !t.monto))

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {[
          { id: 'por_persona', label: 'Por persona' },
          { id: 'chofer_tramos', label: 'Por chofer (según pasajeros)' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => onChange(f => ({ ...f, tipo: t.id }))}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              valor.tipo === t.id
                ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent'
                : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap mb-2">
        <input
          type="text"
          value={valor.concepto}
          onChange={e => onChange(f => ({ ...f, concepto: e.target.value }))}
          placeholder={valor.tipo === 'chofer_tramos' ? 'Ej: Pago chofer' : 'Ej: Prenatour, Catamarán, Entrada...'}
          className="flex-1 min-w-[150px] border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        {valor.tipo === 'por_persona' && (
          <input
            type="number"
            value={valor.monto_por_persona}
            onChange={e => onChange(f => ({ ...f, monto_por_persona: e.target.value }))}
            placeholder="Monto por persona"
            className="w-40 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        )}
        <select
          value={valor.moneda}
          onChange={e => onChange(f => ({ ...f, moneda: e.target.value }))}
          className="border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {valor.tipo === 'chofer_tramos' && (
        <div className="mb-3 space-y-2">
          {valor.tramos.map((t, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 dark:text-zinc-500 shrink-0">Hasta</span>
              <input
                type="number"
                value={t.hasta}
                onChange={e => setTramo(idx, 'hasta', e.target.value)}
                placeholder="Pasajeros"
                className="w-24 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <span className="text-xs text-gray-400 dark:text-zinc-500 shrink-0">pax →</span>
              <input
                type="number"
                value={t.monto}
                onChange={e => setTramo(idx, 'monto', e.target.value)}
                placeholder="Monto"
                className="w-28 border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              {valor.tramos.length > 1 && (
                <button onClick={() => quitarTramo(idx)} className="text-gray-300 dark:text-zinc-700 hover:text-red-400 dark:hover:text-red-400 transition-colors">
                  <IcoTrash />
                </button>
              )}
            </div>
          ))}
          <button onClick={agregarTramo} className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium">
            + Agregar tramo
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={onSubmit}
          disabled={deshabilitado}
          className="bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-1"
        >
          {textoBoton === 'Agregar' && <IcoPlus />} {textoBoton}
        </button>
        {onCancelar && (
          <button onClick={onCancelar} className="text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 font-medium px-3 py-2">
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}

function TabCostos({ excursiones, costos, setCostos }) {
  const [excSeleccionada, setExcSeleccionada] = useState(null)
  const [formCosto, setFormCosto] = useState({ tipo: 'por_persona', concepto: '', monto_por_persona: '', moneda: 'BRL', tramos: [{ hasta: '', monto: '' }] })
  const [guardando, setGuardando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [formEdit, setFormEdit] = useState(null)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

  const costosDeExcursion = excSeleccionada
    ? costos.filter(c => c.excursion_id === excSeleccionada)
    : []

  const tramosHelpersAgregar = crearTramoHelpers(setFormCosto)
  const tramosHelpersEditar = crearTramoHelpers(setFormEdit)

  function armarPayload(valor) {
    const tramosValidos = valor.tramos.filter(t => t.hasta && t.monto)
    return {
      concepto: valor.concepto,
      moneda: valor.moneda,
      tipo: valor.tipo,
      monto_por_persona: valor.tipo === 'por_persona' ? parseFloat(valor.monto_por_persona) : null,
      tramos: valor.tipo === 'chofer_tramos'
        ? tramosValidos.map(t => ({ hasta: parseFloat(t.hasta), monto: parseFloat(t.monto) })).sort((a, b) => a.hasta - b.hasta)
        : null,
    }
  }

  async function agregarCosto() {
    if (!excSeleccionada || !formCosto.concepto.trim()) return
    const tramosValidos = formCosto.tramos.filter(t => t.hasta && t.monto)
    if (formCosto.tipo === 'por_persona' && !formCosto.monto_por_persona) return
    if (formCosto.tipo === 'chofer_tramos' && tramosValidos.length === 0) return
    setGuardando(true)
    const { data } = await costosExcursionApi.create({ excursion_id: excSeleccionada, ...armarPayload(formCosto) })
    if (data) setCostos(prev => [...prev, data])
    setFormCosto({ tipo: 'por_persona', concepto: '', monto_por_persona: '', moneda: 'BRL', tramos: [{ hasta: '', monto: '' }] })
    setGuardando(false)
  }

  async function eliminarCosto(id) {
    setCostos(prev => prev.filter(c => c.id !== id))
    await costosExcursionApi.delete(id)
  }

  function iniciarEdicion(c) {
    setEditandoId(c.id)
    setFormEdit({
      tipo: c.tipo || 'por_persona',
      concepto: c.concepto,
      monto_por_persona: c.monto_por_persona != null ? String(c.monto_por_persona) : '',
      moneda: c.moneda || 'BRL',
      tramos: c.tramos && c.tramos.length ? c.tramos.map(t => ({ hasta: String(t.hasta), monto: String(t.monto) })) : [{ hasta: '', monto: '' }],
    })
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setFormEdit(null)
  }

  async function guardarEdicion() {
    if (!formEdit.concepto.trim()) return
    const tramosValidos = formEdit.tramos.filter(t => t.hasta && t.monto)
    if (formEdit.tipo === 'por_persona' && !formEdit.monto_por_persona) return
    if (formEdit.tipo === 'chofer_tramos' && tramosValidos.length === 0) return
    setGuardandoEdicion(true)
    const { data } = await costosExcursionApi.update(editandoId, armarPayload(formEdit))
    if (data) setCostos(prev => prev.map(c => c.id === editandoId ? data : c))
    setGuardandoEdicion(false)
    cancelarEdicion()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Lista excursiones */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-4">
        <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-3">Excursiones</p>
        <div className="space-y-1">
          {excursiones.map(exc => {
            const nCostos = costos.filter(c => c.excursion_id === exc.id).length
            return (
              <button
                key={exc.id}
                onClick={() => setExcSeleccionada(exc.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors flex items-center justify-between ${
                  excSeleccionada === exc.id ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-400 font-semibold' : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800'
                }`}
              >
                <span className="truncate">{exc.nombre}</span>
                {nCostos > 0 && (
                  <span className="ml-2 text-xs bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 px-2 py-0.5 rounded-full shrink-0">{nCostos}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Costos de la excursión seleccionada */}
      <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-5">
        {!excSeleccionada ? (
          <div className="text-center py-12 text-gray-400 dark:text-zinc-600">
            <p className="text-3xl mb-2">⚙️</p>
            <p className="text-sm">Seleccioná una excursión para ver sus costos</p>
          </div>
        ) : (
          <>
            <p className="font-semibold text-gray-800 dark:text-zinc-200 mb-4">
              {excursiones.find(e => e.id === excSeleccionada)?.nombre}
            </p>

            {/* Costos existentes */}
            {costosDeExcursion.length > 0 ? (
              <div className="space-y-2 mb-5">
                {costosDeExcursion.map(c => (
                  <div key={c.id} className="bg-gray-50 dark:bg-zinc-800/60 rounded-xl px-4 py-3">
                    {editandoId === c.id ? (
                      <FormularioCosto
                        valor={formEdit}
                        onChange={setFormEdit}
                        tramosHelpers={tramosHelpersEditar}
                        guardando={guardandoEdicion}
                        onSubmit={guardarEdicion}
                        onCancelar={cancelarEdicion}
                        textoBoton="Guardar cambios"
                      />
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">{c.concepto}</p>
                          {c.tipo === 'chofer_tramos' ? (
                            <p className="text-xs text-gray-400 dark:text-zinc-600">
                              por chofer — {(c.tramos || []).map(t => `hasta ${t.hasta} pax: ${formatMonto(t.monto, c.moneda)}`).join(' · ')}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-400 dark:text-zinc-600">por persona</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {c.tipo !== 'chofer_tramos' && (
                            <span className="font-bold text-gray-700 dark:text-zinc-300">{formatMonto(c.monto_por_persona, c.moneda)}</span>
                          )}
                          <button onClick={() => iniciarEdicion(c)} className="text-gray-400 dark:text-zinc-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                            <IcoEdit />
                          </button>
                          <button onClick={() => eliminarCosto(c.id)} className="text-gray-300 dark:text-zinc-700 hover:text-red-400 dark:hover:text-red-400 transition-colors">
                            <IcoTrash />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-zinc-600 mb-5">Sin costos cargados todavía.</p>
            )}

            {/* Agregar costo */}
            <div className="border-t border-gray-100 dark:border-zinc-800 pt-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-zinc-500 uppercase tracking-wide mb-3">Agregar costo</p>
              <FormularioCosto
                valor={formCosto}
                onChange={setFormCosto}
                tramosHelpers={tramosHelpersAgregar}
                guardando={guardando}
                onSubmit={agregarCosto}
                textoBoton="Agregar"
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
