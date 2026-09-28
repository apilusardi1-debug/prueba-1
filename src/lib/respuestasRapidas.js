// Ayudas de las respuestas rápidas del CRM: buscador, atajo "/" y campos que se
// completan solos al insertar una respuesta.

function sinTildes(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Primer nombre "presentable" de un contacto: se saltea emojis y símbolos, y si el
// contacto es solo un número de teléfono devuelve '' (no hay nombre que poner).
export function primerNombre(nombreCompleto) {
  const palabra = String(nombreCompleto || '').trim().split(/\s+/).find(p => /\p{L}/u.test(p))
  if (!palabra) return ''
  const limpia = palabra.replace(/[^\p{L}\p{M}'-]/gu, '')
  if (!limpia) return ''
  const restoEnMinuscula = limpia === limpia.toUpperCase() ? limpia.slice(1).toLowerCase() : limpia.slice(1)
  return limpia.charAt(0).toUpperCase() + restoEnMinuscula
}

// Si no se conoce el dato el campo queda escrito ({nombre}) para que se note y
// se complete a mano antes de enviar (ver hayCampoPendiente).
export function resolverCampos(texto, { nombre, agente }) {
  return String(texto || '')
    .replace(/\{nombre\}/gi, nombre || '{nombre}')
    .replace(/\{agente\}/gi, agente || '{agente}')
}

export function hayCampoPendiente(texto) {
  return /\{(nombre|agente)\}/i.test(String(texto || ''))
}

// Título que empieza con lo escrito primero, después título que lo contiene,
// después texto que lo contiene. Sin tildes ni mayúsculas.
export function buscarRespuestas(lista, consulta) {
  const q = sinTildes(consulta).trim()
  if (!q) return lista
  const puntaje = r => {
    const titulo = sinTildes(r.titulo)
    if (titulo.startsWith(q)) return 0
    if (titulo.includes(q)) return 1
    if (sinTildes(r.texto).includes(q)) return 2
    return -1
  }
  return lista
    .map(r => ({ r, p: puntaje(r) }))
    .filter(o => o.p >= 0)
    .sort((a, b) => a.p - b.p)
    .map(o => o.r)
}

// Si justo antes del cursor hay un "/algo" que arranca el texto o viene después
// de un espacio o salto de línea, devuelve lo escrito y dónde empieza la "/".
// "1/2" o una dirección web no lo activan.
export function atajoEnCursor(texto, cursor) {
  const antes = String(texto || '').slice(0, cursor)
  const m = antes.match(/(^|\s)\/([^\s/]*)$/)
  if (!m) return null
  return { consulta: m[2], desde: antes.length - m[2].length - 1 }
}
