import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { sesionPanelValida } from '../_shared/guardaPanel.ts'

// Lee la foto de la "receta" (la hoja escrita a mano con la que el vendedor arma una propuesta
// simple) y devuelve los datos estructurados: pasajeros, precio del vuelo, traslado y cada
// hospedaje con su precio TOTAL (el número entre paréntesis, que ya incluye vuelo y traslado).
// Mismo mecanismo que extraer-datos-vuelo: Gemini con visión, un modelo de respaldo y, si Gemini
// falla entero, Claude (si está ANTHROPIC_API_KEY). El cliente reintenta con una invocación fresca.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-panel-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const GEMINI_MODEL = 'gemini-3.6-flash'
const GEMINI_MODEL_RESPALDO = 'gemini-3.5-flash'
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const CLAUDE_MODEL = 'claude-haiku-4-5'
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

const ESQUEMA = {
  type: 'object',
  properties: {
    cliente: { type: 'string' },
    tipo_propuesta: { type: 'string' },
    moneda: { type: 'string' },
    adultos: { type: 'integer' },
    edades_menores: { type: 'array', items: { type: 'string' } },
    bebes: { type: 'integer' },
    fecha_ida: { type: 'string' },
    fecha_vuelta: { type: 'string' },
    costo_vuelo: { type: 'string' },
    precio_vuelo: { type: 'string' },
    precio_traslado: { type: 'string' },
    precio_carry_on: { type: 'string' },
    precio_valija: { type: 'string' },
    valijas_despachadas: { type: 'integer' },
    carry_incluido: { type: 'boolean' },
    familias: {
      type: 'array',
      items: {
        type: 'object',
        properties: { adultos: { type: 'integer' }, edades_menores: { type: 'array', items: { type: 'string' } } },
        required: ['adultos', 'edades_menores'],
      },
    },
    etapas: {
      type: 'array',
      items: {
        type: 'object',
        properties: { destino: { type: 'string' }, fecha_desde: { type: 'string' }, fecha_hasta: { type: 'string' } },
        required: ['destino', 'fecha_desde', 'fecha_hasta'],
      },
    },
    hospedajes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          pension: { type: 'string' },
          costo: { type: 'string' },
          precio_hospedaje: { type: 'string' },
          precio_total: { type: 'string' },
          propietario: { type: 'string' },
          precios_familia: { type: 'array', items: { type: 'string' } },
          desayuno_opcional: { type: 'string' },
          etapa: { type: 'string' },
          detalle: { type: 'string' },
        },
        required: ['etapa', 'detalle', 'nombre', 'pension', 'costo', 'precio_hospedaje', 'precio_total', 'propietario', 'desayuno_opcional', 'precios_familia'],
      },
    },
  },
  required: ['cliente', 'tipo_propuesta', 'moneda', 'precio_carry_on', 'precio_valija', 'valijas_despachadas', 'carry_incluido', 'familias', 'etapas', 'adultos', 'edades_menores', 'bebes', 'fecha_ida', 'fecha_vuelta', 'costo_vuelo', 'precio_vuelo', 'precio_traslado', 'hospedajes'],
}

function construirPrompt(nombres: string[] = [], cotizados: string[] = []): string {
  const hoy = new Date().toISOString().slice(0, 10)
  const lista = nombres.length
    ? `\n\nNOMBRES DE HOSPEDAJES CONOCIDOS (la hoja usa casi siempre alguno de estos, pero la letra a mano es difícil de leer): ${nombres.join(' | ')}.\nSi el nombre escrito se parece claramente a uno de la lista, devolvé ese nombre EXACTAMENTE como figura en la lista. Si no se parece a ninguno, devolvé lo que leas, sin forzarlo a un nombre de la lista.`
    : ''
  const prioridad = cotizados.length
    ? `\n\nHOSPEDAJES COTIZADOS EN NIARA PARA ESTA PROPUESTA (casi todas las líneas de hospedaje de la hoja son alguno de estos): ${cotizados.join(' | ')}.\nCuando una línea se parezca a uno de estos, devolvé ese nombre EXACTAMENTE como figura acá, aunque la letra sea difícil de leer. Para un hotel que no se parece a ninguno de estos (por ejemplo, un departamento), usá la otra lista o lo que leas.`
    : ''
  return `Hoy es ${hoy}. Esta imagen es una hoja escrita a mano por un vendedor de una agencia de turismo (la "receta" de una propuesta). Arriba dice si es una PROPUESTA SIMPLE (un solo destino) o una PROPUESTA COMBINADA SIMPLE (dos destinos, cada uno con su etapa) o una PROPUESTA COMBINADA UNI (dos destinos: en uno hay un solo hospedaje, fijo e incluido en todas las opciones, y en el otro varios hospedajes para elegir). Tiene bloques separados por rayas:

1. Arriba: el tipo de propuesta, la cantidad de adultos y de menores con su edad (ej: "2 adultos + 1 (3 años)"), a veces fechas y otros datos entre paréntesis.
2. Vuelo: fechas del vuelo, aerolínea y el precio de venta del vuelo (el que sigue a la flecha, con la leyenda de equipaje, ej: "$ 3.000.000 c/carry"). El número que está ANTES de la flecha es el costo del vuelo.
3. Hospedajes: una línea por hospedaje con el nombre (a veces con el nombre del dueño entre paréntesis), tres valores en orden: (a) el COSTO en reales, antes de la flecha; (b) el precio de venta del hospedaje solo, en pesos, después de la flecha; (c) ENTRE PARÉNTESIS al final, el PRECIO TOTAL de esa opción en pesos (hospedaje + vuelo + traslado), que es el que ve el cliente. Un monto más chico entre paréntesis DEBAJO de (b), como "(12000)", es el precio del desayuno OPCIONAL por persona, en pesos. Un círculo o paréntesis con 1/2, P/C o ALL indica la pensión.
Al pie suele haber un monto suelto (ej: "100.000" o "Traslados: 200 USD"): es el traslado.

EN UN GRUPO (arriba dice GRUPO): varias familias viajan juntas. Arriba figuran las familias con un círculo F1, F2, F3 y su composición (ej: "F2: 3 adultos + 1 (12 años)"). El vuelo se escribe una vez, con el precio de cada familia: ignoralo. Cada hospedaje tiene el costo en reales y, por cada familia, el precio de venta y ENTRE PARÉNTESIS el PRECIO TOTAL de esa familia (vuelo + hospedaje + traslado). Ese total entre paréntesis es lo único que importa: va en precios_familia, uno por familia en el orden F1, F2, F3. Un "(c/caf)" al lado del nombre es desayuno incluido; un nombre propio entre paréntesis es el dueño. El monto al pie "Traslados 150.000 p/flia" es el traslado por familia: va en precio_traslado. IGNORÁ cualquier otro texto o número suelto (como los montos de equipaje o lo escrito al costado de una familia): precio_carry_on y precio_valija vacíos en un grupo.

EN UNA COMBINADA UNI: es como la combinada pero el destino con VARIOS hospedajes trae, en cada línea, el costo en reales antes de la flecha, el precio de venta en pesos después de la flecha y ENTRE PARÉNTESIS el PRECIO TOTAL de esa opción (ese hospedaje + vuelo + traslados + el hospedaje fijo del otro destino). El destino con UN SOLO hospedaje (el fijo) no tiene total entre paréntesis: lleva el costo, el precio de venta y a veces un círculo con 1/2, P/C o ALL (la pensión). Junto al precio del vuelo puede decir "c/1 despachada" (una valija despachada incluida). Un texto entre paréntesis como "(c/café)" o "(c/desayuno)" significa desayuno incluido; un nombre propio entre paréntesis (ej: "(Robson)") es el dueño.

EN UNA COMBINADA: el bloque 3 se divide en una etapa por destino (ej: "PORTO 11/17 FEB (6nn)" y "MARAGOGI 17/21 FEB (4nn)"). En cada línea de hospedaje hay DOS valores: el COSTO en reales antes de la flecha y, después de la flecha, el PRECIO DE VENTA en dólares solo del hospedaje (no hay total entre paréntesis). Un texto entre paréntesis junto al nombre (ej: "(307)", "(suite clásica)") es un detalle de la unidad. En el bloque del vuelo, los dos montos entre paréntesis (ej: "160 USD 23 kg" y "110 USD carry") son los precios del equipaje opcional. Ignorá el presupuesto (ej: "500 USD") y las fechas del encabezado: las fechas válidas son las del bloque del vuelo y las de cada etapa.

Devolvé:
- cliente: el nombre del cliente o pasajero principal, si está escrito en la hoja (suele ir arriba, junto al tipo de propuesta). Vacío si no hay ningún nombre de persona; no uses el nombre de un hospedaje ni de un dueño.
- tipo_propuesta: "grupo" si dice GRUPO; "combinada_uni" si dice COMBINADA UNI; "combinada" si dice combinada simple o hay dos etapas de destinos con varios hospedajes en cada una; si no, "simple".
- moneda: "USD" si los precios de venta están en dólares (USD, U$S); "ARS" si están en pesos.
- familias: solo en un grupo, una por familia en orden: adultos y edades_menores (como en edades_menores). Lista vacía si no es un grupo. En un grupo, adultos es el total de adultos de todas las familias.
- adultos: cantidad de adultos (número).
- edades_menores: una edad en años por cada menor de 1 año o más, como texto (ej: ["3"]). Los menores de 1 año no van acá.
- bebes: cantidad de bebés (menores de 1 año), 0 si no hay.
- fecha_ida / fecha_vuelta: las fechas del bloque del VUELO en formato YYYY-MM-DD (si no hay año, asumí el año de hoy o el que viene si ya pasó). Vacío si no se leen.
- costo_vuelo: el número antes de la flecha en la línea del vuelo, solo dígitos (ej: "2000"); vacío si no hay.
- precio_vuelo: solo dígitos, sin puntos ni símbolos (ej: "3000000").
- precio_traslado: solo dígitos; vacío si no hay.
- valijas_despachadas: cantidad de valijas despachadas incluidas en el precio del vuelo (ej: "c/1 despachada" = 1); 0 si no dice nada.
- carry_incluido: true si junto al precio del vuelo dice "c/carry", "c/ carry", "con carry" o similar (el carry on ya viene incluido en el precio del vuelo); false si no dice nada.
- precio_carry_on: precio del carry on opcional (ej: "110"); vacío si no hay.
- precio_valija: precio de la valija de 23 kg opcional (ej: "160"); vacío si no hay.
- etapas: solo en combinada, una por destino en el orden escrito: destino (nombre completo, ej: "Porto de Galinhas", "Maragogi"), fecha_desde y fecha_hasta en YYYY-MM-DD (el año y el mes son los del vuelo si no están claros). Lista vacía en simple.
- hospedajes: uno por línea del bloque 3, en el orden escrito:
  - nombre: solo el nombre del hospedaje, sin pensión ni dueño (ej: "Cupe", "Unaí", "Samoa", "Armação", "Enotel").
  - pension: "Desayuno incluido" si dice c/café, c/desayuno o con desayuno; "Media pensión" si dice 1/2, "Pensión completa" si dice P/C, "All Inclusive" si dice ALL, vacío si no dice nada.
  - costo: valor (a), el número antes de la flecha, solo dígitos (ej: "8000").
  - precio_hospedaje: valor (b), el que sigue a la flecha, solo dígitos (ej: "3400000"; en una combinada es el precio de venta en dólares, ej: "1333").
  - precio_total: valor (c), el número ENTRE PARÉNTESIS al final de la línea, solo dígitos (ej: "6500000"). Vacío en una combinada y en el hospedaje fijo de una combinada uni.
  - desayuno_opcional: el monto entre paréntesis debajo del precio (b), como "(12000)", solo dígitos (ej: "12000"); vacío si no hay.
  - etapa: solo en combinada o combinada uni, el destino al que pertenece (igual al nombre usado en etapas); vacío en simple.
  - precios_familia: solo en un grupo, el precio total entre paréntesis de cada familia, solo dígitos y en orden (ej: ["6085000", "8689000", "7499000"]). Lista vacía si no es un grupo.
  - detalle: el texto entre paréntesis junto al nombre, si es de la unidad (ej: "307", "suite clásica"); vacío si no hay.
  - propietario: el nombre entre paréntesis junto al hospedaje si es el de una persona (ej: "Kenwi"); vacío si no hay.
Si algo no se lee con certeza, dejalo vacío (o 0 en números) en vez de inventarlo.${prioridad}${lista}`
}

async function llamarGemini(model: string, imagenBase64: string, mediaType: string | undefined, nombres: string[], cotizados: string[]) {
  return await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY ?? '', 'Api-Revision': '2026-05-20' },
    body: JSON.stringify({
      model,
      input: [
        { type: 'image', mime_type: mediaType || 'image/jpeg', data: imagenBase64 },
        { type: 'text', text: construirPrompt(nombres, cotizados) },
      ],
      response_format: { type: 'text', mime_type: 'application/json', schema: ESQUEMA },
      // Letra a mano: acá conviene que piense más que en una captura impresa
      generation_config: { thinking_level: 'medium' },
    }),
  })
}

async function llamarClaude(imagenBase64: string, mediaType: string | undefined, nombres: string[], cotizados: string[]) {
  return await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY ?? '', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      tools: [{ name: 'extraer_receta', description: 'Devuelve los datos leídos de la receta.', input_schema: ESQUEMA }],
      tool_choice: { type: 'tool', name: 'extraer_receta' },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imagenBase64 } },
          { type: 'text', text: construirPrompt(nombres, cotizados) },
        ],
      }],
    }),
  })
}

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (!(await sesionPanelValida(req))) return json({ error: 'Sesión del panel no válida. Volvé a entrar.' }, 401)

  try {
    const { imagenBase64, mediaType, nombres: nombresIn, cotizados: cotizadosIn } = await req.json()
    const cotizados: string[] = Array.isArray(cotizadosIn) ? cotizadosIn.map((n: unknown) => String(n)).filter(Boolean).slice(0, 40) : []
    const nombres: string[] = Array.isArray(nombresIn) ? nombresIn.map((n: unknown) => String(n)).filter(Boolean).slice(0, 400) : []
    if (!imagenBase64) return json({ error: 'Falta la imagen.' }, 400)

    let res = await llamarGemini(GEMINI_MODEL, imagenBase64, mediaType, nombres, cotizados)
    if (!res.ok && (res.status === 429 || res.status >= 500)) {
      console.error(`Gemini error con ${GEMINI_MODEL}:`, res.status, await res.text())
      res = await llamarGemini(GEMINI_MODEL_RESPALDO, imagenBase64, mediaType, nombres, cotizados)
    }

    const transitorio = !res.ok && (res.status === 429 || res.status >= 500)
    const textoError = !res.ok ? await res.text() : ''

    if (transitorio && ANTHROPIC_API_KEY) {
      console.error('Gemini error (respaldo):', res.status, textoError)
      const resClaude = await llamarClaude(imagenBase64, mediaType, nombres, cotizados)
      if (resClaude.ok) {
        const d = await resClaude.json()
        const uso = d?.content?.find((c: any) => c.type === 'tool_use')
        if (uso?.input) return json({ receta: uso.input })
      } else {
        console.error('Claude error:', resClaude.status, await resClaude.text())
      }
    }

    if (!res.ok) {
      console.error('Gemini error:', res.status, textoError)
      return json({
        error: transitorio
          ? 'El lector de imágenes está saturado en este momento — esperá unos segundos y probá de nuevo.'
          : 'No se pudo leer la imagen de la receta.',
      }, transitorio ? 429 : 500)
    }

    const data = await res.json()
    const salida = data?.steps?.find((s: any) => s.type === 'model_output')
    const texto = salida?.content?.find((c: any) => c.type === 'text')?.text
    const receta = texto ? JSON.parse(texto) : null
    if (!receta) return json({ error: 'No se pudieron leer datos en esa imagen.' }, 422)
    return json({ receta })
  } catch (err) {
    console.error('leer-receta error:', err)
    return json({ error: (err as Error).message || 'Error al leer la receta.' }, 500)
  }
})
