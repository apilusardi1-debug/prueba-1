import { useState } from 'react'
import { reservas as initialReservas, estadosReserva, formatPrecio } from '../../data/mockData.js'

export default function Reservas() {
  const [reservas, setReservas] = useState(initialReservas)
  const [filtroEstado, setFiltroEstado] = useState('')

  const filtradas = reservas.filter((r) => !filtroEstado || r.estado === filtroEstado)

  function cambiarEstado(id, estado) {
    setReservas((prev) => prev.map((r) => r.id === id ? { ...r, estado } : r))
  }

  const totalConfirmado = reservas.filter((r) => r.estado === 'confirmada').reduce((s, r) => s + r.total, 0)
  const totalCobrado = reservas.filter((r) => r.estado === 'confirmada').reduce((s, r) => s + r.pagado, 0)

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
        <p className="text-gray-400 text-sm">{reservas.length} reservas en total</p>
      </div>

      {/* Resumen financiero */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">Total confirmadas</p>
          <p className="text-xl font-bold text-gray-900">{formatPrecio(totalConfirmado)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">Cobrado</p>
          <p className="text-xl font-bold text-green-600">{formatPrecio(totalCobrado)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">Pendiente de cobro</p>
          <p className="text-xl font-bold text-yellow-600">{formatPrecio(totalConfirmado - totalCobrado)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setFiltroEstado('')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!filtroEstado ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
        >
          Todas
        </button>
        {Object.entries(estadosReserva).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setFiltroEstado(k)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filtroEstado === k ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3 text-left">Cliente</th>
              <th className="px-5 py-3 text-left">Excursión</th>
              <th className="px-5 py-3 text-left">Fecha</th>
              <th className="px-5 py-3 text-left">Personas</th>
              <th className="px-5 py-3 text-left">Total</th>
              <th className="px-5 py-3 text-left">Cobrado</th>
              <th className="px-5 py-3 text-left">Estado</th>
              <th className="px-5 py-3 text-left"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtradas.map((r) => {
              const estado = estadosReserva[r.estado]
              const saldo = r.total - r.pagado
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{r.clienteNombre}</p>
                    <a href={`https://wa.me/${r.clienteWhatsapp}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-green-600 hover:underline">
                      💬 {r.clienteWhatsapp}
                    </a>
                  </td>
                  <td className="px-5 py-3 text-gray-700 max-w-[180px] truncate">{r.excursionNombre}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3 text-center text-gray-700">{r.personas}</td>
                  <td className="px-5 py-3 font-semibold text-gray-800">{formatPrecio(r.total)}</td>
                  <td className="px-5 py-3">
                    <span className="text-green-600 font-semibold">{formatPrecio(r.pagado)}</span>
                    {saldo > 0 && <p className="text-xs text-red-400">Debe: {formatPrecio(saldo)}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={r.estado}
                      onChange={(e) => cambiarEstado(r.id, e.target.value)}
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 outline-none cursor-pointer ${estado.color}`}
                    >
                      {Object.entries(estadosReserva).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <a
                      href={`https://wa.me/${r.clienteWhatsapp}?text=Hola%20${encodeURIComponent(r.clienteNombre)}!%20Te%20escribimos%20por%20tu%20reserva%20de%20${encodeURIComponent(r.excursionNombre)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-500 hover:text-green-600 text-lg"
                    >
                      💬
                    </a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filtradas.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-3xl mb-2">📋</p>
            <p>No hay reservas con este filtro.</p>
          </div>
        )}
      </div>
    </div>
  )
}
