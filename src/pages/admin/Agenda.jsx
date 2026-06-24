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

function formatFechaLarga(fechaStr) {
  return new Date(fechaStr + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function Agenda() {
  const todasLasSalidas = buildSalidas()
  const [mes, setMes] = useState(primerMesConDatos)
  const [diasAbiertos, setDiasAbiertos] = useState({})
  const [choferes, setChoferes] = useState([])
  const [asignaciones, setAsignaciones] = useState({})
  const [modal, setModal] = useState(null) // { salida } | null

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
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 text-xl font-bold transition-colors"
          >‹</button>
          <h2 className="font-semibold text-gray-800 capitalize">{tituloMes}</h2>
          <button
            onClick={() => setMes(new Date(anio, numMes + 1, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 text-xl font-bold transition-colors"
          >›</button>
        </div>

        {/* Cabecera días semana */}
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
          {DIAS.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2 uppercase tracking-wide">{d}</div>
          ))}
        </div>

        {/* Celdas del mes */}
        <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
          {celdas.map((dia, idx) => {
            if (!dia) return <div key={idx} className="min-h-[90px] bg-gray-50/40" />

            const fechaStr = `${anio}-${String(numMes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
            const salidas = salidasPorFecha[fechaStr] || []
            const abierto = !!diasAbiertos[fechaStr]
            const tieneSalidas = salidas.length > 0

            return (
              <div key={idx} className={`${esHoy(dia) ? 'bg-blue-50/30' : ''}`}>

                {/* Cabecera del día — clickeable */}
                <button
                  onClick={() => tieneSalidas && toggleDia(fechaStr)}
                  className={`w-full p-2 text-left flex items-center justify-between gap-1 transition-colors ${tieneSalidas ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}`}
                >
                  <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 ${
                    esHoy(dia) ? 'bg-[#002147] text-white' : 'text-gray-500'
                  }`}>
                    {dia}
                  </span>
                  {tieneSalidas && (
                    <span className="text-gray-300 text-xs">{abierto ? '▴' : '▾'}</span>
                  )}
                </button>

                {/* Lista de paseos — se desliza al hacer click en el día */}
                <div
                  className="overflow-hidden transition-all duration-300 ease-in-out"
                  style={{ maxHeight: abierto ? '600px' : '0px', opacity: abierto ? 1 : 0 }}
                >
                  <div className="px-1.5 pb-2 space-y-1">
                    {salidas.map((s) => {
                      const paxReservados = s.reservas.reduce((a, r) => a + r.personas, 0)
                      const todosConChofer = s.reservas.length > 0 && s.reservas.every((r) => asignaciones[r.id])

                      return (
                        <button
                          key={s.excursion.id}
                          onClick={() => setModal({ salida: s })}
                          className={`w-full text-left rounded-lg px-2 py-2 transition-all border ${
                            todosConChofer
                              ? 'bg-[#002147] border-green-400 text-white'
                              : s.reservas.length > 0
                              ? 'bg-[#002147] border-transparent text-white hover:bg-[#003366]'
                              : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          <p className="text-xs font-medium truncate leading-tight">{s.excursion.nombre}</p>
                          <p className="text-xs opacity-60 mt-0.5">{paxReservados}/{s.excursion.cupos} personas</p>
                        </button>
                      )
                    })}
                  </div>
                </div>

              </div>
            )
          })}
        </div>
      </div>

      {/* Modal pasajeros */}
      {modal && (
        <ModalPasajeros
          salida={modal.salida}
          choferes={choferes}
          asignaciones={asignaciones}
          onAsignar={asignar}
          onCerrar={() => setModal(null)}
        />
      )}
    </div>
  )
}

function ModalPasajeros({ salida, choferes, asignaciones, onAsignar, onCerrar }) {
  const { excursion, reservas: pasajeros, fecha } = salida
  const paxReservados = pasajeros.reduce((a, r) => a + r.personas, 0)
  const conChofer = pasajeros.filter((r) => asignaciones[r.id])
  const todos = conChofer.length === pasajeros.length && pasajeros.length > 0

  async function cerrarOperacion() {
    if (!conChofer.length) return

    const porChofer = {}
    for (const r of conChofer) {
      const cid = asignaciones[r.id]
      if (!porChofer[cid]) porChofer[cid] = []
      porChofer[cid].push(r)
    }

    const fechaFmt = formatFechaLarga(fecha)

    for (const [cid, sus] of Object.entries(porChofer)) {
      const chofer = choferes.find((c) => c.id === cid)
      if (!chofer) continue
      const lineas = sus.map((r) => `• *${r.clienteNombre}* — 👥 ${r.personas} pax · 🏨 ${r.hospedaje || 'Sin hospedaje'}`).join('\n')
      await sendWhatsApp(
        chofer.whatsapp,
        `Hola ${chofer.nombre} 👋\n\nPasajeros del *${fechaFmt}*:\n\n🗺 *${excursion.nombre}*\n${lineas}\n\n¡Gracias!`
      )
    }
    alert('✅ Mensaje enviado al chofer.')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCerrar}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header del modal */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold text-gray-900 text-base leading-snug">{excursion.nombre}</h2>
            <p className="text-sm text-gray-400 mt-0.5 capitalize">{formatFechaLarga(fecha)}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm font-semibold text-[#002147]">
                {paxReservados}/{excursion.cupos} personas
              </span>
              <div className="flex-1 bg-gray-100 rounded-full h-1.5 w-24">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    paxReservados / excursion.cupos >= 0.8 ? 'bg-red-400' :
                    paxReservados / excursion.cupos >= 0.5 ? 'bg-yellow-400' : 'bg-green-400'
                  }`}
                  style={{ width: `${Math.min(100, (paxReservados / excursion.cupos) * 100)}%` }}
                />
              </div>
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg flex-shrink-0 transition-colors"
          >×</button>
        </div>

        {/* Lista de pasajeros */}
        <div className="overflow-y-auto flex-1">
          {pasajeros.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">👤</p>
              <p className="text-sm">Sin pasajeros reservados</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {pasajeros.map((r) => {
                const choferAsignado = choferes.find((c) => c.id === asignaciones[r.id])
                return (
                  <div key={r.id} className="px-6 py-4">
                    {/* Info pasajero */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{r.clienteNombre}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          📞 +{r.clienteWhatsapp}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          🏨 {r.hospedaje || '—'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-semibold text-[#002147]">{r.personas} pax</p>
                        <p className="text-xs text-gray-400">{formatPrecio(r.total)}</p>
                        <a
                          href={`https://wa.me/${r.clienteWhatsapp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-500 hover:text-green-600 text-sm"
                        >💬</a>
                      </div>
                    </div>

                    {/* Asignación de chofer */}
                    <select
                      value={asignaciones[r.id] || ''}
                      onChange={(e) => onAsignar(r.id, e.target.value)}
                      className={`w-full text-sm rounded-xl px-3 py-2 border focus:outline-none transition-colors ${
                        choferAsignado
                          ? 'border-green-300 bg-green-50 text-green-700 font-medium'
                          : 'border-gray-200 text-gray-500 bg-gray-50'
                      }`}
                    >
                      <option value="">🚗 Asignar chofer...</option>
                      {choferes.map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                    {choferAsignado && (
                      <p className="text-xs text-green-600 font-medium mt-1.5">✓ {choferAsignado.nombre} asignado</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer con botón cerrar operación */}
        {pasajeros.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
            <p className="text-sm text-gray-400">
              {conChofer.length}/{pasajeros.length} con chofer asignado
              {todos && <span className="text-green-500 ml-1 font-medium">✓</span>}
            </p>
            <button
              onClick={cerrarOperacion}
              disabled={!conChofer.length}
              className={`flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors ${
                conChofer.length
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              🚀 Cerrar operación
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
