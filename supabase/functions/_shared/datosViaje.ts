// Lee lo que el contacto contestó en el chat (por ejemplo, la plantilla "Datos
// para la propuesta") y saca cuántos viajan, cuántos son adultos y menores y la
// edad de cada menor, para completar solos la propuesta y la reserva.
//
// Lo más confiable es la plantilla con campos ("Adultos: 3"); también entiende
// frases sueltas ("somos 2 adultos y un nene de 6 años"), en español y en
// portugués. Siempre es una lectura automática: la pantalla muestra lo que
// entendió para que la persona lo confirme.

export type EdadMenor = number | 'bebe'

export interface DatosViaje {
  nombre: string | null
  edad: number | null // edad de quien escribe: dato informativo, no se usa en la propuesta
  pasajeros: number | null
  adultos: number | null
  menores: number | null
  edadesMenores: EdadMenor[]
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

function sinAcentos(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/[áàâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
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

interface Parcial {
  nombre?: string
  edad?: number
  pasajeros?: number
  adultos?: number
  menores?: number
  edades?: EdadMenor[]
}

const LINEA_CON_CAMPO = /^\s*(?:[-*•]\s*|\d+\s*[.)-]\s*)?(?:cantidad\s+de\s+|qtd\.?\s+de\s+|numero\s+de\s+)?(nombre|nome|edad(?:es)?(?:\s+de\s+(?:los\s+|as\s+|os\s+)?(?:menores|ninos|ninas|chicos|hijos|criancas))?|pasajeros|personas|pessoas|adultos|menores|ninos|criancas|chicos|hijos)\s*[:=]\s*(.*)$/

// Un mensaje: primero las líneas con campo ("Adultos: 3") y después el resto como frase libre.
function leerMensaje(original: string): Parcial {
  const p: Parcial = {}
  const restoLineas: string[] = []

  for (const linea of original.split(/\r?\n/)) {
    const norm = sinAcentos(linea)
    const m = LINEA_CON_CAMPO.exec(norm)
    if (!m) { restoLineas.push(norm); continue }
    const campo = m[1]
    const valor = m[2].trim()
    if (campo === 'nombre' || campo === 'nome') {
      // el nombre se toma del texto original, con sus mayúsculas y acentos
      const orig = linea.slice(linea.search(/[:=]/) + 1).trim().replace(/[.,;]+$/, '')
      if (orig && !/^\d+$/.test(orig) && orig.length <= 60) p.nombre = orig
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
  return {
    nombre,
    edad: juntos.edad ?? null,
    pasajeros,
    adultos,
    menores,
    edadesMenores,
    avisos,
    hayDatos: !!nombre || pasajeros !== null || adultos !== null || menores !== null || edadesMenores.length > 0,
  }
}

// Las edades como texto para pasarlas por la URL: "5,b,8" (b = bebé)
export function edadesATexto(edades: EdadMenor[]): string {
  return edades.map(e => (e === 'bebe' ? 'b' : String(e))).join(',')
}
export function edadesDeTexto(texto: string | null | undefined): EdadMenor[] {
  return String(texto ?? '').split(',').map(s => s.trim()).filter(Boolean).map(s => (s === 'b' ? 'bebe' : parseInt(s, 10))).filter(e => e === 'bebe' || Number.isFinite(e)) as EdadMenor[]
}
