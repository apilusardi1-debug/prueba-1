// Estado de entrega de los mensajes salientes de WhatsApp. Meta avisa por el
// webhook (statuses) enviado -> entregado -> leído, o fallido. Lo usan el
// webhook y la pantalla del CRM.

export type EstadoEnvio = 'enviado' | 'entregado' | 'leido' | 'fallido'

const DE_META: Record<string, EstadoEnvio> = {
  sent: 'enviado',
  delivered: 'entregado',
  read: 'leido',
  failed: 'fallido',
}

export function estadoDeMeta(status: string): EstadoEnvio | null {
  return DE_META[status] ?? null
}

// Estados que un estado nuevo puede pisar. Los avisos de Meta pueden llegar
// desordenados (p. ej. "leído" antes que "entregado"), así que nunca se
// retrocede: un mensaje leído no vuelve a figurar como entregado. Un fallo sí
// puede llegar después de "enviado" (Meta lo aceptó y luego no pudo entregarlo).
const PUEDE_PISAR: Record<EstadoEnvio, Array<EstadoEnvio | null>> = {
  enviado: [null],
  entregado: [null, 'enviado'],
  leido: [null, 'enviado', 'entregado'],
  fallido: [null, 'enviado'],
}

// Filtro "or" de PostgREST: solo actualiza filas cuyo estado actual se puede pisar.
export function filtroEstadosPrevios(nuevo: EstadoEnvio): string {
  return PUEDE_PISAR[nuevo]
    .map((e) => (e === null ? 'estado_envio.is.null' : `estado_envio.eq.${e}`))
    .join(',')
}

// Motivos de fallo más comunes de la Cloud API, en lenguaje del equipo.
const TEXTO_ERROR: Record<number, string> = {
  131047: 'Pasaron más de 24 horas desde el último mensaje del contacto. Hace falta una plantilla aprobada para retomar la conversación.',
  131026: 'No se pudo entregar: el número no tiene WhatsApp, no aceptó los términos o tiene la aplicación desactualizada.',
  131049: 'Meta no lo entregó para cuidar la calidad de los mensajes: suele pasar cuando el contacto ignoró mensajes anteriores.',
  131048: 'Meta frenó el envío por sospecha de spam en esta cuenta.',
  131056: 'Se enviaron demasiados mensajes seguidos a este mismo contacto. Esperá un momento y reintentá.',
  130429: 'Se superó el límite de envíos por segundo. Reintentá en un momento.',
  131053: 'Meta no pudo procesar el archivo adjunto (formato o tamaño no compatible).',
  131051: 'Ese tipo de mensaje no se puede enviar por WhatsApp.',
  131000: 'Error interno de Meta. Reintentá en unos minutos.',
  131016: 'El servicio de Meta no estaba disponible. Reintentá en unos minutos.',
}

export function textoErrorEnvio(codigo?: number | null, detalle?: string | null): string {
  if (codigo && TEXTO_ERROR[codigo]) return TEXTO_ERROR[codigo]
  const extra = detalle ? `: ${detalle}` : ''
  return `Meta no pudo entregar el mensaje${codigo ? ` (código ${codigo})` : ''}${extra}`
}
