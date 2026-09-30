// Acceso a "Entrenar al asistente": solo Cristian y Abril, sea cual sea su rol
// (hoy "admin" lo tienen más personas — Flor, Marcos — así que el rol no alcanza
// para restringirlo a ellos dos). Por email porque la sesión no guarda el id.
export const EMAILS_ENTRENAMIENTO = ['bellostacristian@gmail.com', 'apilusardi1@gmail.com']

export function puedeEntrenar(email) {
  return EMAILS_ENTRENAMIENTO.includes(String(email || '').trim().toLowerCase())
}
