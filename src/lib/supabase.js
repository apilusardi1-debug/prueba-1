import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️  Faltan variables de entorno de Supabase. Copiá .env.example a .env y completá los valores.')
}

// Si no hay credenciales, supabase queda en null y cada función retorna error graciosamente
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Normaliza snake_case de Supabase al formato camelCase que usan los componentes
export function normalizarExcursion(e) {
  if (!e) return null
  return {
    ...e,
    cuposDisponibles: e.cupos_disponibles ?? e.cuposDisponibles ?? 0,
    moneda: e.moneda || 'USD',
  }
}

// ── Excursiones ────────────────────────────────────────────────────────────────
export const excursionesApi = {
  getAll: () => supabase?.from('excursiones').select('*').eq('activa', true).order('nombre'),
  getById: (id) => supabase?.from('excursiones').select('*').eq('id', id).single(),
  create: (data) => supabase?.from('excursiones').insert(data).select().single(),
  update: (id, data) => supabase?.from('excursiones').update(data).eq('id', id).select().single(),
  delete: (id) => supabase?.from('excursiones').delete().eq('id', id),
}

// Mantiene sincronizados los contadores "cacheados" que dependen de las
// reservas (clientes.cantidad_reservas, excursiones.cupos_disponibles).
// Centralizado acá para que cualquier lugar que cree/borre/cancele una
// reserva los actualice automáticamente, sin tener que acordarse en cada
// pantalla — así fue como total_gastado y estos dos quedaron desincronizados
// antes de este fix.
async function ajustarCantidadReservas(clienteId, delta) {
  if (!supabase || !clienteId || !delta) return
  const { data: cliente } = await supabase.from('clientes').select('cantidad_reservas').eq('id', clienteId).single()
  if (!cliente) return
  const nuevo = Math.max((cliente.cantidad_reservas || 0) + delta, 0)
  await supabase.from('clientes').update({ cantidad_reservas: nuevo }).eq('id', clienteId)
}

async function ajustarCuposDisponibles(excursionId, delta) {
  if (!supabase || !excursionId || !delta) return
  const { data: excursion } = await supabase.from('excursiones').select('cupos, cupos_disponibles').eq('id', excursionId).single()
  if (!excursion) return
  const tope = excursion.cupos ?? 0
  const nuevo = Math.min(Math.max((excursion.cupos_disponibles ?? tope) + delta, 0), tope)
  await supabase.from('excursiones').update({ cupos_disponibles: nuevo }).eq('id', excursionId)
}

// ── Reservas ───────────────────────────────────────────────────────────────────
export const reservasApi = {
  getAll: () => supabase?.from('reservas').select('*, excursiones(nombre, categoria, cupos), choferes(id, nombre, whatsapp), guias(id, nombre, whatsapp)').order('fecha'),
  getByWhatsapp: (whatsapp) => supabase?.from('reservas').select('*, excursiones(nombre, imagen)').eq('cliente_whatsapp', whatsapp),
  create: async (data) => {
    const result = await supabase?.from('reservas').insert(data).select().single()
    const r = result?.data
    if (r) {
      await ajustarCantidadReservas(r.cliente_id, 1)
      if (r.estado !== 'cancelada') await ajustarCuposDisponibles(r.excursion_id, -(r.personas || 0))
    }
    return result
  },
  updateEstado: async (id, estado) => {
    const { data: antes } = await supabase?.from('reservas').select('excursion_id, personas, estado').eq('id', id).single() || {}
    const result = await supabase?.from('reservas').update({ estado }).eq('id', id).select().single()
    if (antes && antes.estado !== estado) {
      if (estado === 'cancelada') await ajustarCuposDisponibles(antes.excursion_id, antes.personas || 0)
      else if (antes.estado === 'cancelada') await ajustarCuposDisponibles(antes.excursion_id, -(antes.personas || 0))
    }
    return result
  },
  updatePago: (id, pagado) => supabase?.from('reservas').update({ pagado }).eq('id', id).select().single(),
  updateCostoOperativo: (id, { costo_operativo, costo_operativo_moneda, costo_operativo_detalle }) =>
    supabase?.from('reservas').update({ costo_operativo, costo_operativo_moneda, costo_operativo_detalle }).eq('id', id).select().single(),
  updateAsignacion: (id, data) => supabase?.from('reservas').update(data).eq('id', id).select('*, excursiones(nombre), choferes(id, nombre, whatsapp), guias(id, nombre, whatsapp)').single(),
  delete: async (id) => {
    const { data: antes } = await supabase?.from('reservas').select('cliente_id, excursion_id, personas, estado').eq('id', id).single() || {}
    const result = await supabase?.from('reservas').delete().eq('id', id)
    if (antes) {
      await ajustarCantidadReservas(antes.cliente_id, -1)
      if (antes.estado !== 'cancelada') await ajustarCuposDisponibles(antes.excursion_id, antes.personas || 0)
    }
    return result
  },
}

// ── Leads ──────────────────────────────────────────────────────────────────────
export const leadsApi = {
  getAll: () => supabase?.from('leads').select('*').order('created_at', { ascending: false }),
  getByWhatsapp: (whatsapp) => supabase?.from('leads').select('id').eq('whatsapp', whatsapp).maybeSingle(),
  create: (data) => supabase?.from('leads').insert(data).select().single(),
  updateEstado: (id, estado, notas) => supabase?.from('leads').update({ estado, notas }).eq('id', id).select().single(),
  update: (id, data) => supabase?.from('leads').update(data).eq('id', id).select().single(),
  delete: (id) => supabase?.from('leads').delete().eq('id', id),
}

// ── Storage ────────────────────────────────────────────────────────────────────
export async function subirImagen(archivo) {
  if (!supabase) return { url: null, error: 'Sin conexión' }
  const ext = archivo.name.split('.').pop()
  const path = `excursiones/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('imagenes').upload(path, archivo)
  if (error) return { url: null, error: error.message }
  const { data } = supabase.storage.from('imagenes').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

// ── Choferes ───────────────────────────────────────────────────────────────────
export const choferesApi = {
  getAll: () => supabase?.from('choferes').select('*').order('nombre'),
  create: (data) => supabase?.from('choferes').insert(data).select().single(),
  update: (id, data) => supabase?.from('choferes').update(data).eq('id', id).select().single(),
  delete: (id) => supabase?.from('choferes').delete().eq('id', id),
}

// ── Guías ──────────────────────────────────────────────────────────────────────
export const guiasApi = {
  getAll: () => supabase?.from('guias').select('*').order('nombre'),
  create: (data) => supabase?.from('guias').insert(data).select().single(),
  update: (id, data) => supabase?.from('guias').update(data).eq('id', id).select().single(),
  delete: (id) => supabase?.from('guias').delete().eq('id', id),
}

// ── Vendedores ─────────────────────────────────────────────────────────────────
export const vendedoresApi = {
  getAll: () => supabase?.from('vendedores').select('*').order('nombre'),
  getByCodigoReferido: (codigo) => supabase?.from('vendedores').select('*').eq('codigo_referido', codigo.toUpperCase()).single(),
  create: (data) => supabase?.from('vendedores').insert(data).select().single(),
  update: (id, data) => supabase?.from('vendedores').update(data).eq('id', id).select().single(),
  delete: (id) => supabase?.from('vendedores').delete().eq('id', id),
}

// ── Clientes ───────────────────────────────────────────────────────────────────
export const clientesApi = {
  getAll: () => supabase?.from('clientes').select('*').order('nombre'),
  getById: (id) => supabase?.from('clientes').select('*').eq('id', id).single(),
  getByWhatsapp: (whatsapp) => supabase?.from('clientes').select('*').eq('whatsapp', whatsapp).single(),
  upsert: (data) => supabase?.from('clientes').upsert(data, { onConflict: 'whatsapp' }).select().single(),
  create: (data) => supabase?.from('clientes').insert(data).select().single(),
  update: (id, data) => supabase?.from('clientes').update(data).eq('id', id).select().single(),
  updateNotas: (id, notas) => supabase?.from('clientes').update({ notas }).eq('id', id).select().single(),
  delete: (id) => supabase?.from('clientes').delete().eq('id', id),
}

// ── Reservas por cliente ────────────────────────────────────────────────────────
export const reservasClienteApi = {
  getByCliente: (clienteId, whatsapp) =>
    supabase?.from('reservas')
      .select('*, excursiones(nombre, destino)')
      .or(`cliente_id.eq.${clienteId},cliente_whatsapp.eq.${whatsapp}`)
      .order('fecha', { ascending: false }),
}

// ── Pagos ──────────────────────────────────────────────────────────────────────
export const pagosApi = {
  getByCliente: (clienteId) =>
    supabase?.from('pagos').select('*, reservas(fecha, excursion_id, excursiones(nombre))').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
  getByReserva: (reservaId) =>
    supabase?.from('pagos').select('*').eq('reserva_id', reservaId).order('created_at'),
  create: (data) => supabase?.from('pagos').insert(data).select().single(),
}

// ── Actividad clientes ─────────────────────────────────────────────────────────
export const actividadApi = {
  getByCliente: (clienteId) =>
    supabase?.from('actividad_clientes').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
  registrar: (data) => supabase?.from('actividad_clientes').insert(data).select().single(),
}

// ── Notas clientes ─────────────────────────────────────────────────────────────
export const notasClienteApi = {
  getByCliente: (clienteId) =>
    supabase?.from('notas_clientes').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
  create: (data) => supabase?.from('notas_clientes').insert(data).select().single(),
  delete: (id) => supabase?.from('notas_clientes').delete().eq('id', id),
}

// ── Conversaciones ─────────────────────────────────────────────────────────────
export const conversacionesApi = {
  getAll: () => supabase?.from('conversaciones').select('*').order('ultimo_mensaje_at', { ascending: false }),
  marcarLeida: (id) => supabase?.from('conversaciones').update({ no_leidos: 0 }).eq('id', id),
  updateEtiqueta: (id, etiqueta) => supabase?.from('conversaciones').update({ etiqueta }).eq('id', id),
}

// ── Mensajes ───────────────────────────────────────────────────────────────────
export const mensajesApi = {
  getByConversacion: (id) => supabase?.from('mensajes').select('*').eq('conversacion_id', id).order('created_at'),
}

// ── Enviar WhatsApp via Edge Function ──────────────────────────────────────────
export async function enviarWhatsApp({ phone, message, nombre, conversacionId }) {
  if (!supabase) return { error: 'Sin conexión' }
  const { data, error } = await supabase.functions.invoke('send-whatsapp', {
    body: { phone, message, nombre, conversacion_id: conversacionId },
  })
  return { data, error }
}

// ── Sincronizar conversaciones históricas desde Evolution API ──────────────────
export async function sincronizarWhatsApp() {
  if (!supabase) return { error: 'Sin conexión' }
  const { data, error } = await supabase.functions.invoke('sync-whatsapp', {})
  return { data, error }
}

// ── Movimientos de caja ────────────────────────────────────────────────────────
export const movimientosApi = {
  getAll: () => supabase?.from('movimientos_caja').select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false }),
  create: (data) => supabase?.from('movimientos_caja').insert(data).select().single(),
  update: (id, data) => supabase?.from('movimientos_caja').update(data).eq('id', id).select().single(),
  delete: (id) => supabase?.from('movimientos_caja').delete().eq('id', id),
}

// ── Costos por excursión ───────────────────────────────────────────────────────
export const costosExcursionApi = {
  getAll: () => supabase?.from('costos_excursion').select('*').eq('activo', true).order('concepto'),
  getByExcursion: (excursionId) => supabase?.from('costos_excursion').select('*').eq('excursion_id', excursionId).eq('activo', true),
  create: (data) => supabase?.from('costos_excursion').insert(data).select().single(),
  update: (id, data) => supabase?.from('costos_excursion').update(data).eq('id', id).select().single(),
  delete: (id) => supabase?.from('costos_excursion').update({ activo: false }).eq('id', id),
}

// ── Conceptos de movimiento (Finanzas) ───────────────────────────────────────────
export const conceptosApi = {
  getAll: () => supabase?.from('conceptos_movimiento').select('*').order('nombre'),
  create: (data) => supabase?.from('conceptos_movimiento').insert(data).select().single(),
  update: (id, data) => supabase?.from('conceptos_movimiento').update(data).eq('id', id).select().single(),
  delete: (id) => supabase?.from('conceptos_movimiento').delete().eq('id', id),
}

// ── Usuarios del panel admin ─────────────────────────────────────────────────────
// La tabla usuarios_admin tiene RLS activado sin políticas (bloqueada
// para anon) — todo el acceso pasa por la Edge Function usuarios-admin,
// que usa la service_role key del lado del servidor.
async function invocarUsuariosAdmin(action, body = {}) {
  if (!supabase) return { ok: false, error: 'Sin conexión' }
  const { data, error } = await supabase.functions.invoke('usuarios-admin', { body: { action, ...body } })
  if (error) return { ok: false, error: error.message }
  return data
}

export const usuariosAdminApi = {
  login: (email, password_hash) => invocarUsuariosAdmin('login', { email, password_hash }),
  getAll: () => invocarUsuariosAdmin('list'),
  create: (data) => invocarUsuariosAdmin('create', data),
  update: (id, data) => invocarUsuariosAdmin('update', { id, data }),
  delete: (id) => invocarUsuariosAdmin('delete', { id }),
}

// Hash de contraseña (SHA-256) para no guardarla ni compararla en texto plano.
export async function hashPassword(texto) {
  const datos = new TextEncoder().encode(texto)
  const buffer = await crypto.subtle.digest('SHA-256', datos)
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Propuestas de paquetes ──────────────────────────────────────────────────────
export const propuestasApi = {
  getAll: () => supabase?.from('propuestas').select('*').order('created_at', { ascending: false }),
  getByEstado: (estado) => supabase?.from('propuestas').select('*').eq('estado', estado).order('created_at', { ascending: false }),
  create: (data) => supabase?.from('propuestas').insert(data).select().single(),
  update: (id, data) => supabase?.from('propuestas').update(data).eq('id', id).select().single(),
  actualizarEstado: (id, estado) => supabase?.from('propuestas').update({
    estado,
    cerrada_at: estado === 'enviada' ? null : new Date().toISOString(),
  }).eq('id', id).select().single(),
  delete: (id) => supabase?.from('propuestas').delete().eq('id', id),
}
