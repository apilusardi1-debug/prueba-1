// Embudo en el que entra un lead según lo que contesta en el menú del asistente
// (Paquetes o Paseos). Un lead está en el embudo de su etapa, así que "entrar al
// embudo de Paseos" es pasarlo a la primera etapa de ese embudo. Las etapas
// usadas son las fijas del sistema (ver CLAVES_FIJAS en src/lib/embudo.js).

export const ETAPA_DE_ENTRADA: Record<string, string> = {
  paquetes: 'nuevo',
  paseos: 'paseos_contacto_inicial',
}

// Etapa a la que hay que pasar al lead, o null si no hay que moverlo. Solo se
// mueve mientras siga en una etapa de entrada: si alguien del equipo ya lo
// trabajó y lo dejó en otra etapa, no se toca.
export function etapaSegunGrupo(estadoActual: string | null | undefined, grupo: string | null): string | null {
  const destino = grupo ? ETAPA_DE_ENTRADA[grupo] : undefined
  if (!destino || estadoActual === destino) return null
  const enEntrada = !estadoActual || Object.values(ETAPA_DE_ENTRADA).includes(estadoActual)
  return enEntrada ? destino : null
}

// Pasa al lead de ese WhatsApp al embudo del grupo que eligió. Un fallo acá (por
// ejemplo, si todavía no está la etapa de Paseos) nunca debe frenar al asistente,
// por eso no lanza.
// deno-lint-ignore no-explicit-any
export async function enviarLeadAlEmbudoPorGrupo(supabase: any, whatsapp: string, grupo: string | null): Promise<void> {
  if (!grupo || !ETAPA_DE_ENTRADA[grupo]) return
  try {
    const { data: lead, error } = await supabase.from('leads').select('id, estado').eq('whatsapp', whatsapp).maybeSingle()
    if (error || !lead) return
    const destino = etapaSegunGrupo(lead.estado, grupo)
    if (!destino) return

    // Que la etapa exista: si no, el lead quedaría con una etapa que el tablero no conoce
    const { data: etapa } = await supabase.from('embudo_etapas').select('clave').eq('clave', destino).maybeSingle()
    if (!etapa) return

    // Solo si sigue donde lo leímos: si alguien lo movió a mano justo ahora, gana esa persona
    let consulta = supabase.from('leads').update({ estado: destino }).eq('id', lead.id)
    consulta = lead.estado ? consulta.eq('estado', lead.estado) : consulta.is('estado', null)
    const { error: errorUpdate } = await consulta
    if (errorUpdate) console.error('enviarLeadAlEmbudoPorGrupo update error:', errorUpdate)
  } catch (err) {
    console.error('enviarLeadAlEmbudoPorGrupo error:', err)
  }
}

// Mueve el lead de ese whatsapp a `claveDestino`, una etapa del embudo de
// Paquetes — pero solo hacia adelante. Puede avanzar desde una etapa ganada a
// otra ganada más avanzada (ej: de "Ya pagó" a "PDF de servicios enviado" —
// varias etapas ganadas seguidas es el diseño normal del embudo). Lo único que
// no se toca es un lead perdido, uno que ya esté en esa etapa o más adelante,
// o uno que esté en otro embudo (Paseos, Anfitriona). Sirve para cualquier
// paso automático de Paquetes: cada uno la llama con su propia etapa destino.
// deno-lint-ignore no-explicit-any
export async function moverAEtapaPaquetes(supabase: any, whatsapp: string, claveDestino: string): Promise<void> {
  try {
    const { data: lead, error } = await supabase.from('leads').select('id, estado').eq('whatsapp', whatsapp).maybeSingle()
    if (error || !lead) return

    const { data: etapaDestino } = await supabase.from('embudo_etapas').select('orden').eq('clave', claveDestino).maybeSingle()
    if (!etapaDestino) return

    // Sin etapa reconocida (lead nuevo sin estado todavía, o una clave que ya no
    // existe) se trata como si estuviera antes del destino: igual avanza.
    // "orden" solo se compara dentro del mismo embudo — si el lead está en
    // Paseos (o Anfitriona) su número de orden no tiene nada que ver con el de
    // Paquetes, así que ni se mira: se descarta directo por el embudo.
    const { data: etapaActual } = await supabase.from('embudo_etapas').select('orden, tipo, embudo').eq('clave', lead.estado).maybeSingle()
    if (etapaActual && (etapaActual.embudo !== 'paquetes' || etapaActual.tipo === 'perdida' || etapaActual.orden >= etapaDestino.orden)) return

    let consulta = supabase.from('leads').update({ estado: claveDestino }).eq('id', lead.id)
    consulta = lead.estado ? consulta.eq('estado', lead.estado) : consulta.is('estado', null)
    const { error: errorUpdate } = await consulta
    if (errorUpdate) console.error('moverAEtapaPaquetes update error:', { whatsapp, claveDestino, errorUpdate })
  } catch (err) {
    console.error('moverAEtapaPaquetes error:', err)
  }
}

// Cuando el filtro de Paquetes termina (por el formulario nativo o por texto,
// da igual) y el lead pasa a un asesor, ya está filtrado. No se llama cuando
// el filtro está apagado: ahí no hay nada que filtrar, sería falso llamarlo
// "Filtrado".
// deno-lint-ignore no-explicit-any
export function moverAFiltrado(supabase: any, whatsapp: string): Promise<void> {
  return moverAEtapaPaquetes(supabase, whatsapp, 'contactado')
}
