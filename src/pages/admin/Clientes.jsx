import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  clientesApi, reservasClienteApi, pagosApi,
  actividadApi, notasClienteApi, excursionesApi, reservasApi,
} from '../../lib/supabase.js'
import ModalRegistrarPago from '../../components/ui/ModalRegistrarPago.jsx'

/* ─── helpers ─── */
function iniciales(nombre = '') {
  return nombre.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}
function fmtFecha(f) {
  if (!f) return '—'
  return new Date(f).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtMonto(n, moneda = 'BRL') {
  if (n == null) return '—'
  return `${moneda} ${Number(n).toLocaleString('es-AR')}`
}

/* ─── colores estado reserva ─── */
const ESTADO_RESERVA = {
  pendiente:   'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-900',
  confirmada:  'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900',
  completada:  'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900',
  cancelada:   'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
}

/* ─── iconos de actividad ─── */
const ACTIVIDAD_ICON = {
  lead_recibido:        { icon: '🎯', color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' },
  lead_convertido:      { icon: '✅', color: 'bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400' },
  reserva_creada:       { icon: '📋', color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' },
  reserva_confirmada:   { icon: '✔️', color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' },
  pago_registrado:      { icon: '💳', color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' },
  excursion_completada: { icon: '🗺️', color: 'bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400' },
  mensaje_enviado:      { icon: '💬', color: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400' },
  nota_agregada:        { icon: '📝', color: 'bg-gray-50 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400' },
  reserva_cancelada:    { icon: '❌', color: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400' },
}

/* ════════════════════════════════════════════════
   LISTA DE CLIENTES
   ════════════════════════════════════════════════ */
const FORM_VACIO = { nombre: '', whatsapp: '', email: '', pais: '', ciudad: '', cantidad_pasajeros: '' }

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [perfil, setPerfil] = useState(null)
  const [modalNuevo, setModalNuevo] = useState(false)
  const [eliminandoId, setEliminandoId] = useState(null)

  useEffect(() => {
    clientesApi.getAll().then(({ data }) => {
      setClientes(data || [])
      setCargando(false)
    })
  }, [])

  const filtrados = clientes.filter(c =>
    [c.nombre, c.email, c.whatsapp, c.pais, c.ciudad]
      .filter(Boolean).some(v => v.toLowerCase().includes(busqueda.toLowerCase()))
  )

  async function crearCliente(datos) {
    const { data } = await clientesApi.create(datos)
    if (data) {
      setClientes(prev => [data, ...prev])
      setModalNuevo(false)
    }
  }

  async function eliminarCliente(id) {
    await clientesApi.delete(id)
    setClientes(prev => prev.filter(c => c.id !== id))
    setEliminandoId(null)
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Clientes</h1>
          <p className="text-gray-400 dark:text-zinc-600 text-sm">{clientes.length} clientes registrados</p>
        </div>
        <button
          onClick={() => setModalNuevo(true)}
          className="flex items-center gap-2 text-sm font-semibold text-white bg-[#002147] dark:bg-zinc-100 dark:text-zinc-900 rounded-xl px-4 py-2 hover:bg-[#003366] dark:hover:bg-zinc-200 transition-colors shadow-sm"
        >
          <span className="text-base leading-none">+</span> Nuevo cliente
        </button>
      </div>

      {/* Buscador */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Buscar por nombre, email, WhatsApp o país..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full max-w-md border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        {cargando ? (
          <div className="text-center py-16 text-gray-400 dark:text-zinc-600 text-sm">Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-zinc-600">
            <p className="text-4xl mb-2">👥</p>
            <p className="text-sm">No hay clientes que coincidan.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-800/60 text-gray-400 dark:text-zinc-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">Cliente</th>
                <th className="px-5 py-3 text-left">WhatsApp</th>
                <th className="px-5 py-3 text-left">País</th>
                <th className="px-5 py-3 text-left">Pasajeros</th>
                <th className="px-5 py-3 text-left">Reservas</th>
                <th className="px-5 py-3 text-left">Total gastado</th>
                <th className="px-5 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
              {filtrados.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-950/40 border border-brand-100 dark:border-brand-900 flex items-center justify-center text-brand-600 dark:text-brand-400 text-xs font-bold flex-shrink-0">
                        {iniciales(c.nombre)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-zinc-100">{c.nombre}</p>
                        {c.email && <p className="text-xs text-gray-400 dark:text-zinc-600">{c.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500 dark:text-zinc-500 text-xs font-mono">{c.whatsapp}</td>
                  <td className="px-5 py-3 text-gray-500 dark:text-zinc-500 text-xs">{c.pais || '—'}{c.ciudad ? `, ${c.ciudad}` : ''}</td>
                  <td className="px-5 py-3 text-gray-600 dark:text-zinc-400 text-xs">{c.cantidad_pasajeros || '—'}</td>
                  <td className="px-5 py-3">
                    <span className="font-semibold text-gray-800 dark:text-zinc-200">{c.cantidad_reservas || 0}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-semibold text-brand-600 dark:text-brand-400">
                      {c.total_gastado > 0 ? fmtMonto(c.total_gastado) : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setPerfil(c)}
                        className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 transition-colors"
                      >
                        Ver perfil →
                      </button>
                      {eliminandoId === c.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-400 dark:text-zinc-600">¿Eliminar?</span>
                          <button onClick={() => eliminarCliente(c.id)} className="text-xs font-semibold text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">Sí</button>
                          <button onClick={() => setEliminandoId(null)} className="text-xs text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-300">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setEliminandoId(c.id)} className="text-gray-300 dark:text-zinc-700 hover:text-red-400 dark:hover:text-red-400 transition-colors" title="Eliminar cliente">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Perfil */}
      {perfil && (
        <PerfilCliente
          cliente={perfil}
          onCerrar={() => setPerfil(null)}
          onUpdate={c => {
            setClientes(prev => prev.map(x => x.id === c.id ? c : x))
            setPerfil(c)
          }}
        />
      )}

      {/* Modal nuevo cliente */}
      {modalNuevo && (
        <ModalNuevoCliente
          onGuardar={crearCliente}
          onCerrar={() => setModalNuevo(false)}
        />
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════
   MODAL NUEVO CLIENTE
   ════════════════════════════════════════════════ */
function ModalNuevoCliente({ onGuardar, onCerrar }) {
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function set(key, val) { setForm(p => ({ ...p, [key]: val })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre.trim()) return setError('El nombre es obligatorio')
    if (!form.whatsapp.trim()) return setError('El WhatsApp es obligatorio')
    setError('')
    setGuardando(true)
    await onGuardar({
      ...form,
      whatsapp: form.whatsapp.replace(/\D/g, ''),
      cantidad_pasajeros: form.cantidad_pasajeros ? parseInt(form.cantidad_pasajeros) : null,
    })
    setGuardando(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCerrar}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl dark:shadow-black/60 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 dark:text-zinc-100 text-base">Nuevo cliente</h2>
          <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 dark:text-zinc-500 text-lg transition-colors">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {[
            { key: 'nombre',   label: 'Nombre completo', placeholder: 'Juan García', required: true },
            { key: 'whatsapp', label: 'WhatsApp',         placeholder: '5491155554444', required: true },
            { key: 'email',    label: 'Email',            placeholder: 'juan@email.com' },
            { key: 'pais',     label: 'País',             placeholder: 'Argentina' },
            { key: 'ciudad',   label: 'Ciudad',           placeholder: 'Buenos Aires' },
            { key: 'cantidad_pasajeros', label: 'Cantidad de pasajeros', placeholder: '2', type: 'number' },
          ].map(({ key, label, placeholder, required, type }) => (
            <div key={key}>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">
                {label}{required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              <input
                type={type || 'text'}
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
              />
            </div>
          ))}
          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={guardando}
            className="w-full bg-[#002147] dark:bg-zinc-100 dark:text-zinc-900 hover:bg-[#003366] dark:hover:bg-zinc-200 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
          >
            {guardando ? 'Guardando...' : 'Crear cliente'}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════
   PERFIL COMPLETO DEL CLIENTE
   ════════════════════════════════════════════════ */
function PerfilCliente({ cliente, onCerrar, onUpdate }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState('reservas')
  const [reservas, setReservas] = useState([])
  const [pagos, setPagos] = useState([])
  const [actividad, setActividad] = useState([])
  const [notas, setNotas] = useState([])
  const [nuevaNota, setNuevaNota] = useState('')
  const [cargando, setCargando] = useState(true)
  const [pagandoReserva, setPagandoReserva] = useState(null)
  const [editando, setEditando] = useState(false)
  const [modalReserva, setModalReserva] = useState(false)
  const [form, setForm] = useState({
    nombre: cliente.nombre || '',
    email: cliente.email || '',
    pais: cliente.pais || '',
    ciudad: cliente.ciudad || '',
    whatsapp: cliente.whatsapp || '',
    notas: cliente.notas || '',
    cantidad_pasajeros: cliente.cantidad_pasajeros ?? '',
  })

  useEffect(() => {
    setCargando(true)
    Promise.all([
      reservasClienteApi.getByCliente(cliente.id, cliente.whatsapp),
      pagosApi.getByCliente(cliente.id),
      actividadApi.getByCliente(cliente.id),
      notasClienteApi.getByCliente(cliente.id),
    ]).then(([r, p, a, n]) => {
      setReservas(r?.data || [])
      setPagos(p?.data || [])
      setActividad(a?.data || [])
      setNotas(n?.data || [])
      setCargando(false)
    })
  }, [cliente.id])

  async function crearReserva(form) {
    const personas = (parseInt(form.adultos) || 0) + (parseInt(form.menores) || 0)
    await reservasApi.create({
      cliente_nombre: cliente.nombre,
      cliente_whatsapp: (cliente.whatsapp || '').replace(/\D/g, ''),
      cliente_id: cliente.id,
      excursion_id: form.excursion_id || null,
      fecha: form.fecha || null,
      adultos: parseInt(form.adultos) || 0,
      menores: parseInt(form.menores) || 0,
      personas,
      hospedaje: form.hospedaje || null,
      ubicacion: form.hospedaje || null,
      total: parseInt(form.total) || null,
      moneda: form.moneda,
      estado: form.estado,
      notas: form.notas || null,
    })
    if (form.fecha) {
      navigate(`/admin/agenda?fecha=${form.fecha}`)
    } else {
      const { data } = await reservasClienteApi.getByCliente(cliente.id, cliente.whatsapp)
      if (data) setReservas(data)
      setModalReserva(false)
    }
  }

  async function guardarPerfil() {
    const payload = { ...form, cantidad_pasajeros: form.cantidad_pasajeros ? parseInt(form.cantidad_pasajeros) : null }
    const { data } = await clientesApi.update(cliente.id, payload)
    if (data) { onUpdate(data); setEditando(false) }
  }

  async function agregarNota() {
    if (!nuevaNota.trim()) return
    const { data } = await notasClienteApi.create({ cliente_id: cliente.id, contenido: nuevaNota, autor: 'Admin' })
    if (data) { setNotas(prev => [data, ...prev]); setNuevaNota('') }
  }

  async function borrarNota(id) {
    await notasClienteApi.delete(id)
    setNotas(prev => prev.filter(n => n.id !== id))
  }

  const totalPagado = pagos.filter(p => p.estado === 'confirmado').reduce((s, p) => s + Number(p.monto), 0)
  const excursionesCompletadas = reservas.filter(r => r.estado === 'completada').length

  const TABS = [
    { id: 'reservas',  label: 'Reservas',  count: reservas.length },
    { id: 'pagos',     label: 'Pagos',     count: pagos.length },
    { id: 'actividad', label: 'Actividad', count: actividad.length },
    { id: 'notas',     label: 'Notas',     count: notas.length },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-stretch" onClick={onCerrar}>
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative ml-auto w-full max-w-2xl bg-white dark:bg-zinc-900 h-full flex flex-col shadow-2xl dark:shadow-black/60"
        onClick={e => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-900/50 flex items-center justify-center text-brand-700 dark:text-brand-400 text-lg font-bold flex-shrink-0">
                {iniciales(cliente.nombre)}
              </div>
              <div>
                <h2 className="font-bold text-gray-900 dark:text-zinc-100 text-lg leading-tight">{cliente.nombre}</h2>
                <p className="text-sm text-gray-400 dark:text-zinc-600 mt-0.5">
                  {[cliente.pais, cliente.ciudad].filter(Boolean).join(', ') || 'Sin ubicación'}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  {cliente.whatsapp && (
                    <button
                      onClick={() => { onCerrar(); navigate(`/admin/crm/whatsapp?phone=${cliente.whatsapp}`) }}
                      className="text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium flex items-center gap-1"
                    >
                      💬 {cliente.whatsapp}
                    </button>
                  )}
                  {cliente.email && <span className="text-xs text-gray-400 dark:text-zinc-600">{cliente.email}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setEditando(!editando)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                {editando ? 'Cancelar' : '✏️ Editar'}
              </button>
              <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 dark:text-zinc-500 text-lg transition-colors">×</button>
            </div>
          </div>

          {/* Editar datos */}
          {editando && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { key: 'nombre', label: 'Nombre', col: 2 },
                { key: 'email', label: 'Email', col: 2 },
                { key: 'whatsapp', label: 'WhatsApp' },
                { key: 'pais', label: 'País' },
                { key: 'ciudad', label: 'Ciudad' },
                { key: 'cantidad_pasajeros', label: 'Cantidad de pasajeros', type: 'number' },
              ].map(({ key, label, col, type }) => (
                <div key={key} className={col === 2 ? 'col-span-2' : ''}>
                  <label className="text-xs text-gray-500 dark:text-zinc-400 block mb-1">{label}</label>
                  <input
                    type={type || 'text'}
                    value={form[key]}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              ))}
              <div className="col-span-2">
                <button
                  onClick={guardarPerfil}
                  className="w-full bg-brand-500 dark:bg-brand-600 hover:bg-brand-600 dark:hover:bg-brand-700 text-white font-semibold text-sm py-2 rounded-xl transition-colors"
                >
                  Guardar cambios
                </button>
              </div>
            </div>
          )}

          {/* Stats */}
          {!editando && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { label: 'Reservas', value: reservas.length, color: 'text-brand-600 dark:text-brand-400' },
                { label: 'Completadas', value: excursionesCompletadas, color: 'text-green-600 dark:text-green-400' },
                { label: 'Total pagado', value: totalPagado > 0 ? fmtMonto(totalPagado) : '—', color: 'text-amber-600 dark:text-amber-400' },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 dark:bg-zinc-800/60 rounded-xl px-4 py-3 text-center">
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-100 dark:border-zinc-800 flex-shrink-0 px-6">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.id
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-300'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-600'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Contenido ── */}
        <div className="flex-1 overflow-y-auto">
          {cargando ? (
            <div className="text-center py-12 text-gray-400 dark:text-zinc-600 text-sm">Cargando...</div>
          ) : (
            <>
              {/* RESERVAS */}
              {tab === 'reservas' && (
                <div className="divide-y divide-gray-50 dark:divide-zinc-800">
                  <div className="px-6 py-3 flex justify-end">
                    <button
                      onClick={() => setModalReserva(true)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#002147] dark:bg-zinc-100 dark:text-zinc-900 hover:bg-[#003366] dark:hover:bg-zinc-200 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      <span className="text-sm leading-none">+</span> Nueva reserva
                    </button>
                  </div>
                  {reservas.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 dark:text-zinc-600">
                      <p className="text-3xl mb-2">📋</p>
                      <p className="text-sm">Sin reservas registradas</p>
                    </div>
                  ) : reservas.map(r => {
                    const saldo = Math.max((r.total || 0) - (r.pagado || 0), 0)
                    return (
                    <div key={r.id} className="px-6 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 dark:text-zinc-100 text-sm">
                            {r.excursiones?.nombre || 'Excursión'}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5">
                            📅 {fmtFecha(r.fecha)} · 👥 {r.personas} {r.personas === 1 ? 'persona' : 'personas'}
                          </p>
                          {r.hospedaje && <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5">🏨 {r.hospedaje}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full border capitalize ${ESTADO_RESERVA[r.estado] || 'bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 border-gray-100 dark:border-zinc-700'}`}>
                            {r.estado}
                          </span>
                          <p className="text-sm font-bold text-gray-800 dark:text-zinc-200 mt-1">
                            {r.total ? fmtMonto(r.total, r.moneda) : '—'}
                          </p>
                        </div>
                      </div>
                      {r.total > 0 && (
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50 dark:border-zinc-800">
                          <p className="text-xs text-gray-400 dark:text-zinc-600">
                            {saldo > 0 ? <>Saldo pendiente: <span className="font-semibold text-amber-600 dark:text-amber-400">{fmtMonto(saldo, 'BRL')}</span></> : <span className="text-green-600 dark:text-green-400 font-semibold">Pagado por completo</span>}
                          </p>
                          {saldo > 0 && (
                            <button
                              onClick={() => setPagandoReserva(r)}
                              className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300"
                            >
                              Registrar pago
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              )}

              {/* PAGOS */}
              {tab === 'pagos' && (
                <div className="divide-y divide-gray-50 dark:divide-zinc-800">
                  {pagos.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 dark:text-zinc-600">
                      <p className="text-3xl mb-2">💳</p>
                      <p className="text-sm">Sin pagos registrados</p>
                    </div>
                  ) : pagos.map(p => (
                    <div key={p.id} className="px-6 py-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-zinc-100 text-sm">{fmtMonto(p.monto, p.moneda)}</p>
                        <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5">
                          {p.metodo} · {fmtFecha(p.fecha_pago || p.created_at)}
                        </p>
                        {p.notas && <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5">{p.notas}</p>}
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        p.estado === 'confirmado' ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400'
                      }`}>
                        {p.estado}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* ACTIVIDAD */}
              {tab === 'actividad' && (
                <div className="px-6 py-4">
                  {actividad.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 dark:text-zinc-600">
                      <p className="text-3xl mb-2">📜</p>
                      <p className="text-sm">Sin actividad registrada aún</p>
                    </div>
                  ) : (
                    <div className="relative pl-6">
                      <div className="absolute left-2 top-0 bottom-0 w-px bg-gray-100 dark:bg-zinc-800" />
                      <div className="space-y-4">
                        {actividad.map(a => {
                          const cfg = ACTIVIDAD_ICON[a.tipo] || { icon: '•', color: 'bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500' }
                          return (
                            <div key={a.id} className="flex gap-3">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 -ml-3.5 z-10 ${cfg.color}`}>
                                {cfg.icon}
                              </div>
                              <div className="flex-1 pb-4">
                                <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">{a.titulo}</p>
                                {a.descripcion && <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5">{a.descripcion}</p>}
                                <p className="text-xs text-gray-300 dark:text-zinc-700 mt-1">{fmtFecha(a.created_at)}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* NOTAS */}
              {tab === 'notas' && (
                <div className="px-6 py-4">
                  {/* Nueva nota */}
                  <div className="mb-5">
                    <textarea
                      rows={3}
                      value={nuevaNota}
                      onChange={e => setNuevaNota(e.target.value)}
                      placeholder="Agregar nota interna..."
                      className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                    />
                    <button
                      onClick={agregarNota}
                      disabled={!nuevaNota.trim()}
                      className="mt-2 text-sm font-semibold px-4 py-2 bg-brand-500 dark:bg-brand-600 hover:bg-brand-600 dark:hover:bg-brand-700 disabled:opacity-40 text-white rounded-xl transition-colors"
                    >
                      + Agregar nota
                    </button>
                  </div>

                  {/* Lista de notas */}
                  {notas.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-zinc-600 text-center py-4">Sin notas todavía</p>
                  ) : (
                    <div className="space-y-3">
                      {notas.map(n => (
                        <div key={n.id} className="bg-gray-50 dark:bg-zinc-800/60 rounded-xl p-4">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-gray-700 dark:text-zinc-300 flex-1">{n.contenido}</p>
                            <button
                              onClick={() => borrarNota(n.id)}
                              className="text-gray-300 dark:text-zinc-700 hover:text-red-400 dark:hover:text-red-400 text-sm flex-shrink-0 transition-colors"
                            >✕</button>
                          </div>
                          <p className="text-xs text-gray-400 dark:text-zinc-600 mt-2">
                            {n.autor && <span className="font-medium">{n.autor} · </span>}
                            {fmtFecha(n.created_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {modalReserva && (
        <ModalReservaCliente
          cliente={cliente}
          onGuardar={crearReserva}
          onCerrar={() => setModalReserva(false)}
        />
      )}

      {pagandoReserva && (
        <ModalRegistrarPago
          reserva={pagandoReserva}
          clienteId={cliente.id}
          clienteNombre={cliente.nombre}
          onCerrar={() => setPagandoReserva(null)}
          onGuardado={(nuevoPagado) => {
            setReservas(prev => prev.map(r => r.id === pagandoReserva.id ? { ...r, pagado: nuevoPagado } : r))
            setPagandoReserva(null)
            pagosApi.getByCliente(cliente.id).then(({ data }) => setPagos(data || []))
          }}
        />
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════
   MODAL NUEVA RESERVA PARA CLIENTE EXISTENTE
   ════════════════════════════════════════════════ */
const RESERVA_VACIA = { excursion_id: '', fecha: '', adultos: 1, menores: 0, hospedaje: '', total: '', moneda: 'BRL', estado: 'pendiente', notas: '' }

function ModalReservaCliente({ cliente, onGuardar, onCerrar }) {
  const [form, setForm] = useState(RESERVA_VACIA)
  const [excursiones, setExcursiones] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    excursionesApi.getAll().then(({ data }) => setExcursiones(data || []))
  }, [])

  function set(key, val) { setForm(p => ({ ...p, [key]: val })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.excursion_id) return setError('Seleccioná una excursión')
    if (!form.fecha) return setError('La fecha es obligatoria')
    setError('')
    setGuardando(true)
    await onGuardar(form)
    setGuardando(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onCerrar}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl dark:shadow-black/60 w-full max-w-md max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

        <div className="px-6 py-5 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-zinc-100 text-base">Nueva reserva</h2>
              <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5">Cliente: <span className="font-medium text-gray-600 dark:text-zinc-400">{cliente.nombre}</span></p>
            </div>
            <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 dark:text-zinc-500 text-lg">×</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Excursión <span className="text-red-400">*</span></label>
              <select value={form.excursion_id} onChange={e => set('excursion_id', e.target.value)}
                className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]">
                <option value="">— Seleccionar</option>
                {excursiones.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Fecha <span className="text-red-400">*</span></label>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)}
                className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Adultos</label>
              <input type="number" min="0" value={form.adultos} onChange={e => set('adultos', e.target.value)}
                className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Menores</label>
              <input type="number" min="0" value={form.menores} onChange={e => set('menores', e.target.value)}
                className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Hospedaje / Pickup</label>
            <input type="text" value={form.hospedaje} onChange={e => set('hospedaje', e.target.value)}
              placeholder="Hotel, dirección..."
              className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Total</label>
              <input type="number" min="0" value={form.total} onChange={e => set('total', e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Moneda</label>
              <select value={form.moneda} onChange={e => set('moneda', e.target.value)}
                className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]">
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Estado</label>
            <select value={form.estado} onChange={e => set('estado', e.target.value)}
              className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]">
              <option value="pendiente">Pendiente</option>
              <option value="confirmada">Confirmada</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Notas</label>
            <textarea rows={2} value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Observaciones..."
              className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147] resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

          <button type="submit" disabled={guardando}
            className="w-full bg-[#002147] dark:bg-zinc-100 dark:text-zinc-900 hover:bg-[#003366] dark:hover:bg-zinc-200 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors">
            {guardando ? 'Guardando...' : 'Crear reserva'}
          </button>
        </form>
      </div>
    </div>
  )
}
