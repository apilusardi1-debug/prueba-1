import { useState, useEffect } from 'react'
import { propuestasApi, clientesApi } from '../../../lib/supabase.js'

function formatPrecio(n, moneda = 'BRL') {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moneda }).format(n || 0)
}

const COLUMNAS = ['enviada', 'cerrada', 'rechazada']
const ESTADOS = {
  enviada: { label: 'Enviada', color: 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400' },
  cerrada: { label: 'Cerrada', color: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400' },
  rechazada: { label: 'Rechazada', color: 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400' },
}

export default function ClientesPaquetes() {
  const [propuestas, setPropuestas] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [vista, setVista] = useState('lista')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [seleccionada, setSeleccionada] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await propuestasApi.getAll()
    setPropuestas(data || [])
    setLoading(false)
  }

  const filtradas = propuestas.filter(p =>
    !busqueda || p.cliente_nombre?.toLowerCase().includes(busqueda.toLowerCase())
  )

  function abrir(p) {
    setSeleccionada(p)
    setEditForm({
      cliente_nombre: p.cliente_nombre || '',
      cliente_whatsapp: p.cliente_whatsapp || '',
      hospedajes: p.hospedajes || '',
      fecha_ida: p.fecha_ida || '',
      fecha_vuelta: p.fecha_vuelta || '',
      total: String(p.total || 0),
      sena: String(p.sena || 0),
      estado: p.estado || 'enviada',
      notas: p.notas || '',
    })
  }

  async function guardarEdicion() {
    if (!editForm.cliente_nombre.trim()) return
    setGuardando(true)
    const { data } = await propuestasApi.update(seleccionada.id, {
      cliente_nombre: editForm.cliente_nombre.trim(),
      cliente_whatsapp: editForm.cliente_whatsapp.trim() || null,
      hospedajes: editForm.hospedajes.trim() || null,
      fecha_ida: editForm.fecha_ida || null,
      fecha_vuelta: editForm.fecha_vuelta || null,
      total: parseFloat(editForm.total) || 0,
      sena: parseFloat(editForm.sena) || 0,
      estado: editForm.estado,
      notas: editForm.notas.trim() || null,
      cerrada_at: editForm.estado === 'enviada' ? null : (seleccionada.cerrada_at || new Date().toISOString()),
    })
    if (data) {
      setPropuestas(prev => prev.map(p => p.id === data.id ? data : p))
      setSeleccionada(data)
    }
    setGuardando(false)
  }

  async function cambiarEstadoDrag(id, estado) {
    const actual = propuestas.find(p => p.id === id)
    if (!actual || actual.estado === estado) return
    setPropuestas(prev => prev.map(p => p.id === id ? { ...p, estado } : p))
    await propuestasApi.actualizarEstado(id, estado)
  }

  if (loading) return <div className="p-8 text-gray-400 dark:text-zinc-500">Cargando...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">Clientes de paquetes</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Pipeline completo — enviadas, cerradas y rechazadas</p>
        </div>
        <div className="flex items-center gap-2">
          {['lista', 'bloques'].map(v => (
            <button key={v} onClick={() => setVista(v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${vista === v ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400'}`}>
              {v}
            </button>
          ))}
          <button
            onClick={() => setModalAbierto(true)}
            className="bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            + Agregar cliente
          </button>
        </div>
      </div>

      <input
        type="text"
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        placeholder="Buscar cliente..."
        className="w-full max-w-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
      />

      {filtradas.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-zinc-500 text-sm">
          Todavía no hay clientes cargados. Generá una propuesta o agregá uno manualmente.
        </div>
      ) : vista === 'lista' ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-800/60 text-gray-500 dark:text-zinc-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">Cliente</th>
                <th className="px-5 py-3 text-left">Hospedaje / Paquete</th>
                <th className="px-5 py-3 text-left">Total</th>
                <th className="px-5 py-3 text-left">Estado</th>
                <th className="px-5 py-3 text-left">Fecha de envío</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
              {filtradas.map(p => {
                const estado = ESTADOS[p.estado] || ESTADOS.enviada
                return (
                  <tr key={p.id} onClick={() => abrir(p)} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 cursor-pointer">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900 dark:text-zinc-100">{p.cliente_nombre}</p>
                      {p.cliente_whatsapp && (
                        <a href={`https://wa.me/${p.cliente_whatsapp}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                          className="text-xs text-green-600 dark:text-green-400 hover:underline">💬 {p.cliente_whatsapp}</a>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-zinc-300 max-w-[220px]">
                      <p className="truncate">{p.hospedajes || (p.items || []).map(it => it.nombre).join(', ') || '—'}</p>
                    </td>
                    <td className="px-5 py-3 font-semibold text-gray-900 dark:text-zinc-100 whitespace-nowrap">{formatPrecio(p.total, p.moneda)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${estado.color}`}>{estado.label}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400 dark:text-zinc-500 whitespace-nowrap">
                      {new Date(p.created_at).toLocaleDateString('es-AR')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNAS.map(col => {
            const enCol = filtradas.filter(p => p.estado === col)
            const { label, color } = ESTADOS[col]
            return (
              <ColumnaBloque
                key={col}
                estado={col}
                label={label}
                color={color}
                propuestas={enCol}
                onDrop={cambiarEstadoDrag}
                onAbrir={abrir}
              />
            )
          })}
        </div>
      )}

      {modalAbierto && (
        <ModalAgregarCliente
          onCerrar={() => setModalAbierto(false)}
          onGuardado={() => { setModalAbierto(false); cargar() }}
        />
      )}

      {seleccionada && editForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
          <div className="bg-white dark:bg-zinc-900 w-96 h-full shadow-xl dark:shadow-black/40 flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
              <h2 className="font-bold text-lg text-gray-900 dark:text-zinc-100">Propuesta</h2>
              <button onClick={() => setSeleccionada(null)} className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 text-xl">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <p className="text-xs text-gray-400 dark:text-zinc-500">
                Fecha de envío de propuesta: <span className="font-medium text-gray-600 dark:text-zinc-300">{new Date(seleccionada.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </p>

              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Cliente</label>
                <input type="text" value={editForm.cliente_nombre} onChange={e => setEditForm(p => ({ ...p, cliente_nombre: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">WhatsApp</label>
                <input type="text" value={editForm.cliente_whatsapp} onChange={e => setEditForm(p => ({ ...p, cliente_whatsapp: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Hospedajes</label>
                <input type="text" value={editForm.hospedajes} onChange={e => setEditForm(p => ({ ...p, hospedajes: e.target.value }))}
                  placeholder="Ej: Vivá Porto - Enotel"
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Fecha ida</label>
                  <input type="date" value={editForm.fecha_ida} onChange={e => setEditForm(p => ({ ...p, fecha_ida: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Fecha vuelta</label>
                  <input type="date" value={editForm.fecha_vuelta} onChange={e => setEditForm(p => ({ ...p, fecha_vuelta: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Valor total (R$)</label>
                  <input type="number" value={editForm.total} onChange={e => setEditForm(p => ({ ...p, total: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Seña (R$)</label>
                  <input type="number" value={editForm.sena} onChange={e => setEditForm(p => ({ ...p, sena: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-zinc-800/60 rounded-xl px-3 py-2.5 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">Restante</span>
                <span className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                  {formatPrecio(Math.max((parseFloat(editForm.total) || 0) - (parseFloat(editForm.sena) || 0), 0))}
                </span>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Estado</label>
                <select value={editForm.estado} onChange={e => setEditForm(p => ({ ...p, estado: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Notas</label>
                <textarea rows={3} value={editForm.notas} onChange={e => setEditForm(p => ({ ...p, notas: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                />
              </div>

              <button
                onClick={guardarEdicion}
                disabled={guardando}
                className="w-full bg-gray-900 dark:bg-zinc-100 hover:bg-gray-700 dark:hover:bg-zinc-300 disabled:opacity-50 text-white dark:text-zinc-900 font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ColumnaBloque({ estado, label, color, propuestas, onDrop, onAbrir }) {
  const [sobre, setSobre] = useState(false)

  return (
    <div
      className={`bg-gray-100 dark:bg-zinc-800 rounded-2xl p-3 transition-shadow ${sobre ? 'ring-2 ring-brand-400' : ''}`}
      onDragOver={e => { e.preventDefault(); setSobre(true) }}
      onDragLeave={() => setSobre(false)}
      onDrop={e => {
        e.preventDefault()
        setSobre(false)
        const id = e.dataTransfer.getData('text/plain')
        if (id) onDrop(id, estado)
      }}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${color}`}>{label}</span>
        <span className="text-xs text-gray-400 dark:text-zinc-500 font-medium">{propuestas.length}</span>
      </div>
      <div className="space-y-2 min-h-[60px]">
        {propuestas.map(p => (
          <TarjetaPropuesta key={p.id} p={p} onAbrir={onAbrir} />
        ))}
      </div>
    </div>
  )
}

function fechaCorta(f) {
  if (!f) return '—'
  return new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function TarjetaPropuesta({ p, onAbrir }) {
  const [expandido, setExpandido] = useState(false)
  const restante = Math.max((p.total || 0) - (p.sena || 0), 0)

  return (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData('text/plain', p.id)}
      className="bg-white dark:bg-zinc-900 rounded-xl p-3 shadow-sm dark:shadow-black/20 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <div onClick={() => onAbrir(p)} className="cursor-pointer">
        <p className="font-semibold text-sm text-gray-900 dark:text-zinc-100">{p.cliente_nombre}</p>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5 truncate">
          {p.hospedajes || (p.items || []).map(it => it.nombre).join(', ') || '—'}
        </p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">{formatPrecio(p.total, p.moneda)}</span>
          <span className="text-xs text-gray-400 dark:text-zinc-500">
            {new Date(p.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
          </span>
        </div>
      </div>

      <button
        onClick={e => { e.stopPropagation(); setExpandido(v => !v) }}
        className="w-full flex items-center justify-center mt-2 pt-2 border-t border-gray-100 dark:border-zinc-800 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
      >
        <svg className={`w-4 h-4 transition-transform duration-200 ${expandido ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {expandido && (
        <div className="mt-1 pt-2 space-y-1 text-xs text-gray-500 dark:text-zinc-400" onClick={e => e.stopPropagation()}>
          <p>🏨 <span className="font-medium text-gray-700 dark:text-zinc-300">{p.hospedajes || '—'}</span></p>
          <p>✈️ Vuelos: {fechaCorta(p.fecha_ida)} → {fechaCorta(p.fecha_vuelta)}</p>
          <p>Saldo total: <span className="font-medium text-gray-700 dark:text-zinc-300">{formatPrecio(p.total, p.moneda)}</span> — Señado: <span className="font-medium text-gray-700 dark:text-zinc-300">{formatPrecio(p.sena, p.moneda)}</span></p>
          <p className="font-semibold text-brand-700 dark:text-brand-400">Restante: {formatPrecio(restante, p.moneda)}</p>
        </div>
      )}
    </div>
  )
}

function ModalAgregarCliente({ onCerrar, onGuardado }) {
  const [busqCliente, setBusqCliente] = useState('')
  const [clientes, setClientes] = useState([])
  const [sugerencias, setSugerencias] = useState([])
  const [clienteSel, setClienteSel] = useState(null)
  const [whatsapp, setWhatsapp] = useState('')
  const [hospedajes, setHospedajes] = useState('')
  const [fechaIda, setFechaIda] = useState('')
  const [fechaVuelta, setFechaVuelta] = useState('')
  const [total, setTotal] = useState('')
  const [sena, setSena] = useState('')
  const [estado, setEstado] = useState('enviada')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    clientesApi.getAll().then(({ data }) => setClientes(data || []))
  }, [])

  function buscarCliente(texto) {
    setBusqCliente(texto)
    setClienteSel(null)
    if (texto.length < 2) return setSugerencias([])
    const lower = texto.toLowerCase()
    setSugerencias(clientes.filter(c => c.nombre?.toLowerCase().includes(lower) || c.whatsapp?.includes(texto)).slice(0, 5))
  }

  function elegirCliente(c) {
    setClienteSel(c)
    setBusqCliente(c.nombre)
    setWhatsapp(c.whatsapp || '')
    setSugerencias([])
  }

  async function guardar() {
    if (!busqCliente.trim()) return setError('Ingresá el nombre del cliente.')
    setError('')
    setGuardando(true)
    try {
      await propuestasApi.create({
        cliente_id: clienteSel?.id || null,
        cliente_nombre: busqCliente.trim(),
        cliente_whatsapp: whatsapp.trim() || null,
        hospedajes: hospedajes.trim() || null,
        fecha_ida: fechaIda || null,
        fecha_vuelta: fechaVuelta || null,
        items: [],
        total: parseFloat(total) || 0,
        sena: parseFloat(sena) || 0,
        moneda: 'BRL',
        estado,
        notas: notas.trim() || null,
        cerrada_at: estado !== 'enviada' ? new Date().toISOString() : null,
      })
      onGuardado()
    } catch (e) {
      setError('Error al guardar: ' + (e.message || 'intentá de nuevo'))
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl dark:shadow-black/60 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 dark:text-zinc-100 text-base">Agregar cliente</h2>
          <button onClick={onCerrar} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 dark:text-zinc-500 text-lg">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-lg">{error}</p>}

          <div className="relative">
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Cliente *</label>
            <input
              type="text"
              value={busqCliente}
              onChange={e => buscarCliente(e.target.value)}
              placeholder="Buscar cliente existente o escribir nombre..."
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            {sugerencias.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg dark:shadow-black/40 mt-1 overflow-hidden">
                {sugerencias.map(c => (
                  <button key={c.id} type="button" onClick={() => elegirCliente(c)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-800 dark:text-zinc-200">{c.nombre}</span>
                    <span className="text-xs text-gray-400 dark:text-zinc-500 font-mono">{c.whatsapp}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">WhatsApp</label>
            <input type="text" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
              placeholder="5581999999999"
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Hospedajes</label>
            <input type="text" value={hospedajes} onChange={e => setHospedajes(e.target.value)}
              placeholder="Ej: Vivá Porto - Enotel"
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Fecha ida</label>
              <input type="date" value={fechaIda} onChange={e => setFechaIda(e.target.value)}
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Fecha vuelta</label>
              <input type="date" value={fechaVuelta} onChange={e => setFechaVuelta(e.target.value)}
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Valor total (R$)</label>
              <input type="number" value={total} onChange={e => setTotal(e.target.value)}
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Seña (R$)</label>
              <input type="number" value={sena} onChange={e => setSena(e.target.value)}
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Estado</label>
            <select value={estado} onChange={e => setEstado(e.target.value)}
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="enviada">Enviada</option>
              <option value="cerrada">Cerrada</option>
              <option value="rechazada">Rechazada</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1">Notas (opcional)</label>
            <textarea rows={2} value={notas} onChange={e => setNotas(e.target.value)}
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            />
          </div>
        </div>

        <div className="px-6 py-5 border-t border-gray-100 dark:border-zinc-800 flex gap-3">
          <button onClick={onCerrar} className="flex-1 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando} className="flex-1 bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
