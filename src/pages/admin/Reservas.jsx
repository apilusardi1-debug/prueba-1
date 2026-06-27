import { useState, useEffect } from 'react'
import { reservasApi, choferesApi, guiasApi, excursionesApi, clientesApi } from '../../lib/supabase.js'
import { sendWhatsApp } from '../../lib/ultramsg.js'

const ESTADOS = {
  pendiente:   { label: 'Pendiente',   color: 'bg-yellow-100 text-yellow-700' },
  confirmada:  { label: 'Confirmada',  color: 'bg-green-100 text-green-700' },
  cancelada:   { label: 'Cancelada',   color: 'bg-red-100 text-red-700' },
}

const FORM_VACIO = {
  cliente_nombre: '', cliente_whatsapp: '', cliente_id: null,
  excursion_id: '', fecha: '', adultos: 1, menores: 0,
  hospedaje: '', ubicacion: '', total: '', moneda: 'BRL', estado: 'pendiente', notas: '',
}

export default function Reservas() {
  const [reservas, setReservas] = useState([])
  const [choferes, setChoferes] = useState([])
  const [guias, setGuias] = useState([])
  const [excursiones, setExcursiones] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [enviando, setEnviando] = useState({})
  const [modalNueva, setModalNueva] = useState(false)

  useEffect(() => {
    async function cargar() {
      try {
        const [{ data: r }, { data: c }, { data: g }, { data: e }] = await Promise.all([
          reservasApi.getAll(),
          choferesApi.getAll(),
          guiasApi.getAll(),
          excursionesApi.getAll(),
        ])
        if (e) setExcursiones(e)
        if (r) setReservas(r)
        if (c) setChoferes(c)
        if (g) setGuias(g)
      } catch (_) {}
      setLoading(false)
    }
    cargar()
  }, [])

  async function cambiarEstado(id, estado) {
    setReservas(prev => prev.map(r => r.id === id ? { ...r, estado } : r))
    await reservasApi.updateEstado(id, estado)
  }

  async function asignar(reserva, campo, valor) {
    const update = { [campo]: valor || null }
    setReservas(prev => prev.map(r => r.id === reserva.id ? { ...r, ...update } : r))

    const { data } = await reservasApi.updateAsignacion(reserva.id, update)
    if (!data) return

    const esChofer = campo === 'chofer_id'
    const persona = esChofer ? data.choferes : data.guias
    if (!persona?.whatsapp || !valor) return

    setEnviando(prev => ({ ...prev, [reserva.id + campo]: true }))

    const personas = (reserva.adultos || 0) + (reserva.menores || 0)
    const fecha = reserva.fecha
      ? new Date(reserva.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
      : '–'

    const rol = esChofer ? 'chofer' : 'guía'
    const mensaje = `Hola ${persona.nombre}! Quedaste asignado/a como ${rol} para la excursión *${data.excursiones?.nombre || '–'}* el ${fecha}. Clientes: ${personas} persona${personas !== 1 ? 's' : ''}. Pickup: ${reserva.ubicacion || '–'}. Cualquier duda escribinos.`

    await sendWhatsApp(persona.whatsapp, mensaje)
    setEnviando(prev => ({ ...prev, [reserva.id + campo]: false }))
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
      const { data: full } = await reservasApi.getAll()
      if (full) setReservas(full)
      setModalNueva(false)
    }
  }

  const filtradas = reservas.filter(r => !filtroEstado || r.estado === filtroEstado)

  if (loading) return <div className="p-8 text-gray-400">Cargando reservas...</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
          <p className="text-gray-400 text-sm">{reservas.length} reservas en total</p>
        </div>
        <button
          onClick={() => setModalNueva(true)}
          className="flex items-center gap-2 text-sm font-semibold text-white bg-[#002147] rounded-xl px-4 py-2 hover:bg-[#003366] transition-colors shadow-sm"
        >
          <span className="text-base leading-none">+</span> Nueva reserva
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Pendientes', value: reservas.filter(r => r.estado === 'pendiente').length, color: 'text-yellow-600' },
          { label: 'Confirmadas', value: reservas.filter(r => r.estado === 'confirmada').length, color: 'text-green-600' },
          { label: 'Canceladas', value: reservas.filter(r => r.estado === 'cancelada').length, color: 'text-red-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setFiltroEstado('')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!filtroEstado ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
          Todas
        </button>
        {Object.entries(ESTADOS).map(([k, v]) => (
          <button key={k} onClick={() => setFiltroEstado(k)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filtroEstado === k ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
            {v.label}
          </button>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p>No hay reservas{filtroEstado ? ' con este estado' : ''}. Aparecerán cuando alguien reserve desde la app.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">Cliente</th>
                <th className="px-5 py-3 text-left">Excursión</th>
                <th className="px-5 py-3 text-left">Fecha</th>
                <th className="px-5 py-3 text-left">Personas</th>
                <th className="px-5 py-3 text-left">Pickup</th>
                <th className="px-5 py-3 text-left">Chofer</th>
                <th className="px-5 py-3 text-left">Guía</th>
                <th className="px-5 py-3 text-left">Estado</th>
                <th className="px-5 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtradas.map(r => {
                const estado = ESTADOS[r.estado] || ESTADOS.pendiente
                const personas = (r.adultos || 0) + (r.menores || 0)
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900 text-sm">{r.cliente_nombre || '–'}</p>
                      <a href={`https://wa.me/${r.cliente_whatsapp}`} target="_blank" rel="noopener noreferrer"
                        className="text-green-600 hover:underline text-xs">
                        💬 {r.cliente_whatsapp}
                      </a>
                    </td>
                    <td className="px-5 py-3 text-gray-700 max-w-[180px]">
                      <p className="truncate">{r.excursiones?.nombre || '–'}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {r.fecha ? new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : '–'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 text-xs">
                      {r.adultos > 0 && <span>👤 {r.adultos} ad.</span>}
                      {r.menores > 0 && <span className="ml-1">👶 {r.menores} men.</span>}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs max-w-[140px]">
                      <p className="truncate">{r.ubicacion || '–'}</p>
                    </td>

                    {/* Chofer */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <select
                          value={r.chofer_id || ''}
                          onChange={e => asignar(r, 'chofer_id', e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-gray-300 max-w-[120px]"
                        >
                          <option value="">— Sin asignar</option>
                          {choferes.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))}
                        </select>
                        {enviando[r.id + 'chofer_id'] && <span className="text-xs text-gray-400">...</span>}
                      </div>
                    </td>

                    {/* Guía */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <select
                          value={r.guia_id || ''}
                          onChange={e => asignar(r, 'guia_id', e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-gray-300 max-w-[120px]"
                        >
                          <option value="">— Sin asignar</option>
                          {guias.map(g => (
                            <option key={g.id} value={g.id}>{g.nombre}</option>
                          ))}
                        </select>
                        {enviando[r.id + 'guia_id'] && <span className="text-xs text-gray-400">...</span>}
                      </div>
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
                      <a href={`https://wa.me/${r.cliente_whatsapp}?text=Hola!%20Te%20contactamos%20por%20tu%20reserva%20de%20${encodeURIComponent(r.excursiones?.nombre || '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-green-500 hover:text-green-600 text-lg">
                        💬
                      </a>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCerrar}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="font-bold text-gray-900 text-base">Nueva reserva</h2>
          <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg">×</button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* Cliente */}
          <div className="relative">
            <label className="text-xs font-medium text-gray-500 block mb-1">Cliente <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={busqCliente}
              onChange={e => buscarCliente(e.target.value)}
              placeholder="Buscar cliente existente o escribir nombre..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
            />
            {sugerencias.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                {sugerencias.map(c => (
                  <button key={c.id} type="button" onClick={() => seleccionarCliente(c)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-800">{c.nombre}</span>
                    <span className="text-xs text-gray-400 font-mono">{c.whatsapp}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">WhatsApp del cliente</label>
            <input type="text" value={form.cliente_whatsapp}
              onChange={e => set('cliente_whatsapp', e.target.value)}
              placeholder="5491155554444"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
            />
          </div>

          {/* Excursión y Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Excursión <span className="text-red-400">*</span></label>
              <select value={form.excursion_id} onChange={e => set('excursion_id', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]">
                <option value="">— Seleccionar</option>
                {excursiones.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Fecha <span className="text-red-400">*</span></label>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
              />
            </div>
          </div>

          {/* Personas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Adultos</label>
              <input type="number" min="0" value={form.adultos} onChange={e => set('adultos', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Menores</label>
              <input type="number" min="0" value={form.menores} onChange={e => set('menores', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
              />
            </div>
          </div>

          {/* Hospedaje */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Hospedaje / Pickup</label>
            <input type="text" value={form.hospedaje} onChange={e => { set('hospedaje', e.target.value); set('ubicacion', e.target.value) }}
              placeholder="Hotel, dirección de pickup..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
            />
          </div>

          {/* Total y Moneda */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Total</label>
              <input type="number" min="0" value={form.total} onChange={e => set('total', e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Moneda</label>
              <select value={form.moneda} onChange={e => set('moneda', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]">
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
          </div>

          {/* Estado */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Estado</label>
            <select value={form.estado} onChange={e => set('estado', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147]">
              <option value="pendiente">Pendiente</option>
              <option value="confirmada">Confirmada</option>
            </select>
          </div>

          {/* Notas */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Notas internas</label>
            <textarea rows={2} value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Observaciones, pedidos especiales..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 focus:border-[#002147] resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button type="submit" disabled={guardando}
            className="w-full bg-[#002147] hover:bg-[#003366] disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors">
            {guardando ? 'Guardando...' : 'Crear reserva'}
          </button>
        </form>
      </div>
    </div>
  )
}
