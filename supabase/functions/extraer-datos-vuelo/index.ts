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
  'vuelta_fecha', 'vuelta_sale', 'vuelta_llega',
]

const GEMINI_MODEL = 'gemini-3.6-flash'
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

const PROMPT = `Esta imagen es una captura de un itinerario de vuelo (puede ser de Google Flights, un e-ticket, una confirmación de aerolínea, WhatsApp, lo que sea). Extraé estos datos:

- origen_ciudad: nombre de la ciudad de origen del vuelo de ida (solo el nombre de la ciudad, sin el código de aeropuerto)
- origen_codigo: código IATA del aeropuerto de origen, 3 letras mayúsculas (ej: EZE)
- destino_ciudad: nombre de la ciudad de destino
- destino_codigo: código IATA del aeropuerto de destino, 3 letras mayúsculas
- ida_fecha: fecha del vuelo de ida en formato YYYY-MM-DD
- ida_sale: hora de salida del vuelo de ida en formato 24hs HH:MM
- ida_llega: hora de llegada del vuelo de ida en formato 24hs HH:MM
- vuelta_fecha: fecha del vuelo de vuelta en formato YYYY-MM-DD
- vuelta_sale: hora de salida del vuelo de vuelta en formato 24hs HH:MM
- vuelta_llega: hora de llegada del vuelo de vuelta en formato 24hs HH:MM

Si la imagen es un viaje solo de ida (sin vuelta), dejá los tres campos de vuelta como string vacío "". Si algún dato puntual no se puede leer con certeza en la imagen, dejá ese campo como string vacío "" en vez de inventar un valor. Si el año de la fecha no aparece en la imagen, asumí el año en curso.`

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
          { type: 'text', text: PROMPT },
        ],
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: { type: 'object', properties, required: CAMPOS },
        },
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
