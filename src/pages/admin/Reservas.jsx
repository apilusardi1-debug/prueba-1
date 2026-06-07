import { useState, useEffect } from 'react'
import { reservasApi } from '../../lib/supabase.js'

const ESTADOS = {
  pendiente:   { label: 'Pendiente',   color: 'bg-yellow-100 text-yellow-700' },
  confirmada:  { label: 'Confirmada',  color: 'bg-green-100 text-green-700' },
  cancelada:   { label: 'Cancelada',   color: 'bg-red-100 text-red-700' },
}

export default function Reservas() {
  const [reservas, setReservas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')

  useEffect(() => {
    async function cargar() {
      try {
        const { data, error } = await reservasApi.getAll()
        if (!error && data) setReservas(data)
      } catch (_) {}
      setLoading(false)
    }
    cargar()
  }, [])

  async function cambiarEstado(id, estado) {
    setReservas(prev => prev.map(r => r.id === id ? { ...r, estado } : r))
    await reservasApi.updateEstado(id, estado)
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
                <th className="px-5 py-3 text-left">WhatsApp</th>
                <th className="px-5 py-3 text-left">Excursión</th>
                <th className="px-5 py-3 text-left">Fecha</th>
                <th className="px-5 py-3 text-left">Personas</th>
                <th className="px-5 py-3 text-left">Pickup</th>
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
                      <a href={`https://wa.me/${r.cliente_whatsapp}`} target="_blank" rel="noopener noreferrer"
                        className="text-green-600 hover:underline font-medium text-xs">
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
    </div>
  )
}
