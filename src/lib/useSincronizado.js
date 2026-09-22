import { useEffect, useRef } from 'react'
import { supabase } from './supabase.js'

// Vuelve a llamar a `recargar` cada vez que cambia algo en cualquiera de las `tablas`, para que
// una pantalla que solo cargaba los datos una vez (al entrar) se mantenga al día sin que haga
// falta recargar la página a mano. Como varios cambios pueden llegar juntos (por ejemplo, un
// mensaje de WhatsApp que crea un lead y una conversación casi al mismo tiempo), espera un
// toque antes de recargar por si hay más en camino. Además, cada `intervaloMs` vuelve a cargar
// igual, como red de seguridad si por lo que sea el aviso en vivo no llegó.
export function useSincronizado(recargar, tablas, { intervaloMs = 60000, esperaMs = 800 } = {}) {
  const recargarRef = useRef(recargar)
  recargarRef.current = recargar

  useEffect(() => {
    let espera = null
    const recargarConDemora = () => {
      clearTimeout(espera)
      espera = setTimeout(() => recargarRef.current(), esperaMs)
    }
    const intervalo = setInterval(() => recargarRef.current(), intervaloMs)

    if (!supabase) return () => { clearTimeout(espera); clearInterval(intervalo) }

    let canal = supabase.channel(`sincronizado-${tablas.join('-')}`)
    for (const tabla of tablas) {
      canal = canal.on('postgres_changes', { event: '*', schema: 'public', table: tabla }, recargarConDemora)
    }
    canal.subscribe()

    return () => {
      clearTimeout(espera)
      clearInterval(intervalo)
      canal.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablas.join(','), intervaloMs, esperaMs])
}
