// Estados de una reserva: una sola definición para Reservas (la planilla) y la Agenda,
// para que las dos pantallas muestren lo mismo y apliquen la misma condición.
//
// - Toda reserva nueva arranca en "pendiente"; alguien la confirma después.
// - "completada" la pone sola la planilla cuando una reserva confirmada ya pasó de fecha.
// - Una reserva "pendiente" cuya fecha ya pasó figura en rojo ("Pendiente vencida"): nadie
//   la confirmó ni la canceló, hay que revisarla.

export const ESTADO_INICIAL = 'pendiente'

const ZONA = 'America/Recife'

// Fecha de hoy en Brasil (AAAA-MM-DD), igual formato que reservas.fecha
export function hoyReservas(ahora = new Date()) {
  return ahora.toLocaleDateString('en-CA', { timeZone: ZONA })
}

export const ESTADOS_RESERVA = {
  pendiente:  { label: 'Pendiente',  dot: 'bg-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50',  darkText: 'dark:text-yellow-400', darkBg: 'dark:bg-yellow-950/40' },
  confirmada: { label: 'Confirmada', dot: 'bg-green-500',  text: 'text-green-700',  bg: 'bg-green-50',   darkText: 'dark:text-green-400',  darkBg: 'dark:bg-green-950/40' },
  completada: { label: 'Completada', dot: 'bg-blue-500',   text: 'text-blue-700',   bg: 'bg-blue-50',    darkText: 'dark:text-blue-400',   darkBg: 'dark:bg-blue-950/40' },
  cancelada:  { label: 'Cancelada',  dot: 'bg-red-400',    text: 'text-red-700',    bg: 'bg-red-50',     darkText: 'dark:text-red-400',    darkBg: 'dark:bg-red-950/40' },
}

// Lo que se puede elegir a mano: Pendiente, Confirmada y Cancelada. "Completada" no se elige:
// la pone sola la planilla cuando una reserva confirmada ya pasó de fecha. Si una reserva ya
// está completada, esa opción aparece solo en su propio selector para no mostrarlo vacío.
export const ESTADOS_ELEGIBLES = ['pendiente', 'confirmada', 'cancelada']

export function opcionesEstado(actual) {
  return actual === 'completada' ? [...ESTADOS_ELEGIBLES, 'completada'] : ESTADOS_ELEGIBLES
}

// Las opciones del desplegable no heredan el color del estado (se veían rojas en una vencida)
export const CLASE_OPCION = 'bg-white text-gray-900 dark:bg-zinc-800 dark:text-zinc-100'

const PENDIENTE_VENCIDA = {
  label: 'Pendiente vencida', dot: 'bg-red-600', text: 'text-red-700', bg: 'bg-red-100', darkText: 'dark:text-red-300', darkBg: 'dark:bg-red-950/60',
}

// La condición, en un solo lugar: pendiente y con la fecha ya pasada (hoy todavía no cuenta).
export function esPendienteVencida(reserva, hoy = hoyReservas()) {
  return reserva?.estado === 'pendiente' && !!reserva.fecha && String(reserva.fecha).slice(0, 10) < hoy
}

// Colores y texto para mostrar el estado de una reserva en pantalla
export function infoEstado(reserva, hoy = hoyReservas()) {
  if (esPendienteVencida(reserva, hoy)) return PENDIENTE_VENCIDA
  return ESTADOS_RESERVA[reserva?.estado] || ESTADOS_RESERVA.pendiente
}
