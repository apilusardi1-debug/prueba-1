// Reservas como las carga el equipo de paseos (antes en el Excel "NUEVA PLANILLA").
// Lo comparten la pantalla de Reservas, su formulario y la Agenda.
// Columnas en la base: migración 20261014100000_reservas_planilla_paseos.sql.

// Nombre del paseo de una reserva: el texto cargado (traslados, paseos fuera del
// catálogo) o, en reservas viejas que solo tienen excursion_id, el del catálogo.
export function nombrePaseo(r) {
  return r?.paseo || r?.excursiones?.nombre || '—'
}

// Lo que le falta pagar al cliente: lo cargado a mano o, si no se cargó, venta − seña
export function saldoDe(r) {
  if (r?.saldo_cliente != null) return Number(r.saldo_cliente)
  if (r?.total == null) return null
  return Math.max(Number(r.total) - Number(r.sena || 0), 0)
}

export const MONEDAS = { BRL: 'R$', USD: 'US$' }

export function formatMonto(n, moneda = 'BRL') {
  if (n == null || n === '') return '—'
  const num = Number(n)
  if (Number.isNaN(num)) return '—'
  return `${MONEDAS[moneda] || 'R$'} ${num.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
}

export function fechaCorta(iso) {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a.slice(2)}`
}

// Para comparar textos escritos a mano ("Maragogi", "maragogi ", "MARAGOGI")
export const claveTexto = (t) => String(t ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Valores distintos de una lista de textos, sin repetir por mayúsculas o acentos, ordenados
export function distintos(textos) {
  const vistos = new Map()
  for (const t of textos) {
    const limpio = String(t ?? '').trim()
    if (limpio && !vistos.has(claveTexto(limpio))) vistos.set(claveTexto(limpio), limpio)
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, 'es'))
}
