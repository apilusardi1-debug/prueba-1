// Cuentas de Finanzas a partir de las planillas (reservas de paseos) y de los movimientos de caja.
// Reglas acordadas con Cristian (23/11/2026):
//  - La seña la cobra el vendedor: es su comisión y NUNCA entra a la caja de la agencia.
//  - El saldo lo cobra el guía en el paseo; Francisco lo registra en el sistema cuando el guía le pasa
//    el comprobante por WhatsApp. Ahí nace el ingreso (cobro_paseo) y baja el saldo de la reserva.
//  - Cada moneda va por separado, sin convertir.
import { saldoDe } from './reservasPlanilla.js'

// Fecha de inicio de Finanzas. Los paseos anteriores se dan por cobrados y por pagados (se llevaron en
// las planillas contables): no cuentan como "por cobrar" ni "por pagar". Los de esa fecha en adelante con
// saldo pendiente son el saldo de apertura real. No toca ningún dato.
// PRUEBA: del 23 al 30/11/2026 arranca en 2026-11-23 para poder comprobar todo con datos reales.
// El 30/11 se borran los movimientos de la prueba y esta fecha vuelve a '2026-12-01' (inicio oficial).
export const FINANZAS_INICIO = '2026-11-23'
export const FINANZAS_INICIO_OFICIAL = '2026-12-01'
const desdeInicio = (fecha) => !!fecha && fecha >= FINANZAS_INICIO

export const ORIGEN_COBRO_PASEO = 'cobro_paseo'
export const ORIGEN_LIQ_CHOFER = 'liquidacion_chofer'

const moneda = (r) => r?.moneda || 'BRL'
const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v))
const enRango = (f, desde, hasta) => !!f && f >= desde && f <= hasta
const vigente = (r) => r.estado !== 'cancelada'
const realizable = (r) => r.estado === 'confirmada' || r.estado === 'completada'

// Suma en un mapa { [moneda]: numero }
function sumar(mapa, mon, valor) {
  mapa[mon] = (mapa[mon] || 0) + valor
}

// Lo que cuesta operar una reserva: el costo operativo calculado al asignar chofer y guía (según lo
// cargado en Costos operativos) y, si todavía no se calculó, la comisión del chofer de la planilla.
// Devuelve { monto, moneda }.
export function costoDe(r) {
  if (r.costo_operativo != null && Number(r.costo_operativo) > 0) {
    return { monto: Number(r.costo_operativo), moneda: r.costo_operativo_moneda || 'BRL' }
  }
  return { monto: num(r.comision_chofer), moneda: moneda(r) }
}

// Margen por paseo y moneda, con las reservas confirmadas o completadas cuyo paseo cae en el período.
// Margen = venta − seña (comisión del vendedor) − costo de operar.
export function margenPorPaseo(reservas, desde, hasta, nombrePaseo) {
  const filas = new Map()
  for (const r of reservas) {
    if (!realizable(r) || !enRango(r.fecha, desde, hasta)) continue
    const mon = moneda(r)
    const clave = `${nombrePaseo(r)}||${mon}`
    const f = filas.get(clave) || { paseo: nombrePaseo(r), moneda: mon, reservas: 0, pax: 0, ventas: 0, sena: 0, costo: 0, costoOtraMoneda: 0 }
    f.reservas += 1
    f.pax += num(r.personas)
    f.ventas += num(r.total)
    f.sena += num(r.sena)
    const c = costoDe(r)
    if (c.moneda === mon) f.costo += c.monto
    else if (c.monto > 0) f.costoOtraMoneda += 1
    filas.set(clave, f)
  }
  return [...filas.values()]
    .map((f) => ({ ...f, margen: f.ventas - f.sena - f.costo }))
    .sort((a, b) => b.margen - a.margen)
}

// Margen total por moneda (suma de las filas de arriba)
export function totalesMargen(filas) {
  const t = {}
  for (const f of filas) {
    const x = t[f.moneda] || { ventas: 0, sena: 0, costo: 0, margen: 0 }
    x.ventas += f.ventas; x.sena += f.sena; x.costo += f.costo; x.margen += f.margen
    t[f.moneda] = x
  }
  return t
}

// Ventas del período (por fecha de venta) y cobrado vs por cobrar, por moneda.
//  ventas: total vendido · sena: cobrada por los vendedores (no entra a caja)
//  cobrado: saldos ya registrados en caja en el período · porCobrar: saldo pendiente de esas ventas
export function resumenVentas(reservas, movimientos, desde, hasta) {
  const r = { ventas: {}, sena: {}, cobrado: {}, porCobrar: {} }
  for (const x of reservas) {
    if (!vigente(x) || !enRango(x.fecha_venta || x.fecha, desde, hasta)) continue
    const mon = moneda(x)
    sumar(r.ventas, mon, num(x.total))
    sumar(r.sena, mon, num(x.sena))
    const s = saldoDe(x)
    if (s > 0 && desdeInicio(x.fecha)) sumar(r.porCobrar, mon, s)
  }
  for (const m of movimientos) {
    if (m.tipo !== 'ingreso' || m.estado === 'anulado' || m.origen !== ORIGEN_COBRO_PASEO) continue
    if (!enRango(m.fecha, desde, hasta)) continue
    sumar(r.cobrado, m.moneda || 'BRL', num(m.monto))
  }
  return r
}

// Seña por vendedor (comisión del vendedor), según la fecha de venta
export function comisionesVendedor(reservas, desde, hasta) {
  const filas = new Map()
  for (const x of reservas) {
    if (!vigente(x) || !enRango(x.fecha_venta || x.fecha, desde, hasta)) continue
    const mon = moneda(x)
    const nombre = String(x.vendedor_texto || '').trim() || 'Sin vendedor'
    const clave = `${nombre}||${mon}`
    const f = filas.get(clave) || { vendedor: nombre, moneda: mon, ventas: 0, total: 0, sena: 0 }
    f.ventas += 1
    f.total += num(x.total)
    f.sena += num(x.sena)
    filas.set(clave, f)
  }
  return [...filas.values()].sort((a, b) => b.sena - a.sena)
}

// Comisión de cada chofer: devengada (paseos confirmados o completados del período), ya liquidada y por pagar
export function comisionesChofer(reservas, desde, hasta) {
  const filas = new Map()
  for (const x of reservas) {
    if (!realizable(x) || !enRango(x.fecha, desde, hasta)) continue
    const monto = num(x.comision_chofer)
    if (monto <= 0) continue
    const mon = moneda(x)
    const nombre = String(x.chofer_texto || x.choferes?.nombre || '').trim() || 'Sin chofer'
    const clave = `${nombre}||${mon}`
    const f = filas.get(clave) || { chofer: nombre, moneda: mon, paseos: 0, devengado: 0, pagado: 0, porPagar: 0, idsPorPagar: [] }
    f.paseos += 1
    f.devengado += monto
    if (x.comision_chofer_pagada_at || !desdeInicio(x.fecha)) f.pagado += monto
    else { f.porPagar += monto; f.idsPorPagar.push(x.id) }
    filas.set(clave, f)
  }
  return [...filas.values()].sort((a, b) => b.porPagar - a.porPagar || b.devengado - a.devengado)
}

// Saldos de paseos todavía sin cobrar: los ya realizados (hay que registrarlos) y los de los próximos días
export function cobrosPendientes(reservas, hoy, diasAdelante = 7) {
  const limite = new Date(hoy + 'T12:00:00')
  limite.setDate(limite.getDate() + diasAdelante)
  const hasta = limite.toISOString().slice(0, 10)
  const vencidos = [], proximos = []
  for (const x of reservas) {
    if (!vigente(x) || !desdeInicio(x.fecha) || !(saldoDe(x) > 0)) continue
    if (x.fecha < hoy) vencidos.push(x)
    else if (x.fecha <= hasta) proximos.push(x)
  }
  const orden = (a, b) => a.fecha.localeCompare(b.fecha) || String(a.cliente_nombre).localeCompare(String(b.cliente_nombre))
  return { vencidos: vencidos.sort(orden), proximos: proximos.sort(orden) }
}

// Texto "R$ 1.200 · US$ 50" para un mapa { BRL: 1200, USD: 50 }
export function textoPorMoneda(mapa, formatMonto) {
  const partes = Object.entries(mapa || {}).filter(([, v]) => v).map(([m, v]) => formatMonto(v, m))
  return partes.length ? partes.join(' · ') : formatMonto(0, 'BRL')
}
