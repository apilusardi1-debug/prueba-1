// Reglas de los avisos de mensaje nuevo del CRM: a quién le suena cada cosa.
// Son funciones puras (sin sonido ni notificaciones) para poder probarlas solas.
//
// `conv` es lo último que se sabe de la conversación: asignado_a, bot_estado,
// contacto_nombre y whatsapp. `yoId` es el id de la persona de este navegador
// (puede ser null si su email no figura entre los usuarios del panel).

export function nombreDe(conv) {
  return conv?.contacto_nombre || conv?.whatsapp || 'contacto'
}

export function recortar(texto, max = 110) {
  const limpio = String(texto ?? '').replace(/\s+/g, ' ').trim()
  return limpio.length > max ? `${limpio.slice(0, max - 1)}…` : limpio
}

// Llegó un mensaje del contacto.
//  - Conversación asignada a mí: me avisa a mí y a nadie más.
//  - Sin asignar: avisa a todos, salvo mientras el asistente automático espera
//    que el contacto elija Paquetes o Paseos (ahí todavía no le toca a nadie:
//    cuando lo derive, avisa a quien corresponda).
export function avisoPorMensaje(conv, texto, yoId) {
  if (!conv) return null
  const nombre = nombreDe(conv)
  if (conv.asignado_a) {
    return yoId && conv.asignado_a === yoId ? { titulo: `Mensaje de ${nombre}`, cuerpo: texto } : null
  }
  if (conv.bot_estado === 'esperando') return null
  return { titulo: `Sin asignar: ${nombre}`, cuerpo: texto }
}

// El asistente derivó una conversación. Solo avisa a la persona elegida y solo
// en el momento de la derivación (no cuando alguien asigna a mano).
export function avisoPorDerivacion(anterior, nueva, yoId) {
  if (!yoId || nueva?.asignado_a !== yoId || nueva?.bot_estado !== 'derivado') return null
  if (anterior?.bot_estado === 'derivado') return null
  return { titulo: `Te derivaron a ${nombreDe(nueva)}`, cuerpo: 'El asistente te asignó esta conversación.' }
}
