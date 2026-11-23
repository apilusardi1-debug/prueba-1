import { supabase } from './supabase.js'
import { cabeceraPanel } from './sesionPanel.js'

// Historial de quién asignó cada chat del CRM a quién y cuándo. Solo lo responde el superadmin
// (lo comprueba la función historial-asignaciones, no solo esta pantalla).
export async function leerHistorialAsignaciones({ desde, hasta } = {}) {
  if (!supabase) return { error: 'Sin conexión' }
  const { data, error } = await supabase.functions.invoke('historial-asignaciones', {
    headers: cabeceraPanel(),
    body: { desde, hasta },
  })
  if (error) {
    let mensaje = error.message || 'No se pudo leer el historial.'
    try { const cuerpo = await error.context?.json?.(); if (cuerpo?.error) mensaje = cuerpo.error } catch { /* sin detalle */ }
    return { error: mensaje }
  }
  if (!data?.ok) return { error: data?.error || 'No se pudo leer el historial.' }
  return { filas: data.filas, usuarios: data.usuarios }
}
