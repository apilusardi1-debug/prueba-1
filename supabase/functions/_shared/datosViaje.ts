// Lee lo que el contacto contestó en el chat (por ejemplo, la plantilla "Datos
// para la propuesta" o las preguntas del asistente) y saca su nombre, el destino,
// cuántos viajan, cuántos son adultos y menores, la edad de cada menor, el
// presupuesto y cuándo piensa viajar, para completar solos la propuesta y la
// reserva y para que el asistente no vuelva a preguntar lo que ya dijo.
//
// Lo más confiable es la plantilla con campos ("Adultos: 3"); también entiende
// frases sueltas ("somos 2 adultos y un nene de 6 años"), en español y en
// portugués. Siempre es una lectura automática: la pantalla muestra lo que
// entendió para que la persona lo confirme.

import { detectarInteres } from './interes.ts'

export type EdadMenor = number | 'bebe'

export interface DatosViaje {
  nombre: string | null
  edad: number | null // edad de quien escribe: dato informativo, no se usa en la propuesta
  destino: string | null
  pasajeros: number | null
  adultos: number | null
  menores: number | null
  edadesMenores: EdadMenor[]
  presupuesto: string | null // tal como lo dijo ("2.000 a 2.500 USD"), no se convierte
  fechas: string | null // tal como lo dijo ("del 10 al 20 de enero", "vacaciones de invierno")
  avisos: string[]
  hayDatos: boolean
}

const NUMERO_EN_PALABRAS: Record<string, number> = {
  un: 1, uno: 1, una: 1, um: 1, uma: 1, dos: 2, dois: 2, duas: 2, tres: 3, cuatro: 4, quatro: 4,
  cinco: 5, seis: 6, siete: 7, sete: 7, ocho: 8, oito: 8, nueve: 9, nove: 9, diez: 10, dez: 10,
  cero: 0, zero: 0,
}
const NUM = '(\\d{1,2}|un|uno|una|um|uma|dos|dois|duas|tres|cuatro|quatro|cinco|seis|siete|sete|ocho|oito|nueve|nove|diez|dez)'
// Palabras que nombran a un menor (el bebé se cuenta aparte)
const MENOR = '(?:menor(?:es)?|ninos?|ninas?|chic[oa]s?|hij[oa]s?|criancas?|nenes?|nenas?|peques?|pibes?|pibas?)'
const PALABRAS_MENOR = /\b(?:menor(?:es)?|nin[oa]s?|chic[oa]s?|hij[oa]s?|crianca?s?|nene?s?|nena?s?|peques?|pibe?s?|piba?s?|bebes?)\b/
// Lo que sigue a un número y lo convierte en cantidad de personas, no en edad
const NO_ES_EDAD = '(?!\\s*(?:adult|person|pasaj|menor|nin|chic|hij|pax|crianc|nene|peque|bebe|pessoa))'
// "somos 2 y un bebé": el 2 son los adultos, no el total
const Y_UN_MENOR = '(?!\\s*(?:y|e|mas|\\+)\\s+(?:\\d+\\s+|un\\s+|una\\s+|dos\\s+)?(?:bebe|nin|menor|chic|hij|nene|peque|crianc))'

const MESES = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|janeiro|fevereiro|marco|maio|junho|julho|setembro|outubro|novembro|dezembro'
// "abril" suelto puede ser un nombre ("soy Abril"): el mes solo cuenta si viene con una de estas palabras
const ANTES_DEL_MES = '(?:en|para|durante|desde|hasta|a\\s+partir\\s+de|fines\\s+de|finales\\s+de|principios\\s+de|comienzos\\s+de|mediados\\s+de|inicios\\s+de|(?:la\\s+)?(?:primera|segunda|ultima)\\s+(?:semana|quincena)\\s+de|el\\s+mes\\s+de|mes\\s+de|de|del|em|no\\s+mes\\s+de|entre)'

function sinAcentos(texto: string): string {
  // Cada letra se cambia por otra sola: el texto normalizado tiene el mismo largo que el original
  return texto
    .toLowerCase()
    .replace(/[áàâäã]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
    .replace(/[óòôöõ]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ñ/g, 'n').replace(/ç/g, 'c')
}

function aNumero(token: string): number | null {
  if (/^\d+$/.test(token)) return parseInt(token, 10)
  return NUMERO_EN_PALABRAS[token] ?? null
}

// "3", "tres", "ninguno"... -> cantidad. Devuelve null si no hay nada que entender.
function contar(valor: string): number | null {
  const v = valor.trim()
  if (/^(?:ninguno|ninguna|ningun|nenhum|nenhuma|no|nao|nada|sin|cero|zero)\b/.test(v) || /^-+$/.test(v)) return 0
  const m = new RegExp('\\b' + NUM + '\\b').exec(v)
  return m ? aNumero(m[1]) : null
}

// Edades sueltas dentro de un texto: "5 y 8", "6 años", "8 meses", "bebé".
// Menos de un año (o "bebé") es 'bebe'; lo que pasa de 17 no es un menor.
function edadesDe(texto: string): EdadMenor[] {
  const r: EdadMenor[] = []
  const re = /(\d{1,2})\s*(meses|mes|months?)?|\bbebes?\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(texto))) {
    if (!m[1]) { r.push('bebe'); continue }
    const n = parseInt(m[1], 10)
    if (m[2]) { r.push(n < 12 ? 'bebe' : Math.floor(n / 12)); continue }
    if (n === 0) r.push('bebe')
    else if (n <= 17) r.push(n)
  }
  return r
}

// ── Presupuesto ──────────────────────────────────────────────────────────────────
const MONEDA = '(usd|us\\$|u\\$s|u\\$d|dolares|dolar|dollars?|reales|reais|real|brl|r\\$|\\$)'
const PALABRA_PRESUPUESTO = /\b(?:presupuesto|orcamento|budget|gastar|invertir|dispongo|contamos\s+con|cuento\s+con|tengo\s+unos)\b/

function monto(numero: string, mil: string | undefined): number | null {
  let n: number
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(numero)) n = parseInt(numero.replace(/[.,]/g, ''), 10)
  else if (/^\d+[.,]\d{1,2}$/.test(numero)) n = parseFloat(numero.replace(',', '.'))
  else if (/^\d+$/.test(numero)) n = parseInt(numero, 10)
  else return null
  return mil ? n * 1000 : n
}

function formatoMonto(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function nombreMoneda(m: string | undefined): string {
  if (!m) return ''
  if (/^(?:usd|us\$|u\$s|u\$d|dolar|dollar)/.test(m)) return ' USD'
  if (/^(?:real|reais|brl|r\$)/.test(m)) return ' R$'
  return ' $'
}

// Un presupuesto dicho en el texto ("2000 usd", "entre 1.000 y 2.000 dólares", "hasta 2500",
// "presupuesto 3 mil"). Sin moneda ni una palabra que lo indique no se toma: un número
// suelto puede ser una edad, una cantidad o una fecha. Con `forzar` (el contacto lo puso
// en la línea "Presupuesto:") alcanza con que haya un número.
function presupuestoDe(t: string, forzar: boolean): string | null {
  const hayPalabra = forzar || PALABRA_PRESUPUESTO.test(t)
  const PREF = '(?:usd|us\\$|u\\$s|r\\$|\\$)'

  // Rango: "de 1000 a 2000 usd", "1.000-2.000", "entre 2 mil y 3 mil dólares"
  const rango = new RegExp('(?:\\b(?:de|desde|entre|del)\\s+)?(?:' + PREF + '\\s*)?(\\d[\\d.,]*)\\s*(mil|k)?(?:\\s*[-/]\\s*|\\s+(?:a|hasta|y|e)\\s+)(?:' + PREF + '\\s*)?(\\d[\\d.,]*)\\s*(mil|k)?\\s*(?:' + MONEDA + '(?![a-z]))?', 'g')
  for (const m of t.matchAll(rango)) {
    const a = monto(m[1], m[2]); const b = monto(m[3], m[4])
    if (a === null || b === null || a < 100 || b < a) continue
    const conMoneda = !!m[5] || new RegExp('^\\s*' + PREF).test(m[0].replace(/^(?:de|desde|entre|del)\s+/, ''))
    if (!conMoneda && !hayPalabra) continue
    return `${formatoMonto(a)} a ${formatoMonto(b)}${nombreMoneda(m[5])}`
  }

  // Un solo monto: "2000 usd", "USD 2000", "hasta 2500", "presupuesto 3 mil"
  const simple = new RegExp('(?:\\b(hasta|maximo|max|unos|aprox\\w*|alrededor\\s+de)\\s+)?(?:(' + PREF + ')\\s*)?(\\d[\\d.,]*)\\s*(mil|k)?\\s*(?:' + MONEDA + '(?![a-z]))?', 'g')
  for (const m of t.matchAll(simple)) {
    const n = monto(m[3], m[4])
    if (n === null || n < 100) continue
    const moneda = m[5] ?? m[2]
    if (!moneda && !m[1] && !hayPalabra) continue
    // Sin moneda, un número que parece un año ("hasta 2027") no es un presupuesto
    if (!moneda && n >= 2020 && n <= 2035 && !PALABRA_PRESUPUESTO.test(t)) continue
    const tope = m[1] && /^(?:hasta|maximo|max)$/.test(m[1]) ? 'hasta ' : ''
    return `${tope}${formatoMonto(n)}${nombreMoneda(moneda)}`
  }
  return null
}

// ── Fechas ────────────────────────────────────────────────────────────────────────
// Devuelve lo que dijo el contacto, con sus propias palabras: "del 10 al 20 de enero",
// "a fines de julio", "vacaciones de invierno". `t` es el texto normalizado y `orig` el
// mismo texto sin normalizar (del mismo largo), de donde sale lo que se muestra.
// Recibe las líneas del mensaje: un mes suelto ("Maragogi, enero, 2000 usd") solo cuenta si
// es un segmento completo (entre comas o en su propia línea); dentro de una frase ("soy
// Abril") no, porque puede ser un nombre.
function fechasDe(lineasNorm: string[], lineasOrig: string[]): string | null {
  const t = lineasNorm.join(' ')
  const orig = lineasOrig.join(' ')
  const M = '(?:' + MESES + ')'
  const ANIO = '(?:\\s+(?:de|del)\\s+20\\d{2})?'
  const patrones: RegExp[] = [
    // "del 10 al 20 de enero", "10-20 de enero de 2027"
    new RegExp('\\b(?:del\\s+)?\\d{1,2}(?:\\s+(?:al|a|hasta\\s+el)\\s+|\\s*-\\s*)\\d{1,2}\\s+de\\s+' + M + ANIO + '\\b'),
    // "10 de enero", "el 10 de enero de 2027"
    new RegExp('\\b\\d{1,2}\\s+de\\s+' + M + ANIO + '\\b'),
    // "enero 2027", "enero de 2027"
    new RegExp('\\b' + M + '\\s+(?:de\\s+|del\\s+)?20\\d{2}\\b'),
    // "en enero", "a fines de julio", "entre enero y marzo", "enero o febrero"
    new RegExp('\\b' + ANTES_DEL_MES + '\\s+' + M + '(?:\\s*(?:,|y|o|e|ou)\\s*' + M + ')*\\b'),
    // "10/01" o "10/01/2027"
    /\b(?:0?[1-9]|[12]\d|3[01])\/(?:0?[1-9]|1[0-2])(?:\/(?:20)?\d{2})?\b/,
    // épocas con nombre
    /\b(?:vacaciones\s+de\s+(?:invierno|verano|julio|enero|febrero)|semana\s+santa|carnaval|navidad|fin\s+de\s+ano|ano\s+nuevo|reveillon|fiestas|luna\s+de\s+miel|(?:el|este|en|para)\s+(?:verano|invierno|otono|primavera)|(?:el\s+)?ano\s+que\s+viene|(?:el\s+)?proximo\s+ano|(?:el\s+)?mes\s+que\s+viene|(?:el\s+)?proximo\s+mes|dentro\s+de\s+\d+\s+(?:meses|semanas)|en\s+\d+\s+(?:meses|semanas))\b/,
    // "en 2027", "para 2027"
    /\b(?:en|para|del|de)\s+20\d{2}\b/,
  ]
  for (const re of patrones) {
    const m = re.exec(t)
    if (m) return orig.slice(m.index, m.index + m[0].length).trim()
  }
  // Mes suelto como segmento completo: "enero", "julio 2027" (separados por coma, punto o línea)
  const segmentos = lineasNorm.join(' , ')
  const suelto = new RegExp('(?:^|[,;.])\\s*(' + M + '(?:\\s+(?:de\\s+)?20\\d{2})?)\\s*(?=[,;.!]|$)').exec(segmentos)
  if (suelto) {
    const inicio = suelto.index + suelto[0].indexOf(suelto[1])
    return lineasOrig.join(' , ').slice(inicio, inicio + suelto[1].length).trim()
  }
  return null
}

// "me llamo Ana", "mi nombre es Juan Pérez", "soy María": solo si lo que sigue empieza con mayúscula
function nombreDeTexto(orig: string): string | null {
  const m = /\b(?:[Mm]e\s+llamo|[Mm]i\s+nombre\s+es|[Mm]eu\s+nome\s+[eé]|[Ss]oy|[Ss]ou|SOY)\s+([A-ZÁÉÍÓÚÑ][\p{L}'-]+(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}'-]+){0,2})/u.exec(orig)
  return m ? m[1].trim() : null
}

interface Parcial {
  nombre?: string
  edad?: number
  destino?: string
  pasajeros?: number
  adultos?: number
  menores?: number
  edades?: EdadMenor[]
  presupuesto?: string
  fechas?: string
}

const LINEA_CON_CAMPO = /^\s*(?:[-*•]\s*|\d+\s*[.)-]\s*)?(?:cantidad\s+de\s+|qtd\.?\s+de\s+|numero\s+de\s+)?(nombre|nome|destino|presupuesto(?:\s+(?:por\s+persona|total|estimado|aproximado))?|orcamento|(?:fechas?|periodo)(?:\s+o\s+(?:fechas?|periodo))?(?:\s+(?:de|del)\s+viaje)?|edad(?:es)?(?:\s+de\s+(?:los\s+|as\s+|os\s+)?(?:menores|ninos|ninas|chicos|hijos|criancas))?|pasajeros|personas|pessoas|adultos|menores|ninos|criancas|chicos|hijos)\s*[:=]\s*(.*)$/

// Un mensaje: primero las líneas con campo ("Adultos: 3") y después el resto como frase libre.
function leerMensaje(original: string): Parcial {
  const p: Parcial = {}
  const restoLineas: string[] = []
  const restoOriginal: string[] = []

  for (const linea of original.split(/\r?\n/)) {
    const norm = sinAcentos(linea)
    const m = LINEA_CON_CAMPO.exec(norm)
    if (!m) { restoLineas.push(norm); restoOriginal.push(linea); continue }
    const campo = m[1]
    const valor = m[2].trim()
    // lo que escribió después de los dos puntos, con sus mayúsculas y acentos
    const orig = linea.slice(linea.search(/[:=]/) + 1).trim().replace(/[.,;]+$/, '')
    const vacio = !orig || /^[-_.\s]*$/.test(orig)
    if (campo === 'nombre' || campo === 'nome') {
      if (orig && !/^\d+$/.test(orig) && orig.length <= 60) p.nombre = orig
    } else if (campo === 'destino') {
      if (!vacio) p.destino = detectarInteres(valor).destino ?? orig.slice(0, 60)
    } else if (campo.startsWith('presupuesto') || campo === 'orcamento') {
      if (!vacio) p.presupuesto = presupuestoDe(valor, true) ?? orig.slice(0, 60)
    } else if (/^(?:fecha|periodo)/.test(campo)) {
      if (!vacio) p.fechas = orig.slice(0, 80)
    } else if (campo === 'pasajeros' || campo === 'personas' || campo === 'pessoas') {
      const n = contar(valor); if (n !== null) p.pasajeros = n
    } else if (campo === 'adultos') {
      const n = contar(valor); if (n !== null) p.adultos = n
    } else if (campo === 'edad') {
      const n = /\d{1,2}/.exec(valor); if (n) p.edad = parseInt(n[0], 10)
    } else if (campo.startsWith('edad')) {
      p.edades = edadesDe(valor)
    } else {
      const n = contar(valor); if (n !== null) p.menores = n
    }
  }

  // Frases libres (sobre lo que no eran campos)
  const t = restoLineas.join(' ')
  const orig = restoOriginal.join(' ')

  const adultos = [...t.matchAll(new RegExp('\\b' + NUM + '\\s+adult[oa]s?\\b', 'g'))].map(m => aNumero(m[1])).filter((n): n is number => n !== null)
  if (adultos.length) p.adultos = adultos[adultos.length - 1]

  let menores = 0
  let bebes = 0
  let hayMenores = false
  for (const m of t.matchAll(new RegExp('\\b' + NUM + '\\s+' + MENOR + '\\b', 'g'))) {
    const n = aNumero(m[1]); if (n !== null) { menores += n; hayMenores = true }
  }
  for (const m of t.matchAll(/(?:\b(\d{1,2}|un|uno|una|um|uma|dos|dois|duas)\s+)?\bbebes?\b/g)) {
    const n = m[1] ? (aNumero(m[1]) ?? 1) : 1
    menores += n
    bebes += n
    hayMenores = true
  }
  if (hayMenores) p.menores = menores
  // "sin niños", "no viajan menores", "solo adultos": son 0 menores
  else if (
    /\b(?:sin|nenhum|nenhuma|no\s+(?:hay|viajan|viaja|llevamos|llevo|vamos\s+con|tenemos|tengo)|nao\s+(?:tem|ha|viajam))\s+(?:ningun\s+|ninguna\s+)?(?:menor(?:es)?|ninos?|ninas?|chic[oa]s?|hij[oa]s?|criancas?|nenes?|peques?|pibes?)\b/.test(t) ||
    /\b(?:solo|solamente|unicamente|somente|so)\s+adult[oa]s?\b/.test(t)
  ) p.menores = 0

  const total = [
    ...t.matchAll(new RegExp('\\b(?:somos|seremos|somos\\s+una\\s+familia\\s+de|familia\\s+de)\\s+' + NUM + '\\b' + NO_ES_EDAD + Y_UN_MENOR, 'g')),
    ...t.matchAll(new RegExp('\\b' + NUM + '\\s+(?:personas|pasajeros|pax|pessoas|viajeros)\\b', 'g')),
  ].map(m => aNumero(m[1])).filter((n): n is number => n !== null)
  if (total.length) p.pasajeros = total[total.length - 1]

  // Edades: solo si el mensaje habla de menores (si no, "tengo 15 años" podría ser cualquiera)
  if (PALABRAS_MENOR.test(t) && p.edades === undefined) {
    const conUnidad = [...t.matchAll(/(\d{1,2}(?:\s*(?:,|y|e)\s*\d{1,2})*\s*(?:anos|ano|meses|mes))\b/g)].flatMap(m => edadesDe(m[1]))
    let edades = conUnidad
    if (!edades.length) {
      const trasPalabra = [...t.matchAll(new RegExp('\\b' + MENOR + '\\s*\\(?\\s*(?:de\\s+|con\\s+|tienen\\s+)?(\\d{1,2}(?:\\s*(?:,|y|e)\\s*\\d{1,2})*)\\)?' + NO_ES_EDAD, 'g'))].flatMap(m => edadesDe(m[1]))
      edades = trasPalabra
    }
    // "con bebé" sin edad escrita: la edad es "bebé"
    if (!edades.length && bebes > 0) edades = Array.from({ length: bebes }, () => 'bebe' as EdadMenor)
    if (edades.length) p.edades = edades
  }

  // Destino, presupuesto, fechas y nombre dichos en una frase
  if (p.destino === undefined) { const d = detectarInteres(t).destino; if (d) p.destino = d }
  if (p.presupuesto === undefined) { const b = presupuestoDe(t, false); if (b) p.presupuesto = b }
  if (p.fechas === undefined) { const f = fechasDe(restoLineas, restoOriginal); if (f) p.fechas = f }
  if (p.nombre === undefined) { const n = nombreDeTexto(orig); if (n) p.nombre = n }
  return p
}

export function extraerDatosViaje(textos: string[]): DatosViaje {
  // De los más viejos a los más nuevos: lo último que dijo el contacto pisa lo anterior
  const juntos: Parcial = {}
  for (const texto of textos) {
    const p = leerMensaje(texto || '')
    for (const clave of Object.keys(p) as Array<keyof Parcial>) {
      if (p[clave] !== undefined) (juntos as Record<string, unknown>)[clave] = p[clave]
    }
  }

  const edadesMenores = juntos.edades ?? []
  let adultos = juntos.adultos ?? null
  let menores = juntos.menores ?? (edadesMenores.length ? edadesMenores.length : null)
  let pasajeros = juntos.pasajeros ?? null

  // Completa lo que se puede deducir de los otros dos números
  if (pasajeros !== null && adultos !== null && menores === null && pasajeros >= adultos) menores = pasajeros - adultos
  if (pasajeros !== null && menores !== null && adultos === null && pasajeros >= menores) adultos = pasajeros - menores
  if (pasajeros === null && adultos !== null && menores !== null) pasajeros = adultos + menores

  const avisos: string[] = []
  if (pasajeros !== null && adultos !== null && menores !== null && adultos + menores !== pasajeros) {
    avisos.push(`Los números no coinciden: ${adultos} adultos + ${menores} menores son ${adultos + menores}, pero dice que son ${pasajeros}.`)
  }
  if (menores !== null && menores > 0 && edadesMenores.length < menores) {
    const faltan = menores - edadesMenores.length
    avisos.push(faltan === 1 ? 'Falta la edad de 1 menor.' : `Faltan las edades de ${faltan} menores.`)
  }
  if (menores !== null && edadesMenores.length > menores) {
    avisos.push(`Hay más edades (${edadesMenores.length}) que menores (${menores}).`)
  }

  const nombre = juntos.nombre ?? null
  const destino = juntos.destino ?? null
  const presupuesto = juntos.presupuesto ?? null
  const fechas = juntos.fechas ?? null
  return {
    nombre,
    edad: juntos.edad ?? null,
    destino,
    pasajeros,
    adultos,
    menores,
    edadesMenores,
    presupuesto,
    fechas,
    avisos,
    hayDatos: !!nombre || !!destino || !!presupuesto || !!fechas || pasajeros !== null || adultos !== null || menores !== null || edadesMenores.length > 0,
  }
}

// Las edades como texto para pasarlas por la URL: "5,b,8" (b = bebé)
export function edadesATexto(edades: EdadMenor[]): string {
  return edades.map(e => (e === 'bebe' ? 'b' : String(e))).join(',')
}
export function edadesDeTexto(texto: string | null | undefined): EdadMenor[] {
  return String(texto ?? '').split(',').map(s => s.trim()).filter(Boolean).map(s => (s === 'b' ? 'bebe' : parseInt(s, 10))).filter(e => e === 'bebe' || Number.isFinite(e)) as EdadMenor[]
}
