// Costo operativo de una reserva, según lo cargado en Finanzas > Costos operativos de cada paseo.
// Lo usan la Agenda (al asignar chofer o guía) y el Resumen de Finanzas (margen por paseo).
//
// Tipos de costo (costos_excursion.tipo):
//   por_persona    monto_por_persona x pasajeros
//   por_paseo      monto fijo por reserva (una moto de agua, un buggy, un cuatriciclo); se guarda en monto_por_persona
//   chofer_tramos  una vez por chofer asignado, según el tramo de pasajeros
//   guia_tramos    una vez por guía asignado, según el tramo de pasajeros

const formatReal = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)

// `chofer` (opcional): si tiene tarifa propia para este paseo (choferes.tarifas, por viaje y no por
// pasajero), esa tarifa reemplaza al costo de chofer por tramos; si no, queda el costo de siempre.
export function calcularCostoOperativo(excursionId, pax, costosCatalogo, conChofer, conGuia, chofer = null) {
  const costosExc = costosCatalogo.filter(c => c.excursion_id === excursionId && c.activo !== false)
  let total = 0
  let moneda = 'BRL'
  const detalle = []
  const tarifaPropia = conChofer && chofer?.tarifas ? Number(chofer.tarifas[excursionId]) : NaN
  if (tarifaPropia > 0) {
    total += tarifaPropia
    detalle.push({ concepto: `Chofer ${chofer.nombre}`, monto: tarifaPropia, nota: 'tarifa del chofer por viaje' })
  }
  for (const c of costosExc) {
    moneda = c.moneda || moneda
    if (c.tipo === 'chofer_tramos' || c.tipo === 'guia_tramos') {
      if (c.tipo === 'chofer_tramos' && (!conChofer || tarifaPropia > 0)) continue
      if (c.tipo === 'guia_tramos' && !conGuia) continue
      const tramos = [...(c.tramos || [])].sort((a, b) => a.hasta - b.hasta)
      const tramo = tramos.find(t => pax <= t.hasta) || tramos[tramos.length - 1]
      if (tramo) {
        total += tramo.monto
        detalle.push({ concepto: c.concepto, monto: tramo.monto, nota: `hasta ${tramo.hasta} pax` })
      }
    } else if (c.tipo === 'por_paseo') {
      const monto = Number(c.monto_por_persona || 0)
      total += monto
      detalle.push({ concepto: c.concepto, monto, nota: 'fijo por paseo' })
    } else {
      const monto = (c.monto_por_persona || 0) * pax
      total += monto
      detalle.push({ concepto: c.concepto, monto, nota: `${formatReal(c.monto_por_persona)} x ${pax}` })
    }
  }
  return { total, moneda, detalle }
}
