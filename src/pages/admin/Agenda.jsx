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
  const [diasAbiertos, setDiasAbiertos] = useState({})   // fechaStr → bool
  const [paseosAbiertos, setPaseosAbiertos] = useState({}) // fechaStr_excursionId → bool
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

  function toggleDia(fechaStr) {
    setDiasAbiertos((prev) => ({ ...prev, [fechaStr]: !prev[fechaStr] }))
  }

  function togglePaseo(key) {
    setPaseosAbiertos((prev) => ({ ...prev, [key]: !prev[key] }))
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

        {/* Navegación mes */}
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

        {/* Celdas */}
        <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
          {celdas.map((dia, idx) => {
            if (!dia) return <div key={idx} className="min-h-[90px] bg-gray-50/40" />

            const fechaStr = `${anio}-${String(numMes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
            const salidas = salidasPorFecha[fechaStr] || []
            const diaAbierto = !!diasAbiertos[fechaStr]
            const totalReservas = salidas.reduce((a, s) => a + s.reservas.length, 0)
            const tieneSalidas = salidas.length > 0

            return (
              <div key={idx} className={`${esHoy(dia) ? 'bg-blue-50/30' : ''}`}>

                {/* ── NIVEL 1: click en el día ── */}
                <button
                  onClick={() => tieneSalidas && toggleDia(fechaStr)}
                  className={`w-full p-2 text-left transition-colors ${tieneSalidas ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    {/* Número del día */}
                    <div
                      className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 ${
                        esHoy(dia) ? 'bg-[#002147] text-white' : 'text-gray-500'
                      }`}
                    >
                      {dia}
                    </div>

                    {/* Indicadores */}
                    {tieneSalidas && (
                      <div className="flex flex-col items-end gap-0.5 mt-0.5">
                        <span className="text-xs text-gray-400">{salidas.length} paseo{salidas.length !== 1 ? 's' : ''}</span>
                        {totalReservas > 0 && (
                          <span className="text-xs font-semibold text-[#002147]">{totalReservas} reserva{totalReservas !== 1 ? 's' : ''}</span>
                        )}
                        <span className="text-xs">{diaAbierto ? '▴' : '▾'}</span>
                      </div>
                    )}
                  </div>
                </button>

                {/* ── NIVEL 1 expandido: lista de paseos del día ── */}
                <div
                  className="overflow-hidden transition-all duration-300 ease-in-out"
                  style={{ maxHeight: diaAbierto ? '1000px' : '0px', opacity: diaAbierto ? 1 : 0 }}
                >
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {salidas.map((s) => {
                      const paseoKey = `${fechaStr}_${s.excursion.id}`
                      const paseoAbierto = !!paseosAbiertos[paseoKey]
                      const tieneReservas = s.reservas.length > 0
                      const todosConChofer = tieneReservas && s.reservas.every((r) => asignaciones[r.id])

                      return (
                        <div key={paseoKey}>

                          {/* ── NIVEL 2: click en el paseo ── */}
                          <button
                            onClick={() => tieneReservas && togglePaseo(paseoKey)}
                            className={`w-full text-left px-3 py-2.5 transition-colors flex items-center justify-between gap-2 ${
                              tieneReservas ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  todosConChofer ? 'bg-green-400' : tieneReservas ? 'bg-[#002147]' : 'bg-gray-300'
                                }`}
                              />
                              <span className="text-xs font-medium text-gray-800 truncate">
                                {s.excursion.nombre}
                              </span>
                            </div>
                            {tieneReservas && (
                              <span className="text-xs flex-shrink-0 text-gray-400">
                                {s.reservas.length} pax {paseoAbierto ? '▴' : '▾'}
                              </span>
                            )}
                          </button>

                          {/* ── NIVEL 2 expandido: clientes del paseo ── */}
                          <div
                            className="overflow-hidden transition-all duration-300 ease-in-out"
                            style={{ maxHeight: paseoAbierto ? '600px' : '0px', opacity: paseoAbierto ? 1 : 0 }}
                          >
                            <div className="mx-2 mb-2 border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden">
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
                                      <p className="text-xs text-gray-400">👥 {r.personas} pax · {formatPrecio(r.total)}</p>
                                    </div>
                                    {/* Dropdown chofer */}
                                    <select
                                      value={asignaciones[r.id] || ''}
                                      onChange={(e) => asignar(r.id, e.target.value)}
                                      className={`flex-shrink-0 text-xs rounded-lg px-2 py-1.5 border focus:outline-none transition-colors ${
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
                            </div>
                          </div>

                        </div>
                      )
                    })}
                  </div>
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
      const lineas = sus.map((r) => `• *${r.clienteNombre}* — 👥 ${r.personas} pax`).join('\n')
      const msg = `Hola ${chofer.nombre} 👋\n\nTe enviamos los pasajeros del *${fechaFmt}*:\n\n🗺 *${excursionNombre}*\n${lineas}\n\n¡Muchas gracias!`
      await sendWhatsApp(chofer.whatsapp, msg)
    }

    alert(`✅ Mensaje enviado correctamente.`)
  }

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
