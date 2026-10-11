import { createClient } from '@supabase/supabase-js'
import { cabeceraPanel, tokenPorVencer } from './sesionPanel.js'

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
    // No todos los paseos se cobran por persona (ej. Buggy/Jet Ski/Quad son
    // por vehículo) — default 'persona' cubre tanto los paquetes/traslados
    // viejos como una base que todavía no corrió la migración de esta columna.
    precioUnidad: e.precio_unidad || 'persona',
  }
}

// ── Excursiones ────────────────────────────────────────────────────────────────
// getAll/getById siguen directo (lectura pública, la usa el catálogo del sitio). Solo
// crear/editar/borrar pasa por catalogo-interno.
export const excursionesApi = {
  getAll: () => supabase?.from('excursiones').select('*').eq('activa', true).order('nombre'),
  getById: (id) => supabase?.from('excursiones').select('*').eq('id', id).single(),
  create: (data) => invocarCatalogoInterno('excursiones', 'create', { data }),
  update: (id, data) => invocarCatalogoInterno('excursiones', 'update', { id, data }),
  delete: (id) => invocarCatalogoInterno('excursiones', 'delete', { id }),
}

// Mantiene sincronizados los contadores "cacheados" que dependen de las
// reservas (clientes.cantidad_reservas, excursiones.cupos_disponibles).
// Centralizado acá para que cualquier lugar que cree/borre/cancele una
// reserva los actualice automáticamente, sin tener que acordarse en cada
// pantalla — así fue como total_gastado y estos dos quedaron desincronizados
// antes de este fix.
//
// ajustarCuposDisponibles pasa por una función de la base (RPC, security definer) en vez de
// leer+escribir la tabla directo: así puede ajustar el cupo sin sesión, para cuando la llama
// una reserva pública (Reservar.jsx, ExcursionDetalle.jsx) — sin abrir el UPDATE de
// excursiones entero a cualquiera. ajustarCantidadReservas sí necesita sesión (pasa por
// catalogo-interno), pero eso nunca es un problema: una reserva pública siempre tiene
// cliente_id vacío (no crea ni vincula un cliente), así que esta función no se llega a usar
// para esas.
async function ajustarCantidadReservas(clienteId, delta) {
  if (!supabase || !clienteId || !delta) return
  const { data } = await invocarCatalogoInterno('clientes', 'list', { filtros: { id: clienteId } })
  const cliente = data?.[0]
  if (!cliente) return
  const nuevo = Math.max((cliente.cantidad_reservas || 0) + delta, 0)
  await invocarCatalogoInterno('clientes', 'update', { id: clienteId, data: { cantidad_reservas: nuevo } })
}

async function ajustarCuposDisponibles(excursionId, delta) {
  if (!supabase || !excursionId || !delta) return
  await supabase.rpc('ajustar_cupos_excursion', { p_excursion_id: excursionId, p_delta: delta })
}

// ── Reservas ───────────────────────────────────────────────────────────────────
// Leer/editar/borrar una reserva es solo admin (catalogo-interno). Crear una es distinto
// según quién la haga: desde el panel usa `create` (misma función, con sesión); desde el sitio
// público (sin sesión) usa `crearPublica`, que entra por un INSERT abierto de RLS en vez de
// catalogo-interno, y no pide la fila de vuelta (leer reservas es solo admin) — ya tiene en
// `data` todo lo que necesita mostrar.
export const reservasApi = {
  getAll: () => invocarCatalogoInterno('reservas', 'list'),
  getByWhatsapp: (whatsapp) => invocarCatalogoInterno('reservas', 'list', { filtros: { cliente_whatsapp: whatsapp } }),
  // Operaciones en curso (Francisco): todo lo que no sea de un día ya pasado y no esté cancelado.
  getEnCursoDesde: (fecha) => invocarCatalogoInterno('reservas', 'list', {
    filtros: { fecha: { op: 'gte', valor: fecha }, estado: { op: 'neq', valor: 'cancelada' } },
  }),
  // Para saber si cada cliente es de paquetes, de paseos o de las dos cosas: antes pedía
  // solo un puñado de columnas; ahora viaja el mismo select que el resto (un poco más
  // pesado, pero evita sumar otra combinación al catálogo de la función).
  getCategoriasPorCliente: () => invocarCatalogoInterno('reservas', 'list'),
  create: async (data) => {
    const result = await invocarCatalogoInterno('reservas', 'create', { data })
    const r = result?.data
    if (r) {
      await ajustarCantidadReservas(r.cliente_id, 1)
      if (r.estado !== 'cancelada') await ajustarCuposDisponibles(r.excursion_id, -(r.personas || 0))
    }
    return result
  },
  crearPublica: async (data) => {
    const { error } = await supabase?.from('reservas').insert(data) || {}
    if (!error) {
      await ajustarCantidadReservas(data.cliente_id, 1)
      if (data.estado !== 'cancelada') await ajustarCuposDisponibles(data.excursion_id, -(data.personas || 0))
    }
    return { error }
  },
  updateEstado: async (id, estado) => {
    const { data: lista } = await invocarCatalogoInterno('reservas', 'list', { filtros: { id } })
    const antes = lista?.[0]
    const result = await invocarCatalogoInterno('reservas', 'update', { id, data: { estado } })
    if (antes && antes.estado !== estado) {
      if (estado === 'cancelada') await ajustarCuposDisponibles(antes.excursion_id, antes.personas || 0)
      else if (antes.estado === 'cancelada') await ajustarCuposDisponibles(antes.excursion_id, -(antes.personas || 0))
    }
    return result
  },
  updatePago: (id, pagado) => invocarCatalogoInterno('reservas', 'update', { id, data: { pagado } }),
  updateCostoOperativo: (id, { costo_operativo, costo_operativo_moneda, costo_operativo_detalle }) =>
    invocarCatalogoInterno('reservas', 'update', { id, data: { costo_operativo, costo_operativo_moneda, costo_operativo_detalle } }),
  updateAsignacion: (id, data) => invocarCatalogoInterno('reservas', 'update', { id, data }),
  delete: async (id) => {
    const { data: lista } = await invocarCatalogoInterno('reservas', 'list', { filtros: { id } })
    const antes = lista?.[0]
    const result = await invocarCatalogoInterno('reservas', 'delete', { id })
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
  getById: (id) => supabase?.from('leads').select('*').eq('id', id).single(),
  getByWhatsapp: (whatsapp) => supabase?.from('leads').select('*').eq('whatsapp', whatsapp).maybeSingle(),
  create: (data) => supabase?.from('leads').insert(data).select().single(),
  // Sin notas (null/undefined) solo cambia el estado: antes se guardaba notas = null
  // y arrastrar una tarjeta entre columnas del tablero borraba las notas del lead.
  // razonPerdida: el motivo elegido en el combo al mover a mano a una etapa perdida.
  updateEstado: (id, estado, notas, razonPerdida) => supabase?.from('leads').update({
    estado,
    ...(notas != null ? { notas } : {}),
    ...(razonPerdida ? { razon_perdida: razonPerdida } : {}),
  }).eq('id', id).select().single(),
  update: (id, data) => supabase?.from('leads').update(data).eq('id', id).select().single(),
  delete: (id) => supabase?.from('leads').delete().eq('id', id),
}

// Etapas del embudo de ventas (Leads). leads.estado guarda la clave de la etapa.
// Automatizaciones por etapa: se cumplen en la base cuando un lead entra a la etapa
export const embudoAutoApi = {
  getAll: () => invocarCatalogoInterno('embudo_automatizaciones', 'list'),
  create: (data) => invocarCatalogoInterno('embudo_automatizaciones', 'create', { data }),
  update: (id, data) => invocarCatalogoInterno('embudo_automatizaciones', 'update', { id, data }),
  delete: (id) => invocarCatalogoInterno('embudo_automatizaciones', 'delete', { id }),
}

export const embudoApi = {
  getAll: () => invocarCatalogoInterno('embudo_etapas', 'list'),
  create: (data) => invocarCatalogoInterno('embudo_etapas', 'create', { data }),
  update: (clave, data) => invocarCatalogoInterno('embudo_etapas', 'update', { id: clave, data }),
  delete: (clave) => invocarCatalogoInterno('embudo_etapas', 'delete', { id: clave }),
}

// ── Recordatorios de seguimiento (leads) ─────────────────────────────────────────
export const recordatoriosApi = {
  getPendientes: () => supabase?.from('recordatorios').select('*').eq('completado', false).order('fecha'),
  getByLead: (leadId) => supabase?.from('recordatorios').select('*').eq('lead_id', leadId).order('fecha'),
  create: (data) => supabase?.from('recordatorios').insert(data).select().single(),
  completar: (id, completado) => supabase?.from('recordatorios').update({ completado }).eq('id', id).select().single(),
  delete: (id) => supabase?.from('recordatorios').delete().eq('id', id),
}

// ── Hospedajes ─────────────────────────────────────────────────────────────────
// getAll/getById/getDestinos siguen hablando directo a la tabla: la lectura es pública (la
// usan las páginas de hoteles del sitio). Solo escribir pasa por catalogo-interno.
export const hospedajesApi = {
  getAll: () => supabase?.from('hospedajes').select('*').eq('activa', true).order('nombre'),
  getById: (id) => supabase?.from('hospedajes').select('*').eq('id', id).single(),
  create: (data) => invocarCatalogoInterno('hospedajes', 'create', { data }),
  update: (id, data) => invocarCatalogoInterno('hospedajes', 'update', { id, data }),
  delete: (id) => invocarCatalogoInterno('hospedajes', 'delete', { id }),
  // Destinos ya usados en el catálogo, para el combo "elegir o agregar nuevo"
  // del formulario de alta.
  getDestinos: async () => {
    const { data, error } = await supabase?.from('hospedajes').select('destino') || {}
    if (error || !data) return []
    return Array.from(new Set(data.map(h => h.destino).filter(Boolean))).sort()
  },
}

// ── Propietario de un hospedaje o de un tipo de habitación puntual (uso interno,
//    tabla separada a propósito: el sitio público lee `hospedajes` y
//    `hospedaje_habitaciones` con select('*') y esto nunca debe filtrarse ahí —
//    ver supabase/migrations/20260830_hospedajes_propietarios.sql y
//    20260830b_propietarios_por_habitacion.sql). Un complejo con departamentos
//    de distintos dueños (ej: Cupe Beach Living) usa el dueño por habitación
//    en vez de por hospedaje. ──
// Sin lectura pública a propósito (tiene el contacto del dueño) — las cuatro funciones
// pasan por catalogo-interno, que ya exige sesión del panel.
async function buscarPropietario(filtro) {
  const { data } = await invocarCatalogoInterno('hospedajes_propietarios', 'list', { filtros: filtro })
  return data?.[0] || null
}
export const propietariosApi = {
  getByHospedaje: async (hospedajeId) => ({ data: await buscarPropietario({ hospedaje_id: hospedajeId }), error: null }),
  getByHabitacion: async (habitacionId) => ({ data: await buscarPropietario({ habitacion_id: habitacionId }), error: null }),
  // No usamos .upsert(): el índice único de esta tabla es parcial (hospedaje_id
  // O habitacion_id, nunca los dos) y PostgREST no puede resolver el ON CONFLICT
  // contra un índice parcial ("no unique or exclusion constraint matching").
  // Por eso primero buscamos y después update/insert a mano.
  upsertHospedaje: async (hospedajeId, { nombre_dueno, contacto_dueno }) => {
    const existente = await buscarPropietario({ hospedaje_id: hospedajeId })
    if (existente) return invocarCatalogoInterno('hospedajes_propietarios', 'update', { id: existente.id, data: { nombre_dueno, contacto_dueno } })
    return invocarCatalogoInterno('hospedajes_propietarios', 'create', { data: { hospedaje_id: hospedajeId, habitacion_id: null, nombre_dueno, contacto_dueno } })
  },
  upsertHabitacion: async (habitacionId, { nombre_dueno, contacto_dueno }) => {
    const existente = await buscarPropietario({ habitacion_id: habitacionId })
    if (existente) return invocarCatalogoInterno('hospedajes_propietarios', 'update', { id: existente.id, data: { nombre_dueno, contacto_dueno } })
    return invocarCatalogoInterno('hospedajes_propietarios', 'create', { data: { habitacion_id: habitacionId, hospedaje_id: null, nombre_dueno, contacto_dueno } })
  },
}

// ── Habitaciones de un hospedaje (tipos: Estándar, Superior, etc. — o, en un
//    complejo de departamentos de distintos dueños, cada departamento) ─────────
// getByHospedaje sigue directo (lectura pública, la arma la página del hotel). El resto
// escribe, pasa por catalogo-interno.
export const habitacionesApi = {
  getByHospedaje: (hospedajeId) => supabase?.from('hospedaje_habitaciones').select('*').eq('hospedaje_id', hospedajeId).order('nombre'),
  create: (data) => invocarCatalogoInterno('hospedaje_habitaciones', 'create', { data }),
  update: (id, data) => invocarCatalogoInterno('hospedaje_habitaciones', 'update', { id, data }),
  createMany: (filas) => invocarCatalogoInterno('hospedaje_habitaciones', 'create', { data: filas }),
  delete: (id) => invocarCatalogoInterno('hospedaje_habitaciones', 'delete', { id }),
  deleteByHospedaje: (hospedajeId) => invocarCatalogoInterno('hospedaje_habitaciones', 'delete', { filtros: { hospedaje_id: hospedajeId } }),
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

// Documentos operativos de una propuesta cerrada (e-ticket del aereo, voucher
// del hospedaje) — misma logica que subirImagen pero en su propia carpeta,
// separada de las fotos de excursiones.
export async function subirDocumentoPropuesta(archivo, carpeta) {
  if (!supabase) return { url: null, error: 'Sin conexión' }
  const ext = archivo.name.split('.').pop()
  const path = `propuestas/${carpeta}/${Date.now()}.${ext}`
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

// ── Traslados (planilla: fecha, hora, destino, pasajeros y equipaje) ───────────
export const trasladosApi = {
  getAll: () => invocarCatalogoInterno('traslados', 'list'),
  create: (data) => invocarCatalogoInterno('traslados', 'create', { data }),
  update: (id, data) => invocarCatalogoInterno('traslados', 'update', { id, data }),
  delete: (id) => invocarCatalogoInterno('traslados', 'delete', { id }),
}

// ── Saldos que se cargan a mano en el perfil del cliente (después se conectan con el generador) ──
export const clientesSaldosApi = {
  getSaldos: (clienteId) => supabase?.from('cliente_saldos').select('*').eq('cliente_id', clienteId).order('created_at'),
  createSaldo: (data) => supabase?.from('cliente_saldos').insert(data).select().single(),
  updateSaldo: (id, data) => supabase?.from('cliente_saldos').update(data).eq('id', id).select().single(),
  deleteSaldo: (id) => supabase?.from('cliente_saldos').delete().eq('id', id),
}

// ── Anfitriona: hospedajes de cada lead y saldos cargados a mano ───────────────
export const anfitrionaApi = {
  getHospedajes: () => invocarCatalogoInterno('anfitriona_hospedajes', 'list'),
  createHospedaje: (data) => invocarCatalogoInterno('anfitriona_hospedajes', 'create', { data }),
  updateHospedaje: (id, data) => invocarCatalogoInterno('anfitriona_hospedajes', 'update', { id, data }),
  deleteHospedaje: (id) => invocarCatalogoInterno('anfitriona_hospedajes', 'delete', { id }),
  getSaldos: (leadId) => invocarCatalogoInterno('anfitriona_saldos', 'list', { filtros: { lead_id: leadId } }),
  createSaldo: (data) => invocarCatalogoInterno('anfitriona_saldos', 'create', { data }),
  updateSaldo: (id, data) => invocarCatalogoInterno('anfitriona_saldos', 'update', { id, data }),
  deleteSaldo: (id) => invocarCatalogoInterno('anfitriona_saldos', 'delete', { id }),
}

// ── Chat interno de operaciones (avisos a guía y chofer, sin pasar por Meta) ────
export const operacionesApi = {
  // Reemplaza la operación (si ya estaba cerrada) y sus avisos por los nuevos: al
  // volver a cerrar (cambió un chofer, por ejemplo) los mensajes viejos no quedan
  // colgados con datos desactualizados.
  cerrar: async ({ excursionId, fecha, guiaId, cerradaPor, avisos }) => {
    const { data: op, error } = await supabase
      ?.from('operaciones')
      .upsert({ excursion_id: excursionId, fecha, guia_id: guiaId, cerrada_por: cerradaPor, cerrada_at: new Date().toISOString() }, { onConflict: 'excursion_id,fecha' })
      .select().single()
    if (error || !op) return { error }
    await supabase?.from('operaciones_avisos').delete().eq('operacion_id', op.id)
    const filas = avisos.map(a => ({ ...a, operacion_id: op.id }))
    return supabase?.from('operaciones_avisos').insert(filas).select()
  },
  getAvisos: (excursionId, fecha) => supabase
    ?.from('operaciones')
    .select('id, operaciones_avisos(id, destinatario, guia_id, chofer_id, leido_at, confirmado_at)')
    .eq('excursion_id', excursionId).eq('fecha', fecha).maybeSingle(),
  // Todos los avisos de todas las operaciones, para la pantalla "Chat interno" del admin
  // (una conversación por guía/chofer con el historial completo)
  getTodosAvisos: () => supabase
    ?.from('operaciones_avisos')
    .select('*, operaciones(fecha, excursiones(nombre))')
    .order('created_at', { ascending: false }),
}

// La paginita pública del guía/chofer (sin sesión de admin: entra con su link personal)
export const panelOperativoApi = {
  getPorToken: (tabla, token) => supabase?.from(tabla).select('id, nombre, token').eq('token', token).maybeSingle(),
  getAvisos: (campo, id) => supabase?.from('operaciones_avisos').select('*, operaciones(fecha, excursiones(nombre))').eq(campo, id).order('created_at', { ascending: false }),
  marcarLeido: (id) => supabase?.from('operaciones_avisos').update({ leido_at: new Date().toISOString() }).eq('id', id).is('leido_at', null),
  marcarConfirmado: (id, confirmado) => supabase?.from('operaciones_avisos').update({ confirmado_at: confirmado ? new Date().toISOString() : null }).eq('id', id),
  // Notificaciones push (solo choferes, por ahora). Mismo criterio de acceso que el resto de
  // esta paginita: lo protege el token del link, no una sesión.
  getPush: (endpoint) => supabase?.from('chofer_push_subscripciones').select('id').eq('endpoint', endpoint).maybeSingle(),
  guardarPush: (choferId, sub) => supabase?.from('chofer_push_subscripciones')
    .upsert({ chofer_id: choferId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, { onConflict: 'endpoint' }),
  sacarPush: (endpoint) => supabase?.from('chofer_push_subscripciones').delete().eq('endpoint', endpoint),
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
// Sin lectura pública a propósito (datos personales) — las 7 funciones pasan por
// catalogo-interno. getById/getByWhatsapp devuelven null en vez de un error cuando no
// encuentran nada (antes usaban .single(), que tira error con 0 filas) — ningún llamador
// miraba ese error, todos chequean solo si vino data, así que el cambio no afecta a nadie.
export const clientesApi = {
  getAll: () => invocarCatalogoInterno('clientes', 'list'),
  getById: (id) => invocarCatalogoInterno('clientes', 'list', { filtros: { id } }).then((r) => ({ data: r.data?.[0] || null, error: r.error })),
  getByWhatsapp: (whatsapp) => invocarCatalogoInterno('clientes', 'list', { filtros: { whatsapp } }).then((r) => ({ data: r.data?.[0] || null, error: r.error })),
  upsert: (data) => invocarCatalogoInterno('clientes', 'upsert', { data }),
  create: (data) => invocarCatalogoInterno('clientes', 'create', { data }),
  update: (id, data) => invocarCatalogoInterno('clientes', 'update', { id, data }),
  updateNotas: (id, notas) => invocarCatalogoInterno('clientes', 'update', { id, data: { notas } }),
  delete: (id) => invocarCatalogoInterno('clientes', 'delete', { id }),
}

// ── Comprobantes de "PDF de cierre enviado" ─────────────────────────────────────
// Tarjetas fantasma del tablero de Paquetes (ver leads_redirigir_anfitriona en la
// migración 20261011100000): no son leads, solo un registro de que se mandó el PDF.
// La limpieza de más de 24hs la hace un cron en la base; acá además se filtra por
// las dudas (ej. si el cron todavía no corrió esa hora).
export const leadsPdfCierreRegistroApi = {
  getRecientes: () => {
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    return invocarCatalogoInterno('leads_pdf_cierre_registro', 'list', { filtros: { creado_at: { op: 'gte', valor: desde } } })
  },
}

// ── Reservas por cliente ────────────────────────────────────────────────────────
export const reservasClienteApi = {
  // catalogo-interno siempre ordena "reservas" por fecha ascendente (lo que necesita Reservas.jsx);
  // acá hace falta al revés (la más reciente primero), así que se reordena del lado del
  // cliente — son pocas filas, las de un solo cliente, no hace falta pedirle otro orden a la función.
  getByCliente: async (clienteId, whatsapp) => {
    const res = await invocarCatalogoInterno('reservas', 'list', { o: `cliente_id.eq.${clienteId},cliente_whatsapp.eq.${whatsapp}` })
    if (res.data) res.data = [...res.data].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
    return res
  },
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
  asignar: (id, usuarioId) => supabase?.from('conversaciones').update({ asignado_a: usuarioId }).eq('id', id),
  // Mover a mano a otro embudo (Paquetes/Paseos): el lead se mueve aparte, ver leadsApi.updateEstado
  cambiarGrupo: (id, grupo) => supabase?.from('conversaciones').update({ grupo }).eq('id', id),
  // Pausa (true) o vuelve a prender (false) el asistente automático en esa conversación
  pausarAsistente: (id, pausado) => supabase?.from('conversaciones').update({ bot_pausado: pausado }).eq('id', id),
  // Conversaciones esperando respuesta humana y desde cuándo (filas { conversacion_id, desde })
  sinResponder: () => supabase?.rpc('crm_sin_responder'),
  // "Marcar como atendida": cierra la espera sin mandar mensaje. La hora la pone
  // el servidor y la función la devuelve (data = atendida_at).
  marcarAtendida: (id, usuarioId) => supabase?.rpc('crm_marcar_atendida', { p_conversacion: id, p_usuario: usuarioId || null }),
  desmarcarAtendida: (id) => supabase?.from('conversaciones').update({ atendida_at: null, atendida_por: null }).eq('id', id),
}

// ── Mensajes ───────────────────────────────────────────────────────────────────
export const mensajesApi = {
  getByConversacion: (id) => supabase?.from('mensajes').select('*').eq('conversacion_id', id).order('created_at'),
}

// ── Enviar WhatsApp via Edge Function ──────────────────────────────────────────
export async function enviarWhatsApp({ phone, message, nombre, conversacionId, media, usuarioId }) {
  if (!supabase) return { error: 'Sin conexión' }
  await asegurarSesionPanel()
  const { data, error } = await supabase.functions.invoke('send-whatsapp', {
    body: { phone, message, nombre, conversacion_id: conversacionId, media, usuario_id: usuarioId || null },
    headers: cabeceraPanel(),
  })
  return { data, error }
}

// Sube un archivo del CRM al bucket privado: la función devuelve una URL de
// subida firmada de un solo uso (la clave pública no tiene permiso de escritura).
export async function subirAdjuntoCRM(conversacionId, file) {
  if (!supabase) return { error: new Error('Sin conexión') }
  await asegurarSesionPanel()
  const { data: prep, error } = await supabase.functions.invoke('send-whatsapp', {
    body: { accion: 'subida', conversacion_id: conversacionId, filename: file.name },
    headers: cabeceraPanel(),
  })
  if (error || !prep?.token) return { error: error || new Error(prep?.error || 'No se pudo preparar la subida') }
  const { error: errSubida } = await supabase.storage
    .from('whatsapp-media')
    .uploadToSignedUrl(prep.path, prep.token, file, { contentType: file.type || 'application/octet-stream' })
  if (errSubida) return { error: errSubida }
  return { path: prep.path }
}

// Adjunto de una respuesta rápida: se sube al mismo bucket con la misma función,
// bajo la carpeta "plantillas" en vez de la de una conversación. Al usar la
// respuesta en un chat se baja como archivo y sigue el camino normal de un
// adjunto (se sube a esa conversación al enviar), así el envío no cambia.
export function subirAdjuntoRespuesta(file) {
  return subirAdjuntoCRM('plantillas', file)
}

export async function urlAdjuntoRespuesta(path) {
  if (!supabase || !path) return null
  const { data, error } = await supabase.storage.from('whatsapp-media').createSignedUrl(path, 3600)
  return error ? null : data?.signedUrl || null
}

export async function bajarAdjuntoRespuesta(respuesta) {
  const url = await urlAdjuntoRespuesta(respuesta.adjunto_path)
  if (!url) return null
  try {
    const blob = await (await fetch(url)).blob()
    return new File([blob], respuesta.adjunto_nombre || 'archivo', { type: respuesta.adjunto_mime || blob.type })
  } catch {
    return null
  }
}

// ── Descargar una imagen server-side y devolverla como data URI ────────────────
// (evita el bloqueo de CORS de html2canvas con imagenes de otros dominios)
export async function convertirImagenABase64(url) {
  if (!supabase) return { error: 'Sin conexión' }
  const { data, error } = await supabase.functions.invoke('proxy-imagen', {
    body: { url },
    headers: cabeceraPanel(),
  })
  return { data, error }
}

// ── Importar hospedajes desde un link de cotización (Niara) ────────────────────
export async function importarHospedajesDeLink(url) {
  if (!supabase) return { error: 'Sin conexión' }
  const { data, error } = await supabase.functions.invoke('import-hospedaje-link', {
    body: { url },
    headers: cabeceraPanel(),
  })
  return { data, error }
}

// ── Extraer datos de vuelo desde una imagen (captura, e-ticket, etc.) ──────────
export async function extraerDatosVuelo(imagenBase64, mediaType) {
  if (!supabase) return { error: 'Sin conexión' }
  // Probado en vivo: Gemini a veces se cuelga mucho mas de lo normal (un caso
  // real tardó 150s, el limite de idle-timeout de la Edge Function, antes de
  // devolver el error) — sin este timeout el cliente se quedaba esperando esos
  // 150s enteros antes de poder reintentar. 30s resultó demasiado ajustado:
  // probado en vivo, una imagen con bastante texto (captura real de itinerario)
  // tarda ~30-35s en responder — el cliente cortaba la conexion justo antes de
  // que llegara la respuesta y lo trataba como "saturado", agotando los 8
  // reintentos sin que ninguno llegara a tiempo. 60s da el margen real que
  // necesita una imagen con contenido, sin llegar a esperar los 150s del peor caso.
  const { data, error } = await supabase.functions.invoke('extraer-datos-vuelo', {
    body: { imagenBase64, mediaType },
    headers: cabeceraPanel(),
    timeout: 60000,
  })
  if (!error) return { data, error }
  // Cuando la Edge Function responde con un status distinto de 2xx (ej: 429 de
  // Gemini saturado), el cliente de Supabase descarta el cuerpo de la respuesta
  // y solo deja un mensaje generico ("Edge Function returned a non-2xx status
  // code") en error.message — el mensaje real que mandamos desde el servidor
  // queda en error.context, que es la Response cruda sin leer todavia.
  if (error?.context?.json) {
    try {
      const cuerpo = await error.context.clone().json()
      if (cuerpo?.error) return { data: { error: cuerpo.error, rateLimited: error.context.status === 429 }, error }
    } catch (_) { /* sin cuerpo legible, seguimos abajo */ }
  }
  // Si no se pudo leer un cuerpo con un mensaje propio (ej: la invocacion se
  // cortó por un timeout de infraestructura antes de llegar a nuestro código,
  // Gemini puede demorar bastante bajo carga), lo tratamos igual que un
  // 429 -- reintentable -- en vez de rendirnos y mostrarle al usuario el
  // mensaje generico en inglés del SDK.
  return { data: { error: 'El lector de imágenes está saturado en este momento — esperá unos segundos y probá de nuevo.', rateLimited: true }, error }
}

// ── Sincronizar conversaciones históricas desde Evolution API ──────────────────
export async function sincronizarWhatsApp() {
  if (!supabase) return { error: 'Sin conexión' }
  const { data, error } = await supabase.functions.invoke('sync-whatsapp', { headers: cabeceraPanel() })
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
  getAll: () => invocarCatalogoInterno('costos_excursion', 'list', { filtros: { activo: true } }),
  getByExcursion: (excursionId) => invocarCatalogoInterno('costos_excursion', 'list', { filtros: { excursion_id: excursionId, activo: true } }),
  create: (data) => invocarCatalogoInterno('costos_excursion', 'create', { data }),
  update: (id, data) => invocarCatalogoInterno('costos_excursion', 'update', { id, data }),
  // Baja lógica (activo: false), no se borra la fila — igual que antes.
  delete: (id) => invocarCatalogoInterno('costos_excursion', 'update', { id, data: { activo: false } }),
}

// ── Conceptos de movimiento (Finanzas) ───────────────────────────────────────────
export const conceptosApi = {
  getAll: () => invocarCatalogoInterno('conceptos_movimiento', 'list'),
  create: (data) => invocarCatalogoInterno('conceptos_movimiento', 'create', { data }),
  update: (id, data) => invocarCatalogoInterno('conceptos_movimiento', 'update', { id, data }),
  delete: (id) => invocarCatalogoInterno('conceptos_movimiento', 'delete', { id }),
}

// ── Respuestas rápidas (CRM WhatsApp) ────────────────────────────────────────────
export const respuestasRapidasApi = {
  getAll: () => invocarCatalogoInterno('respuestas_rapidas', 'list'),
  create: (data) => invocarCatalogoInterno('respuestas_rapidas', 'create', { data }),
  update: (id, data) => invocarCatalogoInterno('respuestas_rapidas', 'update', { id, data }),
  delete: (id) => invocarCatalogoInterno('respuestas_rapidas', 'delete', { id }),
}

// ── Métricas del CRM para el Dashboard ───────────────────────────────────────────
// crm_metricas devuelve todo en un JSON; desde/hasta son instantes ISO (el límite
// de "hoy" se calcula en la zona horaria del navegador, no en UTC).
export const crmMetricasApi = {
  get: (desde, hasta, tz = 'America/Bahia') => supabase?.rpc('crm_metricas', { p_desde: desde, p_hasta: hasta, p_tz: tz }),
}

// Tarifas (BRL) con las que se estima el gasto en mensajes; son editables.
// Reemplazadas por el cobro por país (ver tarifasPaisApi) desde que Meta cambió a cobrar
// por mensaje según el país del destinatario (vigente desde el 1/10/2026); se deja esta
// API por si hace falta consultar el historial viejo.
export const tarifasMensajeApi = {
  getAll: () => supabase?.from('tarifas_mensaje').select('*').order('valor'),
  update: (cobro, valor) => supabase?.from('tarifas_mensaje').update({ valor }).eq('cobro', cobro).select().single(),
}

// Precio por mensaje según el país del destinatario (USD) y la configuración general
// del cobro de WhatsApp (cotización a reales y cuántos mensajes por número y por mes
// calendario son gratis). Editables desde el Dashboard.
export const tarifasPaisApi = {
  getAll: () => supabase?.from('tarifas_pais_whatsapp').select('*').order('orden'),
  update: (pais, valorUsd) => supabase?.from('tarifas_pais_whatsapp').update({ valor_usd: valorUsd }).eq('pais', pais).select().single(),
}
export const configCostosApi = {
  get: () => supabase?.from('config_costos_whatsapp').select('*').eq('id', 1).maybeSingle(),
  update: (data) => supabase?.from('config_costos_whatsapp').update(data).eq('id', 1).select().single(),
}

// ── Asistente automático del CRM (menú Paquetes / Paseos + reparto en turnos) ───
export const botApi = {
  getConfig: () => supabase?.from('bot_config').select('*').eq('id', 1).maybeSingle(),
  saveConfig: (data) => supabase?.from('bot_config').update(data).eq('id', 1).select().single(),
  getReparto: () => supabase?.from('bot_reparto').select('*'),
  addMiembro: (grupo, usuarioId) => supabase?.from('bot_reparto').insert({ grupo, usuario_id: usuarioId }).select().single(),
  removeMiembro: (id) => supabase?.from('bot_reparto').delete().eq('id', id),
}

// ── Entrenar al asistente (solo Cristian y Abril — ver src/lib/entrenamiento.js) ──
export const sinonimosApi = {
  getAll: () => supabase?.from('asistente_sinonimos').select('*').order('created_at', { ascending: false }),
  create: (data) => supabase?.from('asistente_sinonimos').insert(data).select().single(),
  delete: (id) => supabase?.from('asistente_sinonimos').delete().eq('id', id),
}

export const bitacoraApi = {
  getAll: () => supabase?.from('asistente_bitacora').select('*').order('created_at', { ascending: false }).limit(200),
  registrar: (data) => supabase?.from('asistente_bitacora').insert(data),
}

// ── Usuarios del panel admin ─────────────────────────────────────────────────────
// La tabla usuarios_admin tiene RLS activado sin políticas (bloqueada
// para anon) — todo el acceso pasa por la Edge Function usuarios-admin,
// que usa la service_role key del lado del servidor.
async function invocarUsuariosAdmin(action, body = {}) {
  if (!supabase) return { ok: false, error: 'Sin conexión' }
  const { data, error } = await supabase.functions.invoke('usuarios-admin', { body: { action, ...body }, headers: cabeceraPanel() })
  if (error) return { ok: false, error: error.message }
  return data
}

// Catálogos internos chicos (sin datos de clientes ni de plata) que ya no se leen/escriben
// directo desde el navegador — pasan por la Edge Function catalogo-interno, que exige una
// sesión del panel vigente. Devuelve la misma forma {data, error} que supabase-js, para no
// tener que tocar el código que ya consume estas funciones.
async function invocarCatalogoInterno(tabla, accion, extra = {}) {
  if (!supabase) return { data: null, error: { message: 'Sin conexión' } }
  const { data: resp, error } = await supabase.functions.invoke('catalogo-interno', { body: { tabla, accion, ...extra }, headers: cabeceraPanel() })
  if (error) return { data: null, error: { message: error.message } }
  if (!resp.ok) return { data: null, error: { message: resp.error || 'Error desconocido' } }
  return { data: resp.datos ?? resp.dato ?? null, error: null }
}

// Guarda site_config (fila única, id=1). La lectura (SiteConfigContext) sigue siendo directa a
// la tabla porque es pública — la usa toda la web; solo escribir pasa por catalogo-interno.
export function guardarSiteConfig(updates) {
  return invocarCatalogoInterno('site_config', 'update', { id: 1, data: { ...updates, updated_at: new Date().toISOString() } })
}

// Renueva el token de la sesión del panel. Devuelve true si se renovó, false si el servidor
// rechazó la sesión (usuario dado de baja o pasaron 7 días) y null si no hubo respuesta.
export async function renovarSesionPanel() {
  if (!supabase) return null
  const { data, error } = await supabase.functions.invoke('usuarios-admin', { body: { action: 'renovar' }, headers: cabeceraPanel() })
  if (error) return error.context?.status === 401 ? false : null
  if (!data?.token) return null
  const sesion = JSON.parse(localStorage.getItem('admin_session') || '{}')
  localStorage.setItem('admin_session', JSON.stringify({ ...sesion, token: data.token }))
  return true
}

// Antes de mandar un mensaje, si el token está por vencer se renueva.
export async function asegurarSesionPanel() {
  return tokenPorVencer() ? renovarSesionPanel() : true
}

export const usuariosAdminApi = {
  login: (email, password_hash) => invocarUsuariosAdmin('login', { email, password_hash }),
  getAll: () => invocarUsuariosAdmin('list'),
  create: (data) => invocarUsuariosAdmin('create', data),
  update: (id, data) => invocarUsuariosAdmin('update', { id, data }),
  delete: (id) => invocarUsuariosAdmin('delete', { id }),
  permisos: () => invocarUsuariosAdmin('permisos'),
  guardarPermisos: (tipo, secciones) => invocarUsuariosAdmin('permisos_guardar', { tipo, secciones }),
  plantillas: () => invocarUsuariosAdmin('plantillas'),
  guardarPlantilla: (clave, texto) => invocarUsuariosAdmin('plantilla_guardar', { clave, texto }),
}

// Guarda en la sesión qué secciones ve cada tipo, para armar el menú y las rutas sin ir a la base en cada cambio de página.
export async function cargarPermisosSesion() {
  const { ok, permisos } = (await usuariosAdminApi.permisos()) || {}
  if (!ok || !permisos) return false
  const mapa = Object.fromEntries(permisos.map(p => [p.tipo, p.secciones || []]))
  const sesion = JSON.parse(localStorage.getItem('admin_session') || '{}')
  localStorage.setItem('admin_session', JSON.stringify({ ...sesion, permisos: mapa }))
  return true
}

// Hash de contraseña (SHA-256) para no guardarla ni compararla en texto plano.
export async function hashPassword(texto) {
  const datos = new TextEncoder().encode(texto)
  const buffer = await crypto.subtle.digest('SHA-256', datos)
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Propuestas de paquetes ──────────────────────────────────────────────────────
export const propuestasApi = {
  getAll: () => invocarCatalogoInterno('propuestas', 'list'),
  getByEstado: (estado) => invocarCatalogoInterno('propuestas', 'list', { filtros: { estado } }),
  getByWhatsapp: (whatsapp) => invocarCatalogoInterno('propuestas', 'list', { filtros: { cliente_whatsapp: whatsapp } }),
  create: (data) => invocarCatalogoInterno('propuestas', 'create', { data }),
  update: (id, data) => invocarCatalogoInterno('propuestas', 'update', { id, data }),
  actualizarEstado: (id, estado) => invocarCatalogoInterno('propuestas', 'update', {
    id,
    data: { estado, cerrada_at: (estado === 'cerrada' || estado === 'rechazada') ? new Date().toISOString() : null },
  }),
  delete: (id) => invocarCatalogoInterno('propuestas', 'delete', { id }),
}

// ── Videos de la agencia (sección reels de la Home) ──────────────────────────────
// getAll/getAllAdmin siguen hablando directo a la tabla: la lectura es pública (la usa la
// Home), la RLS la deja pasar sin sesión. Solo escribir pasa por catalogo-interno.
export const agenciaVideosApi = {
  getAll: () => supabase?.from('agencia_videos').select('*').eq('activo', true).order('orden'),
  getAllAdmin: () => supabase?.from('agencia_videos').select('*').order('orden'),
  create: (data) => invocarCatalogoInterno('agencia_videos', 'create', { data }),
  update: (id, data) => invocarCatalogoInterno('agencia_videos', 'update', { id, data }),
  delete: (id) => invocarCatalogoInterno('agencia_videos', 'delete', { id }),
}

async function subirArchivoAgenciaVideo(archivo, carpeta) {
  if (!supabase) return { url: null, error: 'Sin conexión' }
  const ext = archivo.name.split('.').pop()
  const path = `${carpeta}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('videos-agencia').upload(path, archivo)
  if (error) return { url: null, error: error.message }
  const { data } = supabase.storage.from('videos-agencia').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

export const subirVideoAgencia = (archivo) => subirArchivoAgenciaVideo(archivo, 'videos')
export const subirThumbnailVideoAgencia = (archivo) => subirArchivoAgenciaVideo(archivo, 'thumbnails')
export const subirVideoHospedaje = (archivo) => subirArchivoAgenciaVideo(archivo, 'hospedajes')
