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
    await consulta
  } catch (err) {
    console.error('enviarLeadAlEmbudoPorGrupo error:', err)
  }
}
