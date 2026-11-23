// Horario de recogida de una reserva (2026-11-02). Cada paseo tiene un tipo de horario
// (excursiones.horario_tipo, ver migración 20261102100000_horarios_por_reserva.sql):
//   fijo       siempre sale a la hora del paseo (excursiones.hora_salida)
//   variable   la hora se carga en cada reserva (reservas.hora_recogida): traslados y la mayoría de los paseos
//   catamaran  Maragogi: la hora sigue la tabla del catamarán; por ahora se carga en cada reserva
// Si la hora de la reserva está cargada, manda siempre sobre la del paseo.

export const TIPOS_HORARIO = {
  fijo: 'Fijo: siempre sale a la misma hora',
  variable: 'Variable: la hora se pone en cada reserva',
  catamaran: 'Según la tabla del catamarán (por ahora se pone en cada reserva)',
}

// '8:00 AM' -> '08:00', '2:30 PM' -> '14:30'; ya en 24 hs queda igual; si no se entiende, ''
export function hora24(txt) {
  const m = String(txt || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!m) return ''
  let h = parseInt(m[1], 10)
  const ap = (m[3] || '').toUpperCase()
  if (ap === 'PM' && h < 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

// Un traslado o paseo fuera del catálogo (sin `paseo`) es siempre variable. Un paseo sin el campo
// horario_tipo (la migración todavía no corrió) se comporta como antes: fijo.
export function tipoHorario(paseo) {
  if (!paseo) return 'variable'
  return paseo.horario_tipo || 'fijo'
}

// `reserva`: algo con hora_recogida · `paseo`: algo con horario_tipo y hora_salida, o null
// Devuelve 'HH:MM', o '' si todavía no hay hora.
export function horaDeReserva(reserva, paseo) {
  const propia = hora24(reserva?.hora_recogida)
  if (propia) return propia
  return tipoHorario(paseo) === 'fijo' ? hora24(paseo?.hora_salida) : ''
}

// ¿Esta reserva necesita que le carguen la hora a mano?
export const necesitaHoraPropia = (paseo) => tipoHorario(paseo) !== 'fijo'
