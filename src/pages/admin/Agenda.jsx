import { excursiones, reservas, formatPrecio } from '../../data/mockData.js'

// Agrupar reservas confirmadas por fecha
function getEventosPorFecha() {
  const mapa = {}
  reservas.forEach((r) => {
    if (r.estado !== 'cancelada') {
      if (!mapa[r.fecha]) mapa[r.fecha] = []
      mapa[r.fecha].push(r)
    }
  })
  // Agregar fechas de excursiones sin reservas
  excursiones.forEach((ex) => {
    ex.fechas.forEach((f) => {
      if (!mapa[f]) mapa[f] = []
    })
  })
  return mapa
}

export default function Agenda() {
  const eventos = getEventosPorFecha()
  const fechas = Object.keys(eventos).sort()

  // Próximas salidas (todas las fechas de excursiones)
  const salidasProximas = excursiones
    .flatMap((ex) => ex.fechas.map((f) => ({ fecha: f, excursion: ex })))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
        <p className="text-gray-400 text-sm">Próximas salidas y reservas confirmadas</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Próximas salidas */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Próximas salidas</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {salidasProximas.map(({ fecha, excursion }, i) => {
              const reservasEnFecha = reservas.filter((r) => r.fecha === fecha && r.excursionId === excursion.id && r.estado !== 'cancelada')
              const personasReservadas = reservasEnFecha.reduce((s, r) => s + r.personas, 0)
              return (
                <div key={i} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-gray-900 text-sm">{excursion.nombre}</p>
                    <span className="text-xs text-gray-400">
                      {new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>📍 {excursion.destino}</span>
                    <span>·</span>
                    <span>👥 {personasReservadas}/{excursion.cupos} personas</span>
                    {reservasEnFecha.length > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-green-600 font-medium">{reservasEnFecha.length} reserva{reservasEnFecha.length > 1 ? 's' : ''}</span>
                      </>
                    )}
                  </div>
                  {/* Barra de ocupación */}
                  <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-brand-400"
                      style={{ width: `${Math.min(100, (personasReservadas / excursion.cupos) * 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Reservas por fecha */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Reservas confirmadas</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {reservas
              .filter((r) => r.estado === 'confirmada')
              .sort((a, b) => a.fecha.localeCompare(b.fecha))
              .map((r) => (
                <div key={r.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-sm text-gray-900">{r.clienteNombre}</p>
                    <span className="text-xs font-semibold text-brand-700">{formatPrecio(r.total)}</span>
                  </div>
                  <p className="text-xs text-gray-500">{r.excursionNombre}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>📅 {new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span>·</span>
                    <span>👥 {r.personas} persona{r.personas > 1 ? 's' : ''}</span>
                    <a
                      href={`https://wa.me/${r.clienteWhatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-green-500 hover:text-green-600"
                    >
                      💬
                    </a>
                  </div>
                </div>
              ))}

            {reservas.filter((r) => r.estado === 'confirmada').length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p>No hay reservas confirmadas.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
