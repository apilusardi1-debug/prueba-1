import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Lee una captura/imagen de un itinerario de vuelo (Google Flights, e-ticket,
// confirmación de aerolínea, lo que sea) y devuelve los campos de la sección
// Vuelo del Generador de propuesta ya estructurados, usando Gemini con visión
// (capa gratuita de Google AI Studio, sin tarjeta -- a diferencia de la API de
// Claude que se evaluó primero, esto no tiene costo para el volumen de la agencia).
// A diferencia del import de hospedajes (que lee una API propia de Niara), acá
// no hay ninguna API pública detrás de una captura de pantalla -- por eso el
// enfoque es un modelo con visión en vez de scrapear un link.
//
// Usa la Interactions API de Gemini (generateContent quedó deprecado en favor de
// esta a mediados de 2026) -- endpoint POST /v1beta/interactions, la salida
// estructurada viene en response.steps, en el step de type "model_output".

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const CAMPOS = [
  'origen_ciudad', 'origen_codigo', 'destino_ciudad', 'destino_codigo',
  'ida_fecha', 'ida_sale', 'ida_llega',
  'ida_escala_ciudad', 'ida_escala_codigo', 'ida_escala_llega', 'ida_escala_sale',
  'vuelta_fecha', 'vuelta_sale', 'vuelta_llega',
  'vuelta_escala_ciudad', 'vuelta_escala_codigo', 'vuelta_escala_llega', 'vuelta_escala_sale',
]

const GEMINI_MODEL = 'gemini-3.6-flash'
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

// El prompt describe explicitamente los formatos reales que llegan a la agencia
// (no solo "una captura de itinerario" generico) porque cada uno pone la misma
// informacion en un lugar visual distinto -- sin esto el modelo tiende a leer
// bien Google Flights pero se pierde en e-tickets o capturas de WhatsApp.
// El modelo no tiene reloj propio -- sin decirle la fecha de hoy, "asumi el año
// en curso" quedaba libado a su propio entrenamiento (probado: devolvia 2025
// en pleno 2026). Se la pasamos calculada acá, con Date real del servidor.
function construirPrompt(): string {
  const hoy = new Date().toISOString().slice(0, 10)
  return `Hoy es ${hoy}. Esta imagen es una captura de un itinerario de vuelo. Puede venir en varios formatos distintos, y tenés que reconocer cuál es para saber dónde mirar cada dato:

1. Google Flights (resultado de búsqueda o detalle de un vuelo): fechas arriba, horarios grandes con las ciudades/aeropuertos debajo, duración total y escalas en el medio con la leyenda "Espera de Xh Ym en [ciudad] (Troca de avião)" o "Layover" o similar.
2. E-ticket o confirmación de aerolínea (PDF o imagen, ej: Gol, Latam, Aerolíneas Argentinas, Azul): suele tener número de vuelo, y un bloque por cada tramo con fecha, hora de salida/llegada y aeropuertos, a veces con más formalidad y logos.
3. Confirmación de agencia online (Despegar, Almundo, CVC, Booking, etc.): parecido al e-ticket pero con su propio diseño, a veces en portugués.
4. Captura reenviada por WhatsApp (foto de pantalla o texto plano): puede ser una versión recortada o de menor calidad de cualquiera de los anteriores.
5. Tarjeta de embarque (boarding pass): datos más compactos, aeropuertos casi siempre solo en código IATA, sin ciudad completa.

Sea cual sea el formato, extraé estos datos:

- origen_ciudad: nombre de la ciudad de origen del vuelo de ida (solo el nombre de la ciudad, sin el código de aeropuerto). Si el formato solo trae el código IATA (ej: boarding pass), inferí el nombre de la ciudad a partir del código.
- origen_codigo: código IATA del aeropuerto de origen, 3 letras mayúsculas (ej: EZE)
- destino_ciudad: nombre de la ciudad de destino (destino final del viaje de ida, no el de una escala en el medio)
- destino_codigo: código IATA del aeropuerto de destino
- ida_fecha: fecha del vuelo de ida en formato YYYY-MM-DD
- ida_sale: hora de salida del primer tramo de ida en formato 24hs HH:MM
- ida_llega: hora de llegada al destino final de ida (después de la escala, si la hay) en formato 24hs HH:MM
- ida_escala_ciudad: si el vuelo de ida tiene una escala/conexión, nombre de la ciudad donde hace escala. Si el vuelo es directo o no se puede determinar, dejalo vacío.
- ida_escala_codigo: código IATA del aeropuerto de la escala de ida
- ida_escala_llega: hora en que el primer tramo de ida llega a la ciudad de escala (HH:MM 24hs)
- ida_escala_sale: hora en que el segundo tramo de ida sale de la ciudad de escala (HH:MM 24hs)
- vuelta_fecha: fecha del vuelo de vuelta en formato YYYY-MM-DD
- vuelta_sale: hora de salida del primer tramo de vuelta
- vuelta_llega: hora de llegada al destino final de vuelta (después de la escala, si la hay)
- vuelta_escala_ciudad, vuelta_escala_codigo, vuelta_escala_llega, vuelta_escala_sale: igual que los de ida pero para el vuelo de vuelta

Si un vuelo (ida o vuelta) tiene más de una escala, usá solo la primera. Si la imagen es un viaje solo de ida (sin vuelta), dejá todos los campos de vuelta como string vacío "". Si algún dato puntual no se puede leer con certeza en la imagen, dejá ese campo como string vacío "" en vez de inventar un valor. Si el año de la fecha no aparece en la imagen, asumí el año de hoy (o el que viene, si esa fecha ya pasó este año).`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { imagenBase64, mediaType } = await req.json()
    if (!imagenBase64) {
      return new Response(JSON.stringify({ error: 'Falta la imagen.' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const properties = Object.fromEntries(CAMPOS.map((c) => [c, { type: 'string' }]))

    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY ?? '' },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        input: [
          { type: 'image', mime_type: mediaType || 'image/png', data: imagenBase64 },
          { type: 'text', text: construirPrompt() },
        ],
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: { type: 'object', properties, required: CAMPOS },
        },
        // Por default el modelo "piensa" con nivel medio/alto antes de responder,
        // pensado para tareas que requieren razonamiento — acá solo hace falta
        // leer campos de una imagen y acomodarlos, así que "low" alcanza de sobra
        // y evita varios segundos de latencia que no aportan nada a este caso.
        generation_config: { thinking_level: 'low' },
      }),
    })

    if (!res.ok) {
      const detalle = await res.text()
      console.error('Gemini error:', res.status, detalle)
      throw new Error(`Gemini respondió ${res.status}`)
    }

    const data = await res.json()
    const salida = data?.steps?.find((s: any) => s.type === 'model_output')
    const texto = salida?.content?.find((c: any) => c.type === 'text')?.text
    const datos = texto ? JSON.parse(texto) : null

    if (!datos) {
      return new Response(JSON.stringify({ error: 'No se pudieron leer datos de vuelo en esa imagen.' }), {
        status: 422,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ vuelo: datos }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('extraer-datos-vuelo error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Error al leer la imagen del vuelo.' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
