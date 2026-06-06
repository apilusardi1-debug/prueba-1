import { useState } from 'react'
import { reservas, excursiones, estadosReserva, formatPrecio } from '../../data/mockData.js'

export default function MisReservas() {
  const [whatsapp, setWhatsapp] = useState('')
  const [buscado, setBuscado] = useState(false)
  const [resultados, setResultados] = useState([])

  function buscar(e) {
    e.preventDefault()
    const encontradas = reservas.filter((r) => r.clienteWhatsapp === whatsapp.replace(/\D/g, ''))
    setResultados(encontradas)
    setBuscado(true)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-2">Mis reservas</h1>
      <p className="text-gray-500 mb-8 text-sm">Ingresá tu número de WhatsApp para ver el estado de tus reservas.</p>

      <form onSubmit={buscar} className="flex gap-3 mb-8">
        <input
          type="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="Ej: 1145678901"
          className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors">
          Buscar
        </button>
      </form>

      {buscado && resultados.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p>No encontramos reservas para ese número.</p>
          <p className="text-xs mt-2">¿Necesitás ayuda? <a href="https://wa.me/5491100000000" className="text-brand-600 hover:underline">Contactanos</a></p>
        </div>
      )}

      {resultados.length > 0 && (
        <div className="space-y-4">
          {resultados.map((r) => {
            const estado = estadosReserva[r.estado]
            const ex = excursiones.find((e) => e.id === r.excursionId)
            return (
              <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900">{r.excursionNombre}</p>
                    <p className="text-sm text-gray-400">
                      {new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {' · '}{r.personas} persona{r.personas > 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${estado.color}`}>
                    {estado.label}
                  </span>
                </div>
                {ex && (
                  <img src={ex.imagen} alt={ex.nombre} className="w-full h-32 object-cover rounded-xl mb-3" />
                )}
                <div className="flex justify-between text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Pagado</p>
                    <p className="font-semibold text-green-600">{formatPrecio(r.pagado)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Total</p>
                    <p className="font-semibold text-gray-800">{formatPrecio(r.total)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
