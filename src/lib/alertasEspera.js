// Una conversación sin respuesta humana se marca en amarillo a las 12 hs y en
// rojo a las 18 hs, contadas desde el primer mensaje del cliente que quedó sin
// atender. Los usan la lista del CRM y el Dashboard, así no se contradicen.
export const HORAS_ALERTA_AMARILLA = 12
export const HORAS_ALERTA_ROJA = 18

export function nivelEspera(horas) {
  if (horas >= HORAS_ALERTA_ROJA) return 'roja'
  if (horas >= HORAS_ALERTA_AMARILLA) return 'amarilla'
  return null
}
