// Etiquetas que el asistente automático le pone al lead según por dónde entró
// (como la etiqueta "ENTRO POR PASEOS" que usaban en Kommo).

export const ETIQUETA_POR_GRUPO: Record<string, string> = {
  paquetes: 'Entró por paquetes',
  paseos: 'Entró por paseos',
}

// Devuelve la lista con la etiqueta agregada, o null si ya la tenía (sin
// distinguir mayúsculas) y no hay nada que guardar.
export function conEtiqueta(etiquetas: string[] | null | undefined, nueva: string): string[] | null {
  const actuales = etiquetas ?? []
  if (actuales.some((e) => e.toLowerCase() === nueva.toLowerCase())) return null
  return [...actuales, nueva]
}

// Marca al lead con el grupo por el que entró. Un fallo acá (por ejemplo, si
// todavía no está la columna) nunca debe frenar al asistente, por eso no lanza.
// deno-lint-ignore no-explicit-any
export async function etiquetarLeadPorGrupo(supabase: any, whatsapp: string, grupo: string | null): Promise<void> {
  const etiqueta = grupo ? ETIQUETA_POR_GRUPO[grupo] : undefined
  if (!etiqueta) return
  try {
    const { data: lead, error } = await supabase.from('leads').select('id, etiquetas').eq('whatsapp', whatsapp).maybeSingle()
    if (error || !lead) return
    const nuevas = conEtiqueta(lead.etiquetas, etiqueta)
    if (nuevas) await supabase.from('leads').update({ etiquetas: nuevas }).eq('id', lead.id)
  } catch (err) {
    console.error('etiquetarLeadPorGrupo error:', err)
  }
}
