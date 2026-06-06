import { useState } from 'react'
import { clientes as initialClientes } from '../../data/mockData.js'

const estadoColor = {
  activo:   'bg-green-100 text-green-700',
  vip:      'bg-purple-100 text-purple-700',
  inactivo: 'bg-gray-100 text-gray-500',
}

export default function Clientes() {
  const [clientes, setClientes] = useState(initialClientes)
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState(null)

  const filtrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.email.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.whatsapp.includes(busqueda)
  )

  function guardarNota(id, nota) {
    setClientes((prev) => prev.map((c) => c.id === id ? { ...c, notas: nota } : c))
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-400 text-sm">{clientes.length} clientes registrados</p>
        </div>
      </div>

      {/* Buscador */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Buscar por nombre, email o WhatsApp..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full max-w-md border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3 text-left">Nombre</th>
              <th className="px-5 py-3 text-left">WhatsApp</th>
              <th className="px-5 py-3 text-left">Origen</th>
              <th className="px-5 py-3 text-left">Reservas</th>
              <th className="px-5 py-3 text-left">Estado</th>
              <th className="px-5 py-3 text-left">Última actividad</th>
              <th className="px-5 py-3 text-left"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtrados.map((cliente) => (
              <tr key={cliente.id} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-900">{cliente.nombre}</p>
                  <p className="text-xs text-gray-400">{cliente.email}</p>
                </td>
                <td className="px-5 py-3 text-gray-600">{cliente.whatsapp}</td>
                <td className="px-5 py-3 text-gray-500">{cliente.origen}</td>
                <td className="px-5 py-3">
                  <span className="font-semibold text-brand-700">{cliente.reservas}</span>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${estadoColor[cliente.estado]}`}>
                    {cliente.estado}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-400 text-xs">
                  {new Date(cliente.ultimaActividad).toLocaleDateString('es-AR')}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://wa.me/${cliente.whatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-500 hover:text-green-600"
                    >
                      💬
                    </a>
                    <button
                      onClick={() => setSeleccionado(cliente)}
                      className="text-brand-500 hover:text-brand-700 text-xs font-medium"
                    >
                      Ver
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtrados.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-3xl mb-2">👥</p>
            <p>No hay clientes que coincidan.</p>
          </div>
        )}
      </div>

      {/* Panel lateral */}
      {seleccionado && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setSeleccionado(null)}>
          <div className="bg-white w-96 h-full shadow-xl p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">{seleccionado.nombre}</h2>
              <button onClick={() => setSeleccionado(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="space-y-3 text-sm mb-5">
              <div className="flex justify-between"><span className="text-gray-400">Email</span><span>{seleccionado.email || '–'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">WhatsApp</span><span>{seleccionado.whatsapp}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Origen</span><span>{seleccionado.origen}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Reservas</span><span className="font-semibold text-brand-700">{seleccionado.reservas}</span></div>
              <div className="flex justify-between">
                <span className="text-gray-400">Estado</span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${estadoColor[seleccionado.estado]}`}>
                  {seleccionado.estado}
                </span>
              </div>
            </div>

            <div className="mb-5">
              <p className="text-sm font-medium text-gray-700 mb-1">Notas del cliente</p>
              <textarea
                rows={5}
                defaultValue={seleccionado.notas}
                onBlur={(e) => guardarNota(seleccionado.id, e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                placeholder="Preferencias, historial, observaciones..."
              />
            </div>

            <a
              href={`https://wa.me/${seleccionado.whatsapp}?text=Hola%20${encodeURIComponent(seleccionado.nombre)}!%20Te%20escribimos%20de%20Turismo%20Patagonia`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              💬 Contactar por WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
