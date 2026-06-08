import { useState, useEffect } from 'react'
import { excursiones, reservas, formatPrecio } from '../../data/mockData.js'
import { choferesApi } from '../../lib/supabase.js'

function SeccionChoferes() {
  const [choferes, setChoferes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [asignaciones, setAsignaciones] = useState({})

  useEffect(() => {
    choferesApi.getAll().then(({ data, error }) => {
      if (!error) setChoferes((data || []).filter((c) => c.activo))
      setCargando(false)
    })
  }, [])

  const reservasConfirmadas = reservas.filter((r) => r.estado === 'confirmada')

  const asignar = (reservaId, choferId) =>
    setAsignaciones((prev) => ({ ...prev, [reservaId]: choferId }))

  const choferesAsignados = choferes.filter((c) =>
    reservasConfirmadas.some((r) => asignaciones[r.id] === c.id)
  )

  const cerrarOperacion = () => {
    if (choferesAsignados.length === 0) return alert('Primero asigná al menos un chofer.')
    choferesAsignados.forEach((chofer, i) => {
      const susReservas = reservasConfirmadas.filter((r) => asignaciones[r.id] === chofer.id)
      const lineas = susReservas.map((r) =>
        `• *${r.clienteNombre}*\n  👥 ${r.personas} persona${r.personas > 1 ? 's' : ''}\n  📞 ${r.clienteWhatsapp}\n  🗺 ${r.excursionNombre}\n  📅 ${new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}`
      ).join('\n\n')
      const mensaje = `Hola ${chofer.nombre} 👋\n\nTe enviamos los pasajeros asignados para mañana:\n\n${lineas}\n\n¡Muchas gracias!`
      setTimeout(() => {
        window.open(`https://wa.me/${chofer.whatsapp}?text=${encodeURIComponent(mensaje)}`, '_blank')
      }, i * 600)
    })
  }

  const totalAsignadas = reservasConfirmadas.filter((r) => asignaciones[r.id]).length
  const totalSinAsignar = reservasConfirmadas.length - totalAsignadas

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mt-6">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-800">Asignación de choferes</h2>
          <p className="text-xs text-gray-400 mt-0.5">Asigná un chofer a cada reserva y cerrá la operación de una vez</p>
        </div>
        {totalSinAsignar > 0 && (
          <span className="text-xs bg-yellow-100 text-yellow-700 font-medium px-2.5 py-1 rounded-full">
            {totalSinAsignar} sin asignar
          </span>
        )}
        {totalSinAsignar === 0 && totalAsignadas > 0 && (
          <span className="text-xs bg-green-100 text-green-700 font-medium px-2.5 py-1 rounded-full">
            Todas asignadas ✓
          </span>
        )}
      </div>

      {cargando ? (
        <div className="text-center py-8 text-gray-400 text-sm">Cargando choferes...</div>
      ) : choferes.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          No hay choferes activos. <a href="/admin/equipo" className="text-brand-600 underline">Agregar en Equipo →</a>
        </div>
      ) : reservasConfirmadas.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">No hay reservas confirmadas.</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {reservasConfirmadas.map((r) => {
            const choferAsignado = choferes.find((c) => c.id === asignaciones[r.id])
            return (
              <div key={r.id} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-900">{r.clienteNombre}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    👥 {r.personas} persona{r.personas > 1 ? 's' : ''} · 📞 {r.clienteWhatsapp}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">🗺 {r.excursionNombre} · 📅 {new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</p>
                </div>
                <div className="flex items-center gap-2">
                  {choferAsignado && (
                    <span className="text-xs bg-green-50 text-green-700 font-medium px-2 py-1 rounded-lg">✓ {choferAsignado.nombre}</span>
                  )}
                  <select
                    value={asignaciones[r.id] || ''}
                    onChange={(e) => asignar(r.id, e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:border-brand-400"
                  >
                    <option value="">— Sin chofer —</option>
                    {choferes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {choferes.length > 0 && reservasConfirmadas.length > 0 && (
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {choferesAsignados.length} chofer{choferesAsignados.length !== 1 ? 'es' : ''} · {totalAsignadas} reserva{totalAsignadas !== 1 ? 's' : ''} asignada{totalAsignadas !== 1 ? 's' : ''}
          </p>
          <button
            onClick={cerrarOperacion}
            disabled={choferesAsignados.length === 0}
            className={`flex items-center gap-2 text-sm px-5 py-2.5 rounded-xl font-semibold transition-colors ${
              choferesAsignados.length > 0
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            🚀 Cerrar operación — enviar {choferesAsignados.length} mensaje{choferesAsignados.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  )
}

function formatFecha(fecha) {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatFechaCorta(fecha) {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export default function Agenda() {
  const [filtroDia, setFiltroDia] = useState('')
  const [filtroPaseo, setFiltroPaseo] = useState('')
  const [colapsados, setColapsados] = useState({})

  // Armar lista de todas las salidas con sus reservas
  const todasLasSalidas = excursiones.flatMap((ex) =>
    ex.fechas.map((f) => {
      const reservasEnFecha = reservas.filter(
        (r) => r.fecha === f && r.excursionId === ex.id && r.estado !== 'cancelada'
      )
      return { fecha: f, excursion: ex, reservas: reservasEnFecha }
    })
  )

  // Opciones para el filtro de paseo
  const opcionesPaseos = [...new Set(excursiones.map((e) => e.nombre))].sort()

  // Opciones para el filtro de día
  const opcionesDias = [...new Set(todasLasSalidas.map((s) => s.fecha))].sort()

  // Filtrar
  const salidasFiltradas = todasLasSalidas
    .filter((s) => !filtroDia || s.fecha === filtroDia)
    .filter((s) => !filtroPaseo || s.excursion.nombre === filtroPaseo)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  // Agrupar por fecha
  const porFecha = salidasFiltradas.reduce((acc, s) => {
    if (!acc[s.fecha]) acc[s.fecha] = []
    acc[s.fecha].push(s)
    return acc
  }, {})

  const fechas = Object.keys(porFecha).sort()

  function toggleColapsado(fecha) {
    setColapsados((prev) => ({ ...prev, [fecha]: !prev[fecha] }))
  }

  function limpiarFiltros() {
    setFiltroDia('')
    setFiltroPaseo('')
  }

  const hayFiltros = filtroDia || filtroPaseo

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
        <p className="text-gray-400 text-sm">Próximas salidas y reservas confirmadas</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">📅 Día:</span>
          <select
            value={filtroDia}
            onChange={(e) => setFiltroDia(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:border-brand-400"
          >
            <option value="">Todos los días</option>
            {opcionesDias.map((d) => (
              <option key={d} value={d}>{formatFechaCorta(d)} — {d}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">🗺 Paseo:</span>
          <select
            value={filtroPaseo}
            onChange={(e) => setFiltroPaseo(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:border-brand-400"
          >
            <option value="">Todos los paseos</option>
            {opcionesPaseos.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {hayFiltros && (
          <button onClick={limpiarFiltros} className="text-xs text-brand-600 hover:text-brand-800 font-medium underline">
            Limpiar filtros
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400">
          {salidasFiltradas.length} salida{salidasFiltradas.length !== 1 ? 's' : ''} encontrada{salidasFiltradas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Resultados agrupados por fecha */}
      {fechas.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📅</p>
          <p>No hay salidas para los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {fechas.map((fecha) => {
            const salidas = porFecha[fecha]
            const totalPersonas = salidas.reduce((s, sal) => s + sal.reservas.reduce((a, r) => a + r.personas, 0), 0)
            const totalReservas = salidas.reduce((s, sal) => s + sal.reservas.length, 0)
            const abierto = !colapsados[fecha]

            return (
              <div key={fecha} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Cabecera de fecha — clic para colapsar */}
                <button
                  onClick={() => toggleColapsado(fecha)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{abierto ? '▾' : '▸'}</span>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900 text-sm capitalize">{formatFecha(fecha)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {salidas.length} paseo{salidas.length !== 1 ? 's' : ''} · {totalReservas} reserva{totalReservas !== 1 ? 's' : ''} · {totalPersonas} persona{totalPersonas !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </button>

                {/* Detalle de salidas del día */}
                {abierto && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {salidas.map((s) => {
                      const personasReservadas = s.reservas.reduce((a, r) => a + r.personas, 0)
                      const pct = Math.min(100, (personasReservadas / s.excursion.cupos) * 100)
                      return (
                        <div key={s.excursion.id} className="px-5 py-4">
                          {/* Info del paseo */}
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="font-medium text-gray-900 text-sm">🗺 {s.excursion.nombre}</p>
                              <p className="text-xs text-gray-400 mt-0.5">📍 {s.excursion.destino} · ⏱ {s.excursion.duracion}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold text-brand-700">{personasReservadas}/{s.excursion.cupos} personas</p>
                              <div className="mt-1 w-24 bg-gray-100 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${pct >= 80 ? 'bg-red-400' : pct >= 50 ? 'bg-yellow-400' : 'bg-green-400'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Lista de pasajeros del paseo */}
                          {s.reservas.length > 0 ? (
                            <div className="space-y-2">
                              {s.reservas.map((r) => (
                                <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                                  <div>
                                    <p className="text-sm font-medium text-gray-800">{r.clienteNombre}</p>
                                    <p className="text-xs text-gray-400">👥 {r.personas} persona{r.personas > 1 ? 's' : ''}</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs font-semibold text-brand-700">{formatPrecio(r.total)}</span>
                                    <a href={`https://wa.me/${r.clienteWhatsapp}`} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:text-green-600">💬</a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic">Sin reservas confirmadas para este paseo.</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <SeccionChoferes />

    </div>
  )
}
