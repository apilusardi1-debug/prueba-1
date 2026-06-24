import { useState, useEffect } from 'react'
import { excursiones, reservas, formatPrecio } from '../../data/mockData.js'
import { choferesApi } from '../../lib/supabase.js'
import { sendWhatsApp } from '../../lib/ultramsg.js'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function buildSalidas() {
  return excursiones.flatMap((ex) =>
    ex.fechas.map((f) => ({
      fecha: f,
      excursion: ex,
      reservas: reservas.filter(
        (r) => r.fecha === f && r.excursionId === ex.id && r.estado !== 'cancelada'
      ),
    }))
  )
}

function primerMesConDatos() {
  const fechas = excursiones.flatMap((e) => e.fechas).sort()
  if (!fechas.length) return new Date()
  const [y, m] = fechas[0].split('-').map(Number)
  return new Date(y, m - 1, 1)
}

export default function Agenda() {
  const todasLasSalidas = buildSalidas()
  const [mes, setMes] = useState(primerMesConDatos)
  const [expandidos, setExpandidos] = useState({})
  const [choferes, setChoferes] = useState([])
  const [asignaciones, setAsignaciones] = useState({})

  useEffect(() => {
    choferesApi.getAll().then(({ data, error }) => {
      if (!error) setChoferes((data || []).filter((c) => c.activo))
    })
  }, [])

  const anio = mes.getFullYear()
  const numMes = mes.getMonth()
  const primerDia = new Date(anio, numMes, 1).getDay()
  const diasEnMes = new Date(anio, numMes + 1, 0).getDate()

  const salidasPorFecha = {}
  todasLasSalidas.forEach((s) => {
    const [sy, sm] = s.fecha.split('-').map(Number)
    if (sy === anio && sm === numMes + 1) {
      if (!salidasPorFecha[s.fecha]) salidasPorFecha[s.fecha] = []
      salidasPorFecha[s.fecha].push(s)
    }
  })

  const celdas = []
  for (let i = 0; i < primerDia; i++) celdas.push(null)
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d)
  while (celdas.length % 7 !== 0) celdas.push(null)

  const hoy = new Date()
  const esHoy = (d) =>
    d && hoy.getFullYear() === anio && hoy.getMonth() === numMes && hoy.getDate() === d

  function togglePaseo(key) {
    setExpandidos((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function asignar(reservaId, choferId) {
    setAsignaciones((prev) => ({ ...prev, [reservaId]: choferId }))
  }

  const tituloMes = mes.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
        <p className="text-gray-400 text-sm">Próximas salidas y reservas confirmadas</p>
      </div>

      {/* Calendario */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">

        {/* Navegación de mes */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <button
            onClick={() => setMes(new Date(anio, numMes - 1, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 text-lg font-bold transition-colors"
          >
            ‹
          </button>
          <h2 className="font-semibold text-gray-800 capitalize text-base">{tituloMes}</h2>
          <button
            onClick={() => setMes(new Date(anio, numMes + 1, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 text-lg font-bold transition-colors"
          >
            ›
          </button>
        </div>

        {/* Cabecera días de semana */}
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
          {DIAS.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Celdas del calendario */}
        <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
          {celdas.map((dia, idx) => {
            if (!dia) return <div key={idx} className="min-h-[130px] bg-gray-50/40" />

            const fechaStr = `${anio}-${String(numMes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
            const salidas = salidasPorFecha[fechaStr] || []

            return (
              <div key={idx} className={`min-h-[130px] p-2 ${esHoy(dia) ? 'bg-blue-50/40' : ''}`}>
                {/* Número del día */}
                <div
                  className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-2 ${
                    esHoy(dia)
                      ? 'bg-[#002147] text-white'
                      : 'text-gray-400'
                  }`}
                >
                  {dia}
                </div>

                {/* Paseos */}
                <div className="space-y-1">
                  {salidas.map((s) => {
                    const key = `${fechaStr}_${s.excursion.id}`
                    const abierto = !!expandidos[key]
                    const tieneReservas = s.reservas.length > 0
                    const pax = s.reservas.reduce((a, r) => a + r.personas, 0)
                    const todosConChofer = tieneReservas && s.reservas.every((r) => asignaciones[r.id])

                    return (
                      <div key={key}>
                        {/* Chip del paseo */}
                        <button
                          onClick={() => togglePaseo(key)}
                          className={`w-full text-left rounded-lg px-2 py-1.5 transition-colors border-2 ${
                            todosConChofer
                              ? 'bg-[#002147] text-white border-green-400'
                              : tieneReservas
                              ? 'bg-[#002147] text-white border-transparent hover:bg-[#003366]'
                              : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-medium leading-tight truncate">
                              {s.excursion.nombre}
                            </span>
                            <span className="text-xs flex-shrink-0 opacity-70">
                              {abierto ? '▴' : '▾'}
                            </span>
                          </div>
                          {tieneReservas && (
                            <p className="text-xs opacity-60 mt-0.5">
                              {s.reservas.length} reserva{s.reservas.length !== 1 ? 's' : ''} · {pax} pax
                            </p>
                          )}
                        </button>

                        {/* Panel deslizable de clientes */}
                        <div
                          className="overflow-hidden transition-all duration-300 ease-in-out"
                          style={{ maxHeight: abierto ? '600px' : '0px', opacity: abierto ? 1 : 0 }}
                        >
                          <div className="mt-1.5 border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden">
                            {s.reservas.length === 0 ? (
                              <p className="text-xs text-gray-400 italic p-3">Sin reservas confirmadas</p>
                            ) : (
                              <>
                                {/* Filas de clientes */}
                                {s.reservas.map((r, ri) => {
                                  const choferAsignado = choferes.find((c) => c.id === asignaciones[r.id])
                                  return (
                                    <div
                                      key={r.id}
                                      className={`flex items-center gap-2 px-3 py-2.5 ${ri > 0 ? 'border-t border-gray-50' : ''}`}
                                    >
                                      {/* Info cliente */}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-gray-800 truncate">{r.clienteNombre}</p>
                                        <p className="text-xs text-gray-400">
                                          👥 {r.personas} pax · {formatPrecio(r.total)}
                                        </p>
                                      </div>

                                      {/* Dropdown chofer */}
                                      <select
                                        value={asignaciones[r.id] || ''}
                                        onChange={(e) => asignar(r.id, e.target.value)}
                                        className={`flex-shrink-0 text-xs rounded-lg px-2 py-1.5 focus:outline-none border transition-colors ${
                                          choferAsignado
                                            ? 'border-green-300 bg-green-50 text-green-700 font-medium'
                                            : 'border-gray-200 text-gray-500 bg-gray-50'
                                        }`}
                                      >
                                        <option value="">🚗 Chofer...</option>
                                        {choferes.map((c) => (
                                          <option key={c.id} value={c.id}>{c.nombre}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )
                                })}

                                {/* Botón cerrar operación */}
                                <PaseoBotonCerrar
                                  reservas={s.reservas}
                                  asignaciones={asignaciones}
                                  choferes={choferes}
                                  excursionNombre={s.excursion.nombre}
                                  fecha={fechaStr}
                                />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

function PaseoBotonCerrar({ reservas, asignaciones, choferes, excursionNombre, fecha }) {
  const reservasConChofer = reservas.filter((r) => asignaciones[r.id])
  const todosAsignados = reservasConChofer.length === reservas.length

  async function cerrar() {
    if (!reservasConChofer.length) return

    // Agrupar por chofer
    const porChofer = {}
    for (const r of reservasConChofer) {
      const cid = asignaciones[r.id]
      if (!porChofer[cid]) porChofer[cid] = []
      porChofer[cid].push(r)
    }

    const fechaFmt = new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long',
    })

    for (const [choferId, sus] of Object.entries(porChofer)) {
      const chofer = choferes.find((c) => c.id === choferId)
      if (!chofer) continue
      const lineas = sus
        .map((r) => `• *${r.clienteNombre}* — 👥 ${r.personas} pax`)
        .join('\n')
      const msg = `Hola ${chofer.nombre} 👋\n\nTe enviamos los pasajeros asignados para el *${fechaFmt}*:\n\n🗺 *${excursionNombre}*\n${lineas}\n\n¡Muchas gracias!`
      await sendWhatsApp(chofer.whatsapp, msg)
    }

    alert(`✅ Mensaje${Object.keys(porChofer).length > 1 ? 's' : ''} enviado${Object.keys(porChofer).length > 1 ? 's' : ''} correctamente.`)
  }

  if (!reservas.length) return null

  return (
    <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-between gap-2">
      <p className="text-xs text-gray-400">
        {reservasConChofer.length}/{reservas.length} con chofer
        {todosAsignados && <span className="text-green-500 ml-1">✓</span>}
      </p>
      <button
        onClick={cerrar}
        disabled={!reservasConChofer.length}
        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
          reservasConChofer.length
            ? 'bg-green-500 hover:bg-green-600 text-white'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        🚀 Cerrar operación
      </button>
    </div>
  )
}
