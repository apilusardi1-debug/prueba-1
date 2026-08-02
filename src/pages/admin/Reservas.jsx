import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { reservasApi, excursionesApi, clientesApi } from '../../lib/supabase.js'
import { formatPrecio } from '../../data/mockData.js'
import ModalRegistrarPago from '../../components/ui/ModalRegistrarPago.jsx'

const ESTADOS = {
  pendiente:   { label: 'Pendiente',   color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400' },
  confirmada:  { label: 'Confirmada',  color: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' },
  completada:  { label: 'Completada',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' },
  cancelada:   { label: 'Cancelada',   color: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' },
}

const FORM_VACIO = {
  cliente_nombre: '', cliente_whatsapp: '', cliente_id: null,
  excursion_id: '', fecha: '', adultos: 1, menores: 0,
  hospedaje: '', ubicacion: '', total: '', moneda: 'BRL', estado: 'pendiente', notas: '',
}

export default function Reservas() {
  const navigate = useNavigate()
  const [reservas, setReservas] = useState([])
  const [excursiones, setExcursiones] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [modalNueva, setModalNueva] = useState(false)
  const [eliminandoId, setEliminandoId] = useState(null)
  const [seleccionadas, setSeleccionadas] = useState(new Set())
  const [pagandoReserva, setPagandoReserva] = useState(null)

  useEffect(() => {
    async function cargar() {
      try {
        const [{ data: r }, { data: e }] = await Promise.all([
          reservasApi.getAll(),
          excursionesApi.getAll(),
        ])
        if (e) setExcursiones(e)

        if (r) {
          const hoy = new Date().toISOString().split('T')[0]
          const vencidas = r.filter(x => x.estado === 'confirmada' && x.fecha < hoy)
          if (vencidas.length > 0) {
            await Promise.all(vencidas.map(x => reservasApi.updateEstado(x.id, 'completada')))
            const idsVencidas = new Set(vencidas.map(x => x.id))
            setReservas(r.map(x => idsVencidas.has(x.id) ? { ...x, estado: 'completada' } : x))
          } else {
            setReservas(r)
          }
        }
      } catch (_) {}
      setLoading(false)
    }
    cargar()
  }, [])

  async function cambiarEstado(id, estado) {
    setReservas(prev => prev.map(r => r.id === id ? { ...r, estado } : r))
    await reservasApi.updateEstado(id, estado)
  }


  async function eliminarReserva(id) {
    await reservasApi.delete(id)
    setReservas(prev => prev.filter(r => r.id !== id))
    setEliminandoId(null)
  }

  function toggleSeleccion(id) {
    setSeleccionadas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSeleccionTodas() {
    setSeleccionadas(prev =>
      prev.size === filtradas.length ? new Set() : new Set(filtradas.map(r => r.id))
    )
  }

  async function eliminarSeleccionadas() {
    const cantidad = seleccionadas.size
    if (!confirm(`¿Eliminar ${cantidad} reserva${cantidad !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`)) return
    const ids = [...seleccionadas]
    await Promise.all(ids.map(id => reservasApi.delete(id)))
    setReservas(prev => prev.filter(r => !seleccionadas.has(r.id)))
    setSeleccionadas(new Set())
  }

  async function cambiarEstadoSeleccionadas(estado) {
    const ids = [...seleccionadas]
    setReservas(prev => prev.map(r => seleccionadas.has(r.id) ? { ...r, estado } : r))
    setSeleccionadas(new Set())
    await Promise.all(ids.map(id => reservasApi.updateEstado(id, estado)))
  }

  async function crearReserva(form) {
    const personas = (parseInt(form.adultos) || 0) + (parseInt(form.menores) || 0)
    const { data } = await reservasApi.create({
      cliente_nombre: form.cliente_nombre,
      cliente_whatsapp: form.cliente_whatsapp.replace(/\D/g, ''),
      cliente_id: form.cliente_id || null,
      excursion_id: form.excursion_id || null,
      fecha: form.fecha || null,
      adultos: parseInt(form.adultos) || 0,
      menores: parseInt(form.menores) || 0,
      personas,
      hospedaje: form.hospedaje || null,
      ubicacion: form.ubicacion || null,
      total: parseInt(form.total) || null,
      moneda: form.moneda,
      estado: form.estado,
      notas: form.notas || null,
    })
    if (data) {
      navigate(`/admin/agenda?fecha=${form.fecha}`)
    }
  }

  // Por defecto ("Todas") se ocultan las completadas para que la vista de
  // trabajo diario no se llene de viajes ya terminados — siguen accesibles
  // enteras con el filtro "Completada" o en el perfil del cliente.
  const filtradas = reservas.filter(r => filtroEstado ? r.estado === filtroEstado : r.estado !== 'completada')

  if (loading) return <div className="p-8 text-gray-400 dark:text-zinc-500">Cargando reservas...</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Reservas</h1>
          <p className="text-gray-400 dark:text-zinc-500 text-sm">{reservas.length} reservas en total</p>
        </div>
        <button
          onClick={() => setModalNueva(true)}
          className="flex items-center gap-2 text-sm font-semibold text-white dark:text-zinc-900 bg-[#002147] dark:bg-zinc-100 rounded-xl px-4 py-2 hover:bg-[#003366] dark:hover:bg-zinc-200 transition-colors shadow-sm"
        >
          <span className="text-base leading-none">+</span> Nueva reserva
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Pendientes', value: reservas.filter(r => r.estado === 'pendiente').length, color: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Confirmadas', value: reservas.filter(r => r.estado === 'confirmada').length, color: 'text-green-600 dark:text-green-400' },
          { label: 'Completadas', value: reservas.filter(r => r.estado === 'completada').length, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Canceladas', value: reservas.filter(r => r.estado === 'cancelada').length, color: 'text-red-500 dark:text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-gray-100 dark:border-zinc-800 shadow-sm dark:shadow-black/20">
            <p className="text-xs text-gray-400 dark:text-zinc-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setFiltroEstado('')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!filtroEstado ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400'}`}>
          Todas
        </button>
        {Object.entries(ESTADOS).map(([k, v]) => (
          <button key={k} onClick={() => setFiltroEstado(k)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filtroEstado === k ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400'}`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Barra de acciones en lote */}
      {seleccionadas.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-5 bg-brand-50 dark:bg-brand-950/40 border border-brand-100 dark:border-brand-900 rounded-xl px-4 py-2.5">
          <span className="text-sm font-medium text-brand-700 dark:text-brand-400">
            {seleccionadas.size} seleccionada{seleccionadas.size !== 1 ? 's' : ''}
          </span>
          <div className="flex-1" />
          <span className="text-xs text-gray-500 dark:text-zinc-400">Cambiar estado:</span>
          <div className="flex gap-1.5">
            {Object.entries(ESTADOS).map(([k, v]) => (
              <button key={k} onClick={() => cambiarEstadoSeleccionadas(k)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors hover:opacity-80 ${v.color}`}>
                {v.label}
              </button>
            ))}
          </div>
          <button onClick={eliminarSeleccionadas}
            className="text-xs font-semibold text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-2 py-1">
            Eliminar
          </button>
          <button onClick={() => setSeleccionadas(new Set())}
            className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 px-2 py-1">
            Cancelar
          </button>
        </div>
      )}

      {filtradas.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-zinc-500">
          <p className="text-4xl mb-3">📋</p>
          <p>No hay reservas{filtroEstado ? ' con este estado' : ''}. Aparecerán cuando alguien reserve desde la app.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-800/60 text-gray-500 dark:text-zinc-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left w-8">
                  <input
                    type="checkbox"
                    checked={filtradas.length > 0 && seleccionadas.size === filtradas.length}
                    onChange={toggleSeleccionTodas}
                    className="rounded border-gray-300 dark:border-zinc-600 dark:bg-zinc-800 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                </th>
                <th className="px-5 py-3 text-left">Cliente</th>
                <th className="px-5 py-3 text-left">Excursión</th>
                <th className="px-5 py-3 text-left">Fecha</th>
                <th className="px-5 py-3 text-left">Personas</th>
                <th className="px-5 py-3 text-left">Total</th>
                <th className="px-5 py-3 text-left">Pagado</th>
                <th className="px-5 py-3 text-left">Saldo</th>
                <th className="px-5 py-3 text-left">Estado</th>
                <th className="px-5 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
              {filtradas.map(r => {
                const estado = ESTADOS[r.estado] || ESTADOS.pendiente
                const personas = (r.adultos || 0) + (r.menores || 0)
                return (
                  <tr key={r.id} className={`hover:bg-gray-50 dark:hover:bg-zinc-800/50 ${seleccionadas.has(r.id) ? 'bg-brand-50 dark:bg-brand-950/20' : ''}`}>
                    <td className="px-5 py-3">
                      <input
                        type="checkbox"
                        checked={seleccionadas.has(r.id)}
                        onChange={() => toggleSeleccion(r.id)}
                        className="rounded border-gray-300 dark:border-zinc-600 dark:bg-zinc-800 text-brand-600 focus:ring-brand-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900 dark:text-zinc-100 text-sm">{r.cliente_nombre || '–'}</p>
                      <a href={`https://wa.me/${r.cliente_whatsapp}`} target="_blank" rel="noopener noreferrer"
                        className="text-green-600 dark:text-green-400 hover:underline text-xs">
                        💬 {r.cliente_whatsapp}
                      </a>
                    </td>
                    <td className="px-5 py-3 text-gray-700 dark:text-zinc-300 max-w-[180px]">
                      <p className="truncate">{r.excursiones?.nombre || '–'}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-zinc-400 text-xs whitespace-nowrap">
                      {r.fecha ? new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : '–'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-zinc-400 text-xs">
                      {r.adultos > 0 && <span>👤 {r.adultos} ad.</span>}
                      {r.menores > 0 && <span className="ml-1">👶 {r.menores} men.</span>}
                    </td>
                    <td className="px-5 py-3 text-gray-700 dark:text-zinc-300 text-xs whitespace-nowrap">
                      {formatPrecio(r.total, r.moneda)}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      <p className="text-gray-700 dark:text-zinc-300 font-medium">{formatPrecio(r.pagado || 0, r.moneda)}</p>
                      {Math.max((r.total || 0) - (r.pagado || 0), 0) > 0 && (
                        <button onClick={() => setPagandoReserva(r)} className="text-brand-600 dark:text-brand-400 hover:underline text-[11px] font-medium">
                          Registrar pago
                        </button>
                      )}
                    </td>
                    <td className={`px-5 py-3 text-xs font-medium whitespace-nowrap ${(r.total - (r.pagado || 0)) > 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {formatPrecio(Math.max((r.total || 0) - (r.pagado || 0), 0), r.moneda)}
                    </td>
                    <td className="px-5 py-3">
                      <select value={r.estado} onChange={e => cambiarEstado(r.id, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 outline-none cursor-pointer ${estado.color}`}>
                        {Object.entries(ESTADOS).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <a href={`https://wa.me/${r.cliente_whatsapp}?text=Hola!%20Te%20contactamos%20por%20tu%20reserva%20de%20${encodeURIComponent(r.excursiones?.nombre || '')}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-green-500 dark:text-green-400 hover:text-green-600 dark:hover:text-green-300 text-lg">
                          💬
                        </a>
                        {eliminandoId === r.id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-400 dark:text-zinc-500">¿Eliminar?</span>
                            <button onClick={() => eliminarReserva(r.id)} className="text-xs font-semibold text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">Sí</button>
                            <button onClick={() => setEliminandoId(null)} className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300">No</button>
                          </div>
                        ) : (
                          <button onClick={() => setEliminandoId(r.id)} className="text-gray-300 dark:text-zinc-600 hover:text-red-400 dark:hover:text-red-400 transition-colors" title="Eliminar reserva">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalNueva && (
        <ModalNuevaReserva
          excursiones={excursiones}
          onGuardar={crearReserva}
          onCerrar={() => setModalNueva(false)}
        />
      )}

      {pagandoReserva && (
        <ModalRegistrarPago
          reserva={pagandoReserva}
          clienteId={pagandoReserva.cliente_id}
          clienteNombre={pagandoReserva.cliente_nombre}
          onCerrar={() => setPagandoReserva(null)}
          onGuardado={(nuevoPagado) => {
            setReservas(prev => prev.map(r => r.id === pagandoReserva.id ? { ...r, pagado: nuevoPagado } : r))
            setPagandoReserva(null)
          }}
        />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   MODAL NUEVA RESERVA
══════════════════════════════════════════════════════════ */
function ModalNuevaReserva({ excursiones, onGuardar, onCerrar }) {
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [busqCliente, setBusqCliente] = useState('')
  const [clientes, setClientes] = useState([])
  const [sugerencias, setSugerencias] = useState([])

  useEffect(() => {
    clientesApi.getAll().then(({ data }) => setClientes(data || []))
  }, [])

  function set(key, val) { setForm(p => ({ ...p, [key]: val })) }

  function buscarCliente(texto) {
    setBusqCliente(texto)
    set('cliente_nombre', texto)
    if (texto.length < 2) return setSugerencias([])
    const lower = texto.toLowerCase()
    setSugerencias(clientes.filter(c =>
      c.nombre?.toLowerCase().includes(lower) || c.whatsapp?.includes(texto)
    ).slice(0, 5))
  }

  function seleccionarCliente(c) {
    setForm(p => ({ ...p, cliente_nombre: c.nombre, cliente_whatsapp: c.whatsapp || '', cliente_id: c.id }))
    setBusqCliente(c.nombre)
    setSugerencias([])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.cliente_nombre.trim()) return setError('El nombre del cliente es obligatorio')
    if (!form.excursion_id) return setError('Seleccioná una excursión')
    if (!form.fecha) return setError('La fecha es obligatoria')
    setError('')
    setGuardando(true)
    await onGuardar(form)
    setGuardando(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl dark:shadow-black/60 w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

        <div className="px-6 py-5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between flex-shrink-0">
          <h2 className="font-bold text-gray-900 dark:text-zinc-100 text-base">Nueva reserva</h2>
          <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 dark:text-zinc-500 text-lg">×</button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* Cliente */}
          <div className="relative">
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Cliente <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={busqCliente}
              onChange={e => buscarCliente(e.target.value)}
              placeholder="Buscar cliente existente o escribir nombre..."
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
            />
            {sugerencias.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg dark:shadow-black/40 mt-1 overflow-hidden">
                {sugerencias.map(c => (
                  <button key={c.id} type="button" onClick={() => seleccionarCliente(c)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-800 dark:text-zinc-200">{c.nombre}</span>
                    <span className="text-xs text-gray-400 dark:text-zinc-500 font-mono">{c.whatsapp}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">WhatsApp del cliente</label>
            <input type="text" value={form.cliente_whatsapp}
              onChange={e => set('cliente_whatsapp', e.target.value)}
              placeholder="5491155554444"
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
            />
          </div>

          {/* Excursión y Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Excursión <span className="text-red-400">*</span></label>
              <select value={form.excursion_id} onChange={e => set('excursion_id', e.target.value)}
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]">
                <option value="">— Seleccionar</option>
                {excursiones.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Fecha <span className="text-red-400">*</span></label>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)}
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
              />
            </div>
          </div>

          {/* Personas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Adultos</label>
              <input type="number" min="0" value={form.adultos} onChange={e => set('adultos', e.target.value)}
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Menores</label>
              <input type="number" min="0" value={form.menores} onChange={e => set('menores', e.target.value)}
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
              />
            </div>
          </div>

          {/* Hospedaje */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Hospedaje / Pickup</label>
            <input type="text" value={form.hospedaje} onChange={e => { set('hospedaje', e.target.value); set('ubicacion', e.target.value) }}
              placeholder="Hotel, dirección de pickup..."
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
            />
          </div>

          {/* Total y Moneda */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Total</label>
              <input type="number" min="0" value={form.total} onChange={e => set('total', e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Moneda</label>
              <select value={form.moneda} onChange={e => set('moneda', e.target.value)}
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]">
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
          </div>

          {/* Estado */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Estado</label>
            <select value={form.estado} onChange={e => set('estado', e.target.value)}
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]">
              <option value="pendiente">Pendiente</option>
              <option value="confirmada">Confirmada</option>
            </select>
          </div>

          {/* Notas */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Notas internas</label>
            <textarea rows={2} value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Observaciones, pedidos especiales..."
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147] resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

          <button type="submit" disabled={guardando}
            className="w-full bg-[#002147] dark:bg-zinc-100 hover:bg-[#003366] dark:hover:bg-zinc-200 disabled:opacity-50 text-white dark:text-zinc-900 font-semibold text-sm py-2.5 rounded-xl transition-colors">
            {guardando ? 'Guardando...' : 'Crear reserva'}
          </button>
        </form>
      </div>
    </div>
  )
}
