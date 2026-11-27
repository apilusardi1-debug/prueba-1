// Chat para armar propuestas (solo local, 2026-11-01): el vendedor escribe los datos línea por
// línea ("Cliente: ...", "Pasajeros: ...") y el chat los entiende con reglas, sin IA y sin costo.
// No genera ningún PDF por su cuenta: le pasa los datos al formulario de GeneradorPropuesta, que
// los vuelca en sus mismos campos y usa su misma función generar() (mismo PDF de siempre).
import { useState, useEffect, useRef } from 'react'
import { habitacionesApi, importarHospedajesDeLink, propietariosApi } from '../../../lib/supabase.js'

const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const digitos = s => String(s ?? '').replace(/\D/g, '')
const formato = n => Number(n || 0).toLocaleString('es-AR')
const SIMBOLO = { BRL: 'R$', USD: 'U$D', ARS: 'ARS$' }

const DATOS_VACIOS = {
  cliente: '', adultos: null, edades: [], bebes: [], ida: '', vuelta: '',
  traslado: null, vuelo: null, hospedajes: [], moneda: null,
  niara: [], // lo cotizado en los links de Niara (puede haber varios): { nombre del hotel, habitacion, pension }
  tipo: 'simple', // 'simple' o 'combinada' (dos destinos, una etapa por destino)
  etapas: [], // combinada: { destino, ida, vuelta }
  equipaje: [], // equipaje opcional con precio: { tipo: 'carryOn' | 'valija23', precio }
  fechasDeNiara: false,
  equipajeIncluido: null, // { valija23: n }: valijas despachadas que ya incluye el precio del vuelo
  familias: [], // grupo: { adultos, edades, bebes } por familia; cada hospedaje trae un valor por familia
}

const INTRO = `Para armar la propuesta:

1. Escribí el nombre del cliente (solo el nombre).
2. Adjuntá la captura del vuelo.
3. Adjuntá la foto de la receta.
4. Pegá el link de la cotización de Niara (solo el link).

La receta se lee sola: pasajeros, hospedajes y precios. De Niara se toma la habitación de cada hospedaje, y las fotos y servicios salen del catálogo.

Si preferís, también podés cargar los datos a mano (botón "Insertar plantilla").`

// Hospedajes del catálogo cuya limpieza no está incluida (se cobra aparte). También se puede escribir "limpieza no incluida" en la línea del hospedaje.
const LIMPIEZA_NO_INCLUIDA = ['oka residence']

const PLANTILLA = 'Cliente: \nPasajeros: \nFechas: \nTraslado: \nHospedaje: \nHabitación: '

// "vende 1200, costo 900, privado, x2" -> {venta, costo, publico, cantidad}
function leerPrecios(txt) {
  const venta = (txt.match(/vend\w*\s*\$?\s*([\d.,]+)/i) || [])[1]
  const costo = (txt.match(/cost\w*\s*\$?\s*([\d.,]+)/i) || [])[1]
  const cant = (txt.match(/\bx\s*(\d+)\b/i) || [])[1]
  return {
    venta: venta ? digitos(venta) : '',
    costo: costo ? digitos(costo) : '',
    publico: !/privad/i.test(txt),
    cantidad: cant ? Math.max(1, parseInt(cant, 10)) : null,
  }
}

function iso(f) {
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}
function fechaCorta(isoStr) {
  if (!isoStr) return ''
  const [y, m, d] = isoStr.split('-')
  return `${d}/${m}/${y}`
}
function noches(ida, vuelta) {
  if (!ida || !vuelta) return null
  const n = Math.round((new Date(vuelta + 'T00:00:00') - new Date(ida + 'T00:00:00')) / 86400000)
  return n > 0 ? n : null
}

function leerFechas(v) {
  const f = v.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\D+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
  if (!f) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const anio = a => (a ? (a.length === 2 ? 2000 + +a : +a) : null)
  let ya = anio(f[3])
  let ida = new Date(ya ?? hoy.getFullYear(), +f[2] - 1, +f[1])
  if (!ya && ida < hoy) ida = new Date(hoy.getFullYear() + 1, +f[2] - 1, +f[1])
  let yb = anio(f[6]) ?? ida.getFullYear()
  let vuelta = new Date(yb, +f[5] - 1, +f[4])
  if (!anio(f[6]) && vuelta < ida) vuelta = new Date(yb + 1, +f[5] - 1, +f[4])
  if (vuelta <= ida) return null
  return { ida: iso(ida), vuelta: iso(vuelta) }
}

function leerPasajeros(v) {
  const a = v.match(/(\d+)\s*adult/i)
  const m = v.match(/(\d+)\s*(ni[nñ][oa]s?|menor(?:es)?|chic[oa]s?)/i)
  const b = v.match(/(\d+)\s*beb[eé]s?|\bbeb[eé]s?\b/i)
  if (!a && !m && !b) return null
  const nBebes = b ? (b[1] ? +b[1] : 1) : 0
  const nMenores = m ? +m[1] : 0
  let resto = ''
  if (m) resto = v.slice(m.index + m[0].length)
  if (b && b.index > (m?.index ?? -1)) resto = resto.split(/beb[eé]/i)[0]
  const nums = (resto.match(/\d+/g) || []).map(String)
  const edades = []
  const bebes = []
  for (let i = 0; i < nMenores; i++) { edades.push(nums[i] || ''); bebes.push(false) }
  for (let i = 0; i < nBebes; i++) { edades.push(''); bebes.push(true) }
  return { adultos: a ? +a[1] : null, edades, bebes }
}

// La receta pone el dueño entre paréntesis junto al hospedaje ("Cupe (Helmut)"): con ese nombre se encuentra el
// departamento exacto, porque en el catálogo cada habitación o departamento tiene cargado su propietario.
let propietariosCache = null
async function cargarPropietarios() {
  if (!propietariosCache) propietariosCache = (await propietariosApi.getAll())?.data || []
  return propietariosCache
}
// 2 = el nombre del dueño es exactamente ese; 1 = empieza con ese nombre ("Marcela, Anil 303" para "Marcela"); 0 = no es
function coincidenciaDueno(nombreDueno, buscado) {
  const n = norm(nombreDueno).trim()
  const q = norm(buscado).trim()
  if (!q || !n) return 0
  if (n === q) return 2
  return n.startsWith(q + ' ') || n.startsWith(q + ',') ? 1 : 0
}
// Entre los hospedajes candidatos busca las habitaciones cuyo dueño coincide; devuelve solo las de mejor coincidencia
async function buscarPorDueno(candidatos, dueno, cat) {
  const todos = await cargarPropietarios()
  const props = todos.filter(p => p.habitacion_id)
  const hallados = []
  await Promise.all(candidatos.filter(h => !cat[h.id]).map(async h => { cat[h.id] = (await habitacionesApi.getByHospedaje(h.id))?.data || [] }))
  for (const h of candidatos) {
    const pH = todos.find(x => x.hospedaje_id === h.id)
    const sH = pH ? coincidenciaDueno(pH.nombre_dueno, dueno) : 0
    if (sH) hallados.push({ h, hab: null, score: sH })
    for (const hab of cat[h.id]) {
      const p = props.find(x => x.habitacion_id === hab.id)
      const score = p ? coincidenciaDueno(p.nombre_dueno, dueno) : 0
      if (score) hallados.push({ h, hab, score })
    }
  }
  const mejor = Math.max(0, ...hallados.map(x => x.score))
  return hallados.filter(x => x.score === mejor)
}

const ALIAS_HOSPEDAJE = {
  cupe: 'Departamentos Cupe Beach Living',
  tomas: 'Torres do Porto',
  tomes: 'Torres do Porto',
  torres: 'Torres do Porto',
}

function buscarPorNombre(lista, texto, extra = () => '') {
  const q = norm(texto).trim()
  if (!q) return []
  const exacto = lista.find(x => norm(x.nombre) === q)
  if (exacto) return [exacto]
  const palabras = q.split(/\s+/)
  return lista.filter(x => palabras.every(w => norm(x.nombre + ' ' + extra(x)).includes(w)))
}

// La receta dice el hospedaje y la cotización de Niara dice QUÉ habitación se quiere. Acá se busca
// esa habitación en el catálogo (nombre exacto; si no, que haya una sola parecida) y se le pasa
// el precio y el costo del hospedaje, que es donde el formulario los guarda cuando hay habitación.
// Los nombres de habitación cambian según quién los escribe ("Duble room" en Niara, "Habitación doble" en el
// catálogo). Se ignoran las palabras de relleno y se unifican las variantes de idioma.
const PALABRAS_HAB = new Set(['habitacion', 'room', 'quarto', 'cuarto', 'de', 'la', 'el', 'con', 'para', 'apartamento'])
const SINONIMOS_HAB = { duble: 'doble', double: 'doble', duplo: 'doble', triplo: 'triple', quadruplo: 'cuadruple', cuadruplo: 'cuadruple', quadruple: 'cuadruple', standard: 'std', estandar: 'std', estandard: 'std' }
const fichasHab = t => norm(t).split(/[^a-z0-9]+/).filter(w => w && !PALABRAS_HAB.has(w)).map(w => SINONIMOS_HAB[w] || w)

function elegirHabitacion(habs, texto) {
  const q = norm(texto).trim()
  const exacta = habs.find(h => norm(h.nombre).trim() === q)
  if (exacta) return exacta
  const l = buscarPorNombre(habs, texto)
  if (l.length === 1) return l[0]
  const tq = fichasHab(texto)
  if (!tq.length) return null
  // Mismas palabras sin importar el orden, el idioma ni el relleno
  const iguales = habs.filter(h => { const t = fichasHab(h.nombre); return t.length === tq.length && tq.every(w => t.includes(w)) })
  if (iguales.length === 1) return iguales[0]
  // Si no, la que tenga todas las palabras pedidas con menos palabras de más (solo si hay una sola)
  const contienen = habs.map(h => ({ h, t: fichasHab(h.nombre) })).filter(x => tq.every(w => x.t.some(u => similitud(w, u) >= 0.8)))
  if (!contienen.length) return null
  const minimo = Math.min(...contienen.map(x => x.t.length))
  const mejores = contienen.filter(x => x.t.length === minimo)
  return mejores.length === 1 ? mejores[0].h : null
}

// La habitación sale de lo que cotizó Niara; si el hotel no está en Niara (o su habitación no está en el
// catálogo), de la unidad que dice la receta (ej. "307" en Porto Florencia).
async function asignarHabitacion(d, spec, cat, ent) {
  if (spec.habitaciones.length || !spec.hDB.id) return
  const b = norm(spec.hDB.nombre)
  const n = (d.niara || []).find(x => { const a = norm(x.nombre); return a && b && (a.includes(b) || b.includes(a)) })
  // El desayuno que informa Niara se usa si la receta no marcó ninguna pensión
  if (n && !spec.pension && n.pension) spec.pension = n.pension
  // 1) La habitación que cotizó Niara, 2) la unidad que dice la receta, 3) la única que tiene en nuestro catálogo.
  // Si nada alcanza, queda para que se elija con botones entre las habitaciones del catálogo (ver habPend).
  const pedidas = [spec.habDueno && { habId: spec.habDueno.id, texto: spec.habDueno.nombre, origen: `la del dueño ${spec.dueno}` }, n?.habitacion && { texto: n.habitacion, origen: 'la que se cotizó en Niara' }, spec.detalle && { texto: spec.detalle, origen: 'la de la receta' }].filter(Boolean)
  if (!cat[spec.hDB.id]) cat[spec.hDB.id] = (await habitacionesApi.getByHospedaje(spec.hDB.id))?.data || []
  const habs = cat[spec.hDB.id]
  let hab = null
  let origen = ''
  for (const p of pedidas) {
    hab = (p.habId && habs.find(x => x.id === p.habId)) || elegirHabitacion(habs, p.texto)
    if (hab) { origen = p.origen; break }
  }
  if (!hab && habs.length === 1) { hab = habs[0]; origen = 'la única que tiene en el catálogo' }
  spec.motivoHab = hab ? '' : (pedidas.length ? `Se pidió "${pedidas[0].texto.trim()}" y no está en el catálogo de este hospedaje.` : '')
  if (!hab) return
  spec.habitaciones.push({
    hab: { id: hab.id, nombre: hab.nombre, imagen: hab.imagen || '', video: hab.video || '', descripcion: hab.descripcion || '', amenities: hab.amenities || [] },
    cantidad: 1, venta: spec.venta, costo: spec.costo, publico: spec.publico,
  })
  spec.venta = ''
  spec.costo = ''
  ent.push(`Habitación de ${spec.hDB.nombre}: ${hab.nombre} (${origen})`)
}

// Sugerencias por parecido: la receta es a mano y la IA a veces lee mal un nombre ("Pezinho Lobo" por
// "Recanto do Lobo"). Se comparan las palabras con un margen de error y se ignoran las genéricas.
const PALABRAS_SUELTAS = new Set(['pousada', 'posada', 'hotel', 'resort', 'do', 'da', 'de', 'dos', 'das', 'by', 'la', 'playa', 'stays', 'porto', 'galinhas', 'maragogi', 'recife', 'flat', 'beach', 'living'])
function distancia(a, b) {
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]
}
const similitud = (a, b) => 1 - distancia(a, b) / Math.max(a.length, b.length)
const fichas = t => norm(t).split(/[^a-z0-9]+/).filter(w => w.length > 1 && !PALABRAS_SUELTAS.has(w))
function sugerir(lista, nombre, destino) {
  const q = fichas(nombre)
  if (!q.length) return []
  const dn = norm(destino || '')
  return lista.map(h => {
    const t = fichas(h.nombre)
    let suma = 0
    let fuerte = false
    for (const w of q) {
      const mejor = Math.max(0, ...t.map(x => similitud(w, x)))
      if (mejor >= 0.8 && w.length >= 4) fuerte = true // una palabra corta como "mar" coincide con cualquier cosa
      if (mejor >= 0.6) suma += mejor
    }
    return { h, fuerte, score: suma / q.length + (dn && norm(h.destino || '') === dn ? 0.05 : 0) }
  }).filter(x => x.fuerte && x.score >= 0.4).sort((a, b) => b.score - a.score).slice(0, 3).map(x => x.h)
}

// El desayuno de Niara se escribe siempre igual, diga lo que diga ("Desayuno", "cesta de desayuno", "Breakfast",
// "Café da manhã"): "Desayuno incluido". Si la comida trae algo más que el desayuno (almuerzo, cena, pensión,
// todo incluido), se deja el texto de Niara para no decir que es solo desayuno.
function pensionDeNiara(texto) {
  const t = String(texto || '').trim()
  if (!t) return ''
  if (/media pensi/i.test(norm(t))) return 'Media pensión'
  if (/pensi[oó]n completa|full board/i.test(t)) return 'Pensión completa'
  if (/todo incluido|all inclusive/i.test(t)) return 'All Inclusive'
  if (/almuerzo|cena|dinner|lunch|pensi[oó]n/i.test(t)) return t
  return /desayun|cesta|caf[eé]|breakfast|manh[aã]|manana/i.test(norm(t)) || /desayun|cesta|caf[eé]|breakfast|manh/i.test(t) ? 'Desayuno incluido' : t
}

// Busca el hotel entre los que ya se leyeron de los links de Niara (nombre exacto, que contenga las
// palabras o el más parecido).
function hotelDeNiara(d, nombre) {
  const lista = d.niara || []
  if (!lista.length) return null
  const q = norm(nombre).trim()
  const exacto = lista.find(n => norm(n.nombre).trim() === q)
  if (exacto) return exacto
  const contiene = buscarPorNombre(lista, nombre)
  if (contiene.length === 1) return contiene[0]
  return sugerir(lista, nombre)[0] || null
}

// Lee un mensaje y devuelve los datos actualizados + qué entendió, qué no y qué dudas quedaron.
// "3 adultos y 1 menor de 12 años"
function descFamilia(f) {
  const a = `${f.adultos} adulto${f.adultos > 1 ? 's' : ''}`
  const ed = (f.edades || []).filter(Boolean)
  const nBebes = (f.bebes || []).filter(Boolean).length
  const nMenores = (f.edades || []).length - nBebes
  const partes = [a]
  if (nMenores > 0) partes.push(`${nMenores} menor${nMenores > 1 ? 'es' : ''}${ed.length ? ` de ${ed.join(' y ')} años` : ''}`)
  if (nBebes > 0) partes.push(`${nBebes} bebé${nBebes > 1 ? 's' : ''}`)
  return partes.join(' y ')
}

async function procesar(texto, d0, cat, catalogo) {
  const d = structuredClone(d0)
  const ent = []
  const no = []
  const ambiguos = []
  const pendientes = [] // hospedajes de la receta que no se pudieron cargar solos
  let tocoHosp = false
  let familiasNuevas = false
  const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean)
  for (const l of lineas) {
    // Un link que tiene "niara" adentro es una cotización de Niara: no hace falta escribir "Niara:"
    const m = /^https?:\/\/\S*niara/i.test(l) ? ['', 'niara', l] : l.match(/^([^:]+):\s*(.*)$/)
    if (!m) {
      // Una línea solo con letras (1 a 5 palabras, sin números) es el nombre del cliente
      if (/^[\p{L}][\p{L}'.\- ]*$/u.test(l) && l.split(/\s+/).length <= 5) {
        d.cliente = l
        ent.push('Cliente: ' + l)
      } else no.push(l)
      continue
    }
    const k = norm(m[1]).trim()
    const v = m[2].trim()
    if (k === 'cliente') {
      if (!v) { no.push(l); continue }
      d.cliente = v
      ent.push('Cliente: ' + v)
    } else if (k.startsWith('familia')) {
      // "Familia: 3 adultos, 1 niño 12": una por línea, en orden (Familia 1, 2, 3...)
      const p = leerPasajeros(v)
      if (!p || !p.adultos) { no.push(l); continue }
      if (!familiasNuevas) { d.familias = []; familiasNuevas = true }
      d.familias.push({ adultos: p.adultos, edades: p.edades, bebes: p.bebes })
      d.tipo = 'grupo'
      d.adultos = d.familias.reduce((s, f) => s + f.adultos, 0)
      d.edades = d.familias.flatMap(f => f.edades)
      d.bebes = d.familias.flatMap(f => f.bebes)
      ent.push(`Familia ${d.familias.length}: ${descFamilia(d.familias[d.familias.length - 1])}`)
    } else if (k.startsWith('pasajero')) {
      const p = leerPasajeros(v)
      if (!p) { no.push(l); continue }
      d.adultos = p.adultos ?? d.adultos ?? 0
      d.edades = p.edades
      d.bebes = p.bebes
      ent.push(`Pasajeros: ${d.adultos} adultos, ${d.edades.length} menores${d.edades.filter(Boolean).length ? ` (edades ${d.edades.filter(Boolean).join(' y ')})` : ''}${d.bebes.some(Boolean) ? ', con bebé' : ''}`)
    } else if (k.startsWith('fecha')) {
      const f = leerFechas(v)
      if (!f) { no.push(l); continue }
      d.ida = f.ida
      d.vuelta = f.vuelta
      d.fechasDeNiara = false
      ent.push(`Fechas: ${fechaCorta(f.ida)} al ${fechaCorta(f.vuelta)} (${noches(f.ida, f.vuelta)} noches)`)
    } else if (k === 'tipo') {
      d.tipo = /\bgrupo\b/.test(norm(v)) ? 'grupo' : /\buni\b/.test(norm(v)) ? 'combinada_uni' : /combinad/.test(norm(v)) ? 'combinada' : 'simple'
      ent.push('Tipo de propuesta: ' + (d.tipo === 'grupo' ? 'grupo (varias familias, un valor por familia)' : d.tipo === 'combinada_uni' ? 'combinada uni (un hospedaje fijo y varias opciones)' : d.tipo === 'combinada' ? 'combinada (dos destinos)' : 'simple'))
    } else if (k === 'etapa') {
      // "Etapa: Porto de Galinhas, 11/02/2027 al 17/02/2027": un destino con sus fechas
      const partes = v.split(',')
      const destino = partes[0].trim()
      const f = leerFechas(partes.slice(1).join(','))
      if (!destino || !f) { no.push(l); continue }
      if (d.tipo === 'simple') d.tipo = 'combinada'
      d.etapas = [...d.etapas.filter(e => norm(e.destino) !== norm(destino)), { destino, ida: f.ida, vuelta: f.vuelta }]
      ent.push(`Etapa: ${destino}, ${fechaCorta(f.ida)} al ${fechaCorta(f.vuelta)} (${noches(f.ida, f.vuelta)} noches)`)
    } else if (k.startsWith('equipaje incl')) {
      // "Equipaje incluido: valija 1": valijas despachadas que ya trae el precio del vuelo
      const n = parseInt((v.match(/valija[^\d]*(\d+)/i) || [])[1] || '0', 10)
      const carryInc = /carry/i.test(v)
      if (!n && !carryInc) { no.push(l); continue }
      d.equipajeIncluido = { valija23: n, carryOn: carryInc }
      ent.push(`Equipaje incluido: ${[carryInc && 'carry on', n && `${n} valija despachada de 23 kg`].filter(Boolean).join(' y ')}`)
    } else if (k.startsWith('equipaje')) {
      // "Equipaje: carry on 110, valija 160": equipaje opcional, con su precio
      const carry = (v.match(/carry[^\d,]*([\d.]+)/i) || [])[1]
      const valija = (v.match(/valija[^\d,]*([\d.]+)/i) || [])[1]
      if (!carry && !valija) { no.push(l); continue }
      d.equipaje = [
        ...(carry ? [{ tipo: 'carryOn', precio: digitos(carry) }] : []),
        ...(valija ? [{ tipo: 'valija23', precio: digitos(valija) }] : []),
      ]
      ent.push('Equipaje opcional: ' + [carry && `carry on ${formato(digitos(carry))}`, valija && `valija 23 kg ${formato(digitos(valija))}`].filter(Boolean).join(', '))
    } else if (k === 'traslado') {
      const n = norm(v.split(',')[0])
      const p = leerPrecios(v)
      if (/^(no|ninguno|sin)/.test(n)) { d.traslado = null; ent.push('Traslado: sin traslado'); continue }
      let ida = false
      let vuelta = false
      if (/ida y vuelta|ida\/vuelta|ida-vuelta|ida e volta/.test(n)) { ida = true; vuelta = true }
      else if (/solo vuelta|^vuelta/.test(n)) vuelta = true
      else if (/solo ida|^ida/.test(n)) ida = true
      else { no.push(l); continue }
      d.traslado = { ida, vuelta, venta: p.venta, costo: p.costo, publico: p.publico }
      ent.push('Traslado: ' + (ida && vuelta ? 'ida y vuelta' : ida ? 'solo ida' : 'solo vuelta') + (p.venta ? `, vende ${formato(p.venta)}` : ''))
    } else if (k === 'vuelo') {
      const p = leerPrecios(v)
      if (!p.venta) { no.push(l); continue }
      d.vuelo = { venta: p.venta, costo: p.costo, publico: p.publico }
      ent.push(`Vuelo: vende ${formato(p.venta)}`)
    } else if (k === 'moneda') {
      const n = norm(v)
      d.moneda = /usd|dolar|u\$d/.test(n) ? 'USD' : /brl|real|r\$/.test(n) ? 'BRL' : /ars|peso/.test(n) ? 'ARS' : null
      if (!d.moneda) { no.push(l); continue }
      ent.push('Moneda: ' + SIMBOLO[d.moneda])
    } else if (k === 'niara' || k.startsWith('cotizacion')) {
      // Trae los hospedajes de la cotización de Niara con el precio que trae el link
      if (!/^https?:\/\//i.test(v)) { no.push(`${l}  (pegá el link de la cotización de Niara)`); continue }
      const { data, error } = await importarHospedajesDeLink(v)
      if (error || !data?.hospedajes?.length) {
        no.push(`${l}  (${data?.error || error?.message || 'no pude leer ese link'})`)
        continue
      }
      // Se pueden pegar varios links (uno por destino): cada uno suma a lo ya leído
      d.niara = [...(d.niara || []), ...data.hospedajes.map(n => ({
        nombre: n.nombre, habitacion: n.habitacion_cotizada || '', pension: pensionDeNiara(n.pension),
        hotel: { destino: n.destino || '', tipo: n.tipo || '', imagen: n.imagen || '', descripcion: n.descripcion || '', amenities: n.amenities || [] },
      }))]
      // Niara va primero: deja registrados los hoteles, sus habitaciones y su desayuno. La receta pone los
      // hospedajes y los precios, y lo que no entienda lo resuelve con estos datos.
      tocoHosp = true
      for (const spec of d.hospedajes) await asignarHabitacion(d, spec, cat, ent)
      for (const n of data.hospedajes) ent.push(`Niara: ${n.nombre}${n.habitacion_cotizada ? ` · ${n.habitacion_cotizada}` : ''}${n.noches ? ` · ${n.noches} noches` : ''}`)
      // La cotización también trae fechas, pasajeros y edades de los menores: se usan si todavía no los cargaste
      const p0 = data.hospedajes[0]
      if (!d.ida && p0.fecha_entrada && p0.fecha_salida) {
        d.ida = p0.fecha_entrada
        d.vuelta = p0.fecha_salida
        d.fechasDeNiara = true
        ent.push(`Fechas: ${fechaCorta(d.ida)} al ${fechaCorta(d.vuelta)} (de la cotización)`)
      }
      if (d.adultos == null && !d.edades.length && p0.adultos != null) {
        d.adultos = p0.adultos
        d.edades = (p0.edades_menores || []).map(String)
        d.bebes = d.edades.map(() => false)
        ent.push(`Pasajeros: ${d.adultos} adultos, ${d.edades.length} menores${d.edades.length ? ` (edades ${d.edades.join(' y ')})` : ''} (de la cotización)`)
      }
      const mon = data.hospedajes[0].moneda
      if (!d.moneda && (mon === 'USD' || mon === 'BRL' || mon === 'ARS')) d.moneda = mon
    } else if (k.startsWith('hosped')) {
      const partes = v.split(',')
      const nombre = partes[0]
      const cola = partes.slice(1).join(',')
      // Apodos de la receta que se leen mal o son ambiguos: "Cupe" es el complejo Cupe Beach Living y la letra de
      // "Torres" suele leerse "Tomas"
      const nombreBusq = ALIAS_HOSPEDAJE[norm(nombre).trim()] || nombre
      const lista = buscarPorNombre(catalogo, nombreBusq, h => h.destino || '')
      if (!nombre.trim()) { no.push(l); continue }
      let elegido = lista.length === 1 ? lista[0] : null
      let deNiara = null
      // Con el dueño de la receta se encuentra el departamento exacto (y se resuelve "Cupe" o "Torres" sin preguntar)
      const duenoReceta = (cola.match(/dueno\s+([^,]+)/i) || [])[1]?.trim() || ''
      let habDueno = null
      let candidatosDueno = []
      if (duenoReceta && (lista.length || !elegido)) {
        const hallados = await buscarPorDueno(lista.length ? lista : catalogo, duenoReceta, cat)
        const hospedajes = [...new Map(hallados.map(x => [x.h.id, x.h])).values()]
        if (hospedajes.length === 1) {
          elegido = hospedajes[0]
          if (hallados.length === 1) habDueno = hallados[0].hab || null
        } else if (hospedajes.length > 1) candidatosDueno = hospedajes
      }
      if (!elegido) {
        // Lo que el catálogo no resuelve se busca en las cotizaciones de Niara ya pegadas
        const nh = hotelDeNiara(d, nombre)
        if (nh) {
          const enCat = buscarPorNombre(catalogo, nh.nombre)
          if (enCat.length === 1) elegido = enCat[0]
          else if (enCat.length === 0) deNiara = nh
        }
      }
      if (elegido || deNiara) {
        const h = elegido || { id: null, nombre: deNiara.nombre, ...deNiara.hotel }
        if (h.id && !cat[h.id]) cat[h.id] = (await habitacionesApi.getByHospedaje(h.id))?.data || []
        const p = leerPrecios(cola)
        const pension = (cola.match(/pensi[oó]n\s+([^,]+)/i) || [])[1]?.trim() || ''
        // Total que ve el cliente según la receta (el número entre paréntesis): sirve para comprobar la suma
        const totalReceta = (cola.match(/total\s+(\d+)/i) || [])[1] || ''
        const dueno = (cola.match(/dueno\s+([^,]+)/i) || [])[1]?.trim() || ''
        // Combinada: a qué etapa (destino) pertenece, para sus fechas y noches
        const etapa = (cola.match(/etapa\s+([^,]+)/i) || [])[1]?.trim() || ''
        // Unidad o tipo de habitación que dice la receta (ej. "307"): se usa si Niara no la informa
        const detalle = (cola.match(/habitaci[oó]n\s+([^,]+)/i) || [])[1]?.trim() || ''
        // Combinada uni: el hospedaje del destino que tiene uno solo va incluido en todas las opciones
        const fijo = /(?:^|,)\s*fijo\s*(?:,|$)/i.test(cola)
        const limpiezaNoIncluida = /limpieza\s+no\s+incluida/i.test(cola) || LIMPIEZA_NO_INCLUIDA.includes(norm(h.nombre).trim())
        // Grupo: el valor total de cada familia, en el orden de las familias ("familias 6085000/8689000/7499000")
        const famVals = (cola.match(/familias\s+([\d/]+)/i) || [])[1]
        const valoresFamilia = famVals ? famVals.split('/').map(x => parseInt(x, 10) || 0) : null
        d.hospedajes.push({
          hDB: { id: h.id, nombre: h.nombre, destino: h.destino || '', tipo: h.tipo || '', imagen: h.imagen || '', descripcion: h.descripcion || '', amenities: h.amenities || [] },
          habDueno, habitaciones: [], venta: p.venta, costo: p.costo, publico: p.publico, pension, dueno, totalReceta, etapa, detalle, fijo, valoresFamilia, limpiezaNoIncluida,
          // Video de la plataforma: el del hospedaje o, si no tiene, el primero que haya en sus habitaciones/departamentos
          videoDepto: h.video || (cat[h.id] || []).find(x => x.video)?.video || '',
        })
        ent.push('Hospedaje: ' + h.nombre + (p.venta ? `, vende ${formato(p.venta)}` : '') + (valoresFamilia ? `, por familia: ${valoresFamilia.map(formato).join(' / ')}` : '') + (p.costo ? `, costo R$ ${formato(p.costo)} (interno)` : '') + (pension ? `, ${pension}` : '') + (dueno ? ` (dueño: ${dueno}, solo interno)` : '') + (limpiezaNoIncluida ? ', limpieza no incluida' : ''))
        if (deNiara) {
          const sp = d.hospedajes[d.hospedajes.length - 1]
          if (!sp.pension && deNiara.pension) sp.pension = deNiara.pension
          sp.habitacionTexto = deNiara.habitacion || ''
          ent[ent.length - 1] += ' (no está en el catálogo: uso los datos de Niara)'
        }
        tocoHosp = true
        await asignarHabitacion(d, d.hospedajes[d.hospedajes.length - 1], cat, ent)
      } else {
        // No se pudo cargar solo: va a "Por resolver", con hasta 3 sugerencias parecidas
        const etapaP = (cola.match(/etapa\s+([^,]+)/i) || [])[1]?.trim() || ''
        const pv = leerPrecios(cola)
        const base = lista.length > 1 ? lista : catalogo
        let sugs = sugerir(base, nombre, etapaP)
        // El nombre es ambiguo ("Cupe" tiene varios): se muestran todos los que coinciden, no solo 3
        if (lista.length > 1) sugs = [...sugs, ...lista.filter(x => !sugs.includes(x))].slice(0, 6)
        if (candidatosDueno.length) sugs = [...candidatosDueno, ...sugs.filter(x => !candidatosDueno.includes(x))].slice(0, 6)
        pendientes.push({
          nombre: nombre.trim(), destino: etapaP, venta: pv.venta, cola, varios: lista.length > 1,
          sugerencias: sugs.map(c => ({ nombre: c.nombre, linea: `Hospedaje: ${c.nombre}${cola ? ',' + cola : ''}` })),
        })
      }
    } else if (k.startsWith('habitaci')) {
      // "Habitación en <hospedaje>: <habitación>" apunta a ese hospedaje; "Habitación: <habitación>", al último cargado
      const objetivo = k.match(/^habitaci\w*\s+(?:de|en)\s+(.+)$/)
      const ultimo = objetivo
        ? (d.hospedajes.find(h => norm(h.hDB.nombre).trim() === objetivo[1].trim()) || d.hospedajes.find(h => norm(h.hDB.nombre).includes(objetivo[1].trim())))
        : d.hospedajes[d.hospedajes.length - 1]
      if (!ultimo) { no.push(`${l}  (primero cargá el hospedaje)`); continue }
      const partes = v.split(',')
      const cola = partes.slice(1).join(',')
      const nombre = partes[0].replace(/\bx\s*\d+\b/i, '').trim()
      const p = leerPrecios(v)
      const habs = cat[ultimo.hDB.id] || []
      const lista = buscarPorNombre(habs, nombre)
      if (ultimo.habitaciones.length >= 4) { no.push(`${l}  (máximo 4 habitaciones por hospedaje)`); continue }
      if (lista.length === 1) {
        ultimo.habitaciones.push({
          hab: { id: lista[0].id, nombre: lista[0].nombre, imagen: lista[0].imagen || '', video: lista[0].video || '', descripcion: lista[0].descripcion || '', amenities: lista[0].amenities || [] },
          cantidad: p.cantidad || 1, venta: p.venta || ultimo.venta, costo: p.costo || ultimo.costo, publico: p.publico,
        })
        // El precio del hospedaje pasa a la habitación elegida (así no se cuenta dos veces)
        if (!ultimo.habitaciones.slice(0, -1).length) { ultimo.venta = ''; ultimo.costo = '' }
        ent.push(`Habitación: ${lista[0].nombre}${p.cantidad > 1 ? ' x' + p.cantidad : ''}${p.venta ? `, vende ${formato(p.venta)}` : ''}`)
      } else if (lista.length > 1) {
        ambiguos.push({ opciones: lista.map(h => h.nombre), armar: n => `Habitación: ${n}${cola ? ',' + cola : ''}` })
      } else {
        no.push(`${l}  (ese hospedaje no tiene esa habitación${habs.length ? '; tiene: ' + habs.map(h => h.nombre).join(', ') : ''})`)
      }
    } else {
      no.push(l)
    }
  }
  ordenarHospedajes(d)
  // Hospedajes del catálogo con varias habitaciones y ninguna elegida: se elige entre las del catálogo
  const habPend = tocoHosp
    ? d.hospedajes.filter(h => !h.habitaciones.length && h.hDB.id && (cat[h.hDB.id] || []).length > 1)
      .map(h => ({ hospedaje: h.hDB.nombre, motivo: h.motivoHab || '', sinNiara: !(d.niara || []).length, enNiara: [...new Set((d.niara || []).map(n => n.nombre))], opciones: cat[h.hDB.id].map(x => x.nombre) }))
    : []
  return { datos: d, ent, no, ambiguos, pendientes, habPend }
}

function faltantes(d, hayVuelo) {
  const f = []
  if (!d.cliente) f.push('el cliente')
  if (d.adultos == null && !d.edades.length) f.push('los pasajeros')
  const sinEdad = d.edades.filter((e, i) => !e && !d.bebes[i]).length
  if (sinEdad) f.push(sinEdad === 1 ? 'la edad del menor (ej: Pasajeros: 2 adultos, 1 niño 6; o bebé si es menor de 1 año)' : 'las edades de los menores')
  if (d.tipo === 'grupo') {
    if (d.familias.length < 2) f.push('las familias (Familia: 2 adultos, una línea por familia)')
    d.hospedajes.filter(h => h.valoresFamilia?.length !== d.familias.length).forEach(h => f.push(`el valor de cada familia en ${h.hDB.nombre}`))
  }
  // Con solo el vuelo cargado el PDF salía con la hoja de aéreos y nada más: hace falta al menos un hospedaje
  if (!d.hospedajes.length) f.push('al menos un hospedaje (subí la receta o escribí  Hospedaje: nombre, vende 1200)')
  return f
}

function avisosDe(d, fechasVuelo, vueloVenta) {
  const a = []
  if (!d.ida && !fechasVuelo) a.push('No cargaste las fechas (sirven para las noches y para el vuelo).')
  if (d.tipo === 'grupo' && !d.equipaje.length) a.push('No cargaste el equipaje opcional. Si va en la propuesta, escribí: Equipaje: carry on 170000, valija 240000')
  d.hospedajes.forEach(h => {
    const conPrecio = h.habitaciones.length ? h.habitaciones.every(r => r.venta) : !!h.venta
    if (h.totalReceta && conPrecio) {
      const suma = totalOpcion(d, h, vueloVenta)
      if (suma !== parseInt(h.totalReceta, 10)) a.push(`${h.hDB.nombre}: la suma (${formato(suma)}) no coincide con el total de la receta (${formato(h.totalReceta)}). Revisá los números.`)
    }
    if (!conPrecio) a.push(`${h.hDB.nombre}: falta el precio${h.habitaciones.length ? ' de alguna habitación' : ''}. Escribilo con "vende 1200".`)
  })
  return a
}

// Orden de los hospedajes en la propuesta: de mayor a menor precio. En la combinada se mantiene el
// orden de las etapas (primero Porto, después Maragogi) y dentro de cada etapa va de mayor a menor.
function ordenarHospedajes(d) {
  const precio = h => (h.valoresFamilia?.length ? h.valoresFamilia.reduce((s, x) => s + x, 0) : h.habitaciones.length
    ? h.habitaciones.reduce((s, r) => s + parseInt(r.venta || 0, 10) * (r.cantidad || 1), 0)
    : parseInt(h.venta || 0, 10))
  const orden = h => {
    if (d.tipo !== 'combinada' && d.tipo !== 'combinada_uni') return 0
    const i = d.etapas.findIndex(e => norm(e.destino) === norm(h.etapa || h.hDB.destino))
    return i < 0 ? 99 : i
  }
  d.hospedajes = d.hospedajes
    .map((h, i) => ({ h, i }))
    .sort((a, b) => orden(a.h) - orden(b.h) || precio(b.h) - precio(a.h) || a.i - b.i)
    .map(x => x.h)
}

// Venta del hospedaje (o de sus habitaciones)
const ventaDe = h => (h.habitaciones.length
  ? h.habitaciones.reduce((s, r) => s + parseInt(r.venta || 0, 10) * (r.cantidad || 1), 0)
  : parseInt(h.venta || 0, 10))

function totalOpcion(d, h, vueloVenta) {
  // Combinada: cada hospedaje muestra solo su propio valor (el vuelo y el traslado forman la base del viaje).
  // Combinada uni: cada opción suma vuelo + traslado + el hospedaje fijo del otro destino.
  const fijos = d.tipo === 'combinada_uni' && !h.fijo ? d.hospedajes.filter(x => x.fijo).reduce((s, x) => s + ventaDe(x), 0) : 0
  const base = d.tipo === 'combinada' ? 0 : (vueloVenta || 0) + (d.traslado ? parseInt(d.traslado.venta || 0, 10) : 0) + fijos
  const hosp = h.habitaciones.length
    ? h.habitaciones.reduce((s, r) => s + parseInt(r.venta || 0, 10) * (r.cantidad || 1), 0)
    : parseInt(h.venta || 0, 10)
  return base + hosp
}

function Bloque({ titulo, children }) {
  return (
    <div className="border-t border-gray-200 dark:border-zinc-700 pt-2 space-y-1.5">
      <h4 className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-zinc-400">{titulo}</h4>
      {children}
    </div>
  )
}

// Un hospedaje de la receta que no se pudo cargar solo: sugerencias parecidas, buscar a mano o dejarlo para después
function PendienteCard({ p, hospedajesDB, onChip, sim }) {
  const [buscando, setBuscando] = useState(false)
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState(null) // null | { despues } | { elegido: nombre }
  const palabras = norm(q).split(/\s+/).filter(Boolean)
  const resultados = q.trim().length >= 2
    ? (hospedajesDB || []).filter(h => palabras.every(w => norm(h.nombre + ' ' + (h.destino || '')).includes(w))).slice(0, 6)
    : []
  const elegir = nombre => {
    setEstado({ elegido: nombre })
    onChip(`Hospedaje: ${nombre}${p.cola ? ',' + p.cola : ''}`, `Elegí: ${nombre}`)
  }
  if (estado?.despues) return <p className="text-xs text-gray-500 dark:text-zinc-400">{p.nombre}: se carga después.</p>
  if (estado?.elegido) return <p className="text-xs text-green-700 dark:text-green-400">{p.nombre}: cargado como {estado.elegido}.</p>
  const BTN = 'rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs text-gray-800 dark:text-zinc-200 hover:border-gray-900 dark:hover:border-zinc-300'
  return (
    <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 space-y-1.5">
      <div className="flex flex-wrap justify-between gap-x-3">
        <b className="text-sm text-gray-900 dark:text-zinc-100">{p.nombre}</b>
        <span className="text-xs text-gray-500 dark:text-zinc-400">{[p.destino, p.venta ? `${sim} ${formato(p.venta)}` : ''].filter(Boolean).join(' · ')}</span>
      </div>
      <p className="text-xs text-amber-700 dark:text-amber-400">
        {p.sugerencias.length ? (p.varios ? 'Hay varios con ese nombre. ¿Cuál es?' : 'No encontré ese nombre. ¿Es alguno de estos?') : 'No está en el catálogo.'}
      </p>
      <div className="flex flex-wrap gap-1.5 items-center">
        {p.sugerencias.map((s, i) => (
          <button key={i} type="button" onClick={() => elegir(s.nombre)}
            className="rounded-lg bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-2.5 py-1 text-xs font-semibold">{s.nombre}</button>
        ))}
        <button type="button" className={BTN} onClick={() => setBuscando(b => !b)}>Buscar en el catálogo…</button>
        <button type="button" className={BTN + ' !text-gray-500 dark:!text-zinc-400'} onClick={() => setEstado({ despues: true })}>Cargar después</button>
      </div>
      {buscando && (
        <div className="space-y-1">
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Escribí parte del nombre"
            className="w-full rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs text-gray-900 dark:text-zinc-100" />
          {resultados.map(h => (
            <button key={h.id} type="button" onClick={() => elegir(h.nombre)}
              className="block w-full text-left rounded-lg px-2.5 py-1 text-xs hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-800 dark:text-zinc-200">
              {h.nombre} <span className="text-gray-400 dark:text-zinc-500">{h.destino}</span>
            </button>
          ))}
          {q.trim().length >= 2 && !resultados.length && <p className="text-xs text-gray-500 dark:text-zinc-400">No hay ninguno con ese nombre en el catálogo.</p>}
        </div>
      )}
    </div>
  )
}

// Un hospedaje del catálogo con varias habitaciones y ninguna elegida por Niara ni por la receta: se elige entre las del catálogo
function HabitacionCard({ p, onChip }) {
  const [estado, setEstado] = useState(null) // null | { despues } | { elegida }
  const elegir = nombre => {
    setEstado({ elegida: nombre })
    onChip(`Habitación en ${p.hospedaje}: ${nombre}`, `Elegí: ${nombre}`)
  }
  if (estado?.despues) return <p className="text-xs text-gray-500 dark:text-zinc-400">{p.hospedaje}: sin habitación por ahora.</p>
  if (estado?.elegida) return <p className="text-xs text-green-700 dark:text-green-400">{p.hospedaje}: habitación {estado.elegida}.</p>
  const BTN = 'rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs text-gray-800 dark:text-zinc-200 hover:border-gray-900 dark:hover:border-zinc-300 text-left'
  return (
    <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 space-y-1.5">
      <b className="text-sm text-gray-900 dark:text-zinc-100">{p.hospedaje}</b>
      <p className="text-xs text-amber-700 dark:text-amber-400">{p.motivo || (p.sinNiara ? 'Todavía no pegaste el link de Niara: pegalo y la habitación se completa sola. O elegila acá (sin habitación no sale el botón "Ver áreas internas").' : `Los links de Niara que pegaste traen: ${(p.enNiara || []).join(', ') || 'ningún hotel'}. Ahí no figura este hotel (y la receta no dice la habitación). ¿Cuál es? Si falta un link, pegalo y se completa sola.`)}</p>
      <div className="flex flex-wrap gap-1.5 items-center">
        {p.opciones.slice(0, 10).map((o, i) => <button key={i} type="button" className={BTN} onClick={() => elegir(o)}>{o}</button>)}
        <button type="button" className={BTN + ' !text-gray-500 dark:!text-zinc-400'} onClick={() => setEstado({ despues: true })}>Sin habitación</button>
      </div>
    </div>
  )
}

function Mensaje({ m, onChip, hospedajesDB }) {
  if (m.rol === 'yo') {
    return <div className="self-end max-w-[88%] whitespace-pre-wrap break-words rounded-2xl bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3.5 py-2 text-sm">{m.texto}</div>
  }
  return (
    <div className="self-start max-w-[92%] whitespace-pre-wrap break-words rounded-2xl bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 px-3.5 py-2.5 text-sm space-y-2">
      {m.texto && <p>{m.texto}</p>}
      {m.receta && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-[15px] text-gray-900 dark:text-zinc-100">{m.receta.titulo}</strong>
            <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300">{m.receta.cargados.length} hospedajes cargados</span>
            {m.pendientes?.length > 0 && <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">{m.pendientes.length} por resolver</span>}
          </div>
          <Bloque titulo="Datos del viaje">
            <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-0.5">
              {m.receta.datos.map(([k, v], i) => (
                <div key={i} className="contents"><dt className="text-gray-500 dark:text-zinc-400">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>
              ))}
            </dl>
          </Bloque>
          {m.receta.cargados.length > 0 && (
            <Bloque titulo="Hospedajes cargados">
              {m.receta.cargados.map((h, i) => (
                <div key={i} className="flex justify-between gap-3 border-b border-dashed border-gray-200 dark:border-zinc-700 last:border-0 py-0.5">
                  <span className="min-w-0">{h.nombre}{h.sub && <span className="text-gray-500 dark:text-zinc-400"> · {h.sub}</span>}</span>
                  <span className="font-semibold tabular-nums whitespace-nowrap">{h.precio}</span>
                </div>
              ))}
            </Bloque>
          )}
        </>
      )}
      {m.ent?.length > 0 && !m.receta && (
        <div><p className="font-semibold text-green-700 dark:text-green-400">Entendí:</p>{m.ent.map((x, i) => <p key={i}>- {x}</p>)}</div>
      )}
      {m.no?.length > 0 && (
        <div><p className="font-semibold text-amber-700 dark:text-amber-400">{m.receta || m.pendientes?.length ? 'Avisos:' : 'No entendí:'}</p>{m.no.map((x, i) => <p key={i}>- {x}</p>)}
          {!m.receta && !m.pendientes?.length && <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">Usá el formato  Título: dato  (por ejemplo  Pasajeros: 2 adultos, 1 niño 6).</p>}</div>
      )}
      {m.habPend?.length > 0 && (
        <Bloque titulo={`Elegir habitación (${m.habPend.length})`}>
          <div className="space-y-2">
            {m.habPend.map((p, i) => <HabitacionCard key={i} p={p} onChip={onChip} />)}
          </div>
        </Bloque>
      )}
      {m.pendientes?.length > 0 && (
        <Bloque titulo={`Por resolver (${m.pendientes.length})`}>
          <div className="space-y-2">
            {m.pendientes.map((p, i) => <PendienteCard key={i} p={p} hospedajesDB={hospedajesDB} onChip={onChip} sim={m.sim} />)}
          </div>
        </Bloque>
      )}
      {m.avisos?.length > 0 && <div>{m.avisos.map((x, i) => <p key={i} className="text-amber-700 dark:text-amber-400">{x}</p>)}</div>}
      {m.pregunta && <p>{m.pregunta}</p>}
      {m.chips?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {m.chips.map((c, i) => (
            <button key={i} type="button" onClick={() => onChip(c.linea, c.mostrar)}
              className="rounded-full border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1 text-xs text-gray-800 dark:text-zinc-200 hover:border-gray-900 dark:hover:border-zinc-300">{c.texto}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// Resumen ordenado de lo que quedó cargado después de leer una receta: título, datos del viaje y
// hospedajes cargados (lo que falta va aparte, en "Por resolver").
function armarResumenReceta(d, sim, moneda, vuelo) {
  const dmy = fechaCorta
  const ida = vuelo?.ida_fecha || d.ida
  const vta = vuelo?.vuelta_fecha || d.vuelta
  const vueloVenta = d.vuelo ? parseInt(d.vuelo.venta || 0, 10) : (parseFloat(vuelo?.venta) || 0)
  const datos = []
  if (d.adultos != null || d.edades.length) {
    const con = d.edades.filter(Boolean)
    datos.push(['Pasajeros', `${d.adultos || 0} adultos${d.edades.length ? `, ${d.edades.length} menores${con.length ? ` (${con.join(' y ')} años)` : ''}` : ''}${d.bebes.some(Boolean) ? ' + bebé' : ''}`])
  }
  if (d.tipo === 'grupo') d.familias.forEach((f, i) => datos.push([`Familia ${i + 1}`, descFamilia(f)]))
  if (ida && vta) datos.push(['Fechas', `${dmy(ida)} al ${dmy(vta)} · ${noches(ida, vta)} noches${vuelo?.ida_fecha ? ' (las del vuelo)' : ''}`])
  if ((d.tipo === 'combinada' || d.tipo === 'combinada_uni') && d.etapas.length) datos.push(['Etapas', d.etapas.map(e => `${e.destino} ${noches(e.ida, e.vuelta)} noches`).join(' · ')])
  datos.push(['Moneda', moneda === 'USD' ? 'Dólares' : moneda === 'BRL' ? 'Reales' : 'Pesos argentinos'])
  const v = d.vuelo ? parseInt(d.vuelo.venta || 0, 10) : 0
  const t = d.traslado ? parseInt(d.traslado.venta || 0, 10) : 0
  if (d.tipo === 'combinada' && (v || t)) datos.push(['Vuelo y traslados', `${sim} ${formato(v)} + ${sim} ${formato(t)} · base ${sim} ${formato(v + t)}`])
  else if (v || t) datos.push(['Vuelo y traslado', 'incluidos en el total de cada opción'])
  if (d.equipaje.length) datos.push(['Equipaje opcional', d.equipaje.map(e => `${e.tipo === 'carryOn' ? 'Carry on' : 'Valija 23 kg'} ${sim} ${formato(e.precio)}`).join(' · ')])
  if (d.equipajeIncluido) datos.push(['Equipaje incluido', [d.equipajeIncluido.carryOn && 'carry on', d.equipajeIncluido.valija23 && `${d.equipajeIncluido.valija23} valija despachada de 23 kg`].filter(Boolean).join(' y ')])
  const destinos = d.etapas.map(e => e.destino)
  return {
    titulo: d.tipo === 'grupo' ? `Leí la receta: grupo de ${d.familias.length} familias` : d.tipo === 'combinada_uni' ? `Leí la receta: combinada uni${destinos.length ? ', ' + destinos.join(' y ') : ''}` : d.tipo === 'combinada' ? `Leí la receta: combinada${destinos.length ? ', ' + destinos.join(' y ') : ''}` : 'Leí la receta: propuesta simple',
    datos,
    cargados: d.hospedajes.map(h => ({
      nombre: h.hDB.nombre,
      sub: h.habitaciones[0]?.hab.nombre || (d.tipo !== 'simple' ? (h.etapa || h.hDB.destino) : ''),
      precio: h.valoresFamilia ? h.valoresFamilia.map(x => `${sim} ${formato(x)}`).join(' · ') : h.fijo ? 'Incluido en todas las opciones' : `${sim} ${formato(totalOpcion(d, h, vueloVenta))}`,
    })),
  }
}

// Convierte lo que leyó la IA de la receta en líneas del chat.
// SIMPLE: cada hospedaje trae tres valores: el COSTO en reales (interno, queda guardado para
// finanzas y nunca se muestra), el precio de venta del hospedaje solo en pesos (privado) y el
// TOTAL entre paréntesis (lo que ve el cliente). El total del PDF se arma sumando vuelo + traslado
// + hospedaje, y el chat avisa si esa suma no da el total de la receta.
// COMBINADA: dos etapas (un destino cada una). Cada hospedaje trae su COSTO en reales (interno) y
// su precio de venta en dólares, que es el que se muestra (solo hospedaje); el vuelo, el traslado
// y el equipaje opcional van aparte, con sus precios públicos.
const dig = v => String(v ?? '').replace(/\D/g, '')
function lineasDeReceta(r, d) {
  const l = []
  const uni = r.tipo_propuesta === 'combinada_uni'
  const grupo = r.tipo_propuesta === 'grupo' || (r.familias || []).length > 1
  const combinada = !uni && !grupo && (r.tipo_propuesta === 'combinada' || (r.etapas || []).length > 1)
  const dmy = s => String(s || '').split('-').reverse().join('/')
  if (r.cliente?.trim() && !d.cliente) l.push('Cliente: ' + r.cliente.trim())
  if (grupo) l.push('Tipo: grupo')
  else if (uni) l.push('Tipo: combinada uni')
  else if (combinada) l.push('Tipo: combinada')
  if (grupo) {
    for (const f of r.familias || []) {
      const eds = (f.edades_menores || []).filter(Boolean)
      l.push('Familia: ' + [`${f.adultos || 0} adultos`, eds.length ? `${eds.length} niños ${eds.join(' y ')}` : ''].filter(Boolean).join(', '))
    }
  }
  const nums = (r.edades_menores || []).filter(Boolean)
  if (!grupo && (r.adultos || nums.length || r.bebes)) {
    const partes = [`${r.adultos || 0} adultos`]
    if (nums.length) partes.push(`${nums.length} niños ${nums.join(' y ')}`)
    if (r.bebes) partes.push(`${r.bebes} bebé`)
    l.push('Pasajeros: ' + partes.join(', '))
  }
  if ((!d.ida || d.fechasDeNiara) && r.fecha_ida && r.fecha_vuelta) l.push(`Fechas: ${dmy(r.fecha_ida)} al ${dmy(r.fecha_vuelta)}`)
  const vuelo = parseInt(dig(r.precio_vuelo) || 0, 10)
  const traslado = parseInt(dig(r.precio_traslado) || 0, 10)
  const priv = combinada ? '' : ', privado'
  if (vuelo && !grupo) l.push(`Vuelo: vende ${vuelo}${dig(r.costo_vuelo) ? `, costo ${dig(r.costo_vuelo)}` : ''}${priv}`)
  if (grupo && traslado) l.push('Traslado: ida y vuelta')
  else if (traslado) l.push(`Traslado: ida y vuelta, vende ${traslado}${priv}`)
  l.push(`Moneda: ${r.moneda === 'USD' ? 'dolares' : r.moneda === 'ARS' || !combinada ? 'pesos' : 'dolares'}`)
  if (parseInt(r.valijas_despachadas || 0, 10) > 0 || r.carry_incluido) l.push(`Equipaje incluido:${r.carry_incluido ? ' carry on' : ''}${parseInt(r.valijas_despachadas || 0, 10) > 0 ? ` valija ${parseInt(r.valijas_despachadas, 10)}` : ''}`)
  if (uni) {
    for (const e of r.etapas || []) {
      if (e.destino && e.fecha_desde && e.fecha_hasta) l.push(`Etapa: ${e.destino}, ${dmy(e.fecha_desde)} al ${dmy(e.fecha_hasta)}`)
    }
  }
  if (combinada) {
    const eq = [dig(r.precio_carry_on) && `carry on ${dig(r.precio_carry_on)}`, dig(r.precio_valija) && `valija ${dig(r.precio_valija)}`].filter(Boolean)
    if (eq.length) l.push('Equipaje: ' + eq.join(', '))
    for (const e of r.etapas || []) {
      if (e.destino && e.fecha_desde && e.fecha_hasta) l.push(`Etapa: ${e.destino}, ${dmy(e.fecha_desde)} al ${dmy(e.fecha_hasta)}`)
    }
  }
  for (const h of r.hospedajes || []) {
    if (!h.nombre) continue
    if (grupo) {
      // Grupo: solo el valor total de cada familia (lo que escribió la receta entre paréntesis); nunca precios de Niara
      const fam = (h.precios_familia || []).map(dig).filter(Boolean)
      const pen = h.pension || (dig(h.desayuno_opcional) ? `Desayuno opcional $${Number(dig(h.desayuno_opcional)).toLocaleString('es-AR')} por persona` : '')
      l.push(`Hospedaje: ${h.nombre.replace(/[,:]/g, ' ').trim()}${fam.length ? `, familias ${fam.join('/')}` : ''}${dig(h.costo) ? `, costo ${dig(h.costo)}` : ''}${pen ? `, pension ${pen}` : ''}${h.propietario ? `, dueno ${h.propietario}` : ''}${h.detalle ? `, habitacion ${String(h.detalle).replace(/,/g, ' ')}` : ''}`)
      continue
    }
    const total = combinada ? 0 : parseInt(dig(h.precio_total) || 0, 10)
    let venta = parseInt(dig(h.precio_hospedaje) || 0, 10)
    // Si la receta no trae el precio del hospedaje solo, sale del total menos vuelo y traslado
    if (!venta && total && !uni) venta = Math.max(total - vuelo - traslado, 0)
    // Sin pensión, el monto entre paréntesis es el desayuno opcional por persona
    const pension = h.pension || (dig(h.desayuno_opcional) ? `Desayuno opcional $${Number(dig(h.desayuno_opcional)).toLocaleString('es-AR')} por persona` : '')
    l.push(`Hospedaje: ${h.nombre.replace(/[,:]/g, ' ').trim()}${venta ? `, vende ${venta}` : ''}${dig(h.costo) ? `, costo ${dig(h.costo)}` : ''}${priv}${total ? `, total ${total}` : ''}${pension ? `, pension ${pension}` : ''}${h.propietario ? `, dueno ${h.propietario}` : ''}${h.detalle ? `, habitacion ${String(h.detalle).replace(/,/g, ' ')}` : ''}${(combinada || uni) && h.etapa ? `, etapa ${h.etapa.replace(/,/g, ' ')}` : ''}${uni && !total ? ', fijo' : ''}`)
  }
  return l
}

export default function ChatPropuesta({ hospedajesDB, moneda, vuelo, leyendoVuelo, errorVuelo, onLeerVuelo, onLeerReceta, onGenerar, onPasarAlFormulario, generando, error, exito }) {
  const [msgs, setMsgs] = useState([])
  const [datos, setDatos] = useState(DATOS_VACIOS)
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [sug, setSug] = useState({ lista: [], idx: 0 })
  const datosRef = useRef(DATOS_VACIOS)
  const catRef = useRef({})
  const taRef = useRef(null)
  const finRef = useRef(null)
  const archivoRef = useRef(null)
  const recetaRef = useRef(null)
  const [leyendoReceta, setLeyendoReceta] = useState(false)
  const leyendoPrevio = useRef(false)

  const hayVuelo = !!(vuelo?.origen_ciudad || vuelo?.destino_ciudad)
  const monedaEf = datos.moneda || moneda
  const sim = SIMBOLO[monedaEf] || ''
  const faltan = faltantes(datos, hayVuelo)
  const vueloVenta = datos.vuelo ? parseInt(datos.vuelo.venta || 0, 10) : (parseFloat(vuelo?.venta) || 0)

  useEffect(() => { setMsgs([{ rol: 'bot', texto: INTRO }]) }, [])
  useEffect(() => { finRef.current?.scrollIntoView({ block: 'end' }) }, [msgs, pensando])

  // Al terminar de leer la captura del vuelo, el chat avisa qué leyó
  useEffect(() => {
    if (leyendoPrevio.current && !leyendoVuelo) {
      if (errorVuelo) setMsgs(m => [...m, { rol: 'bot', texto: errorVuelo }])
      else if (hayVuelo) {
        setMsgs(m => [...m, { rol: 'bot', texto: `Leí el vuelo: ${vuelo.origen_ciudad || '?'} - ${vuelo.destino_ciudad || '?'}${vuelo.ida_fecha ? ', ida ' + fechaCorta(vuelo.ida_fecha) : ''}${vuelo.vuelta_fecha ? ', vuelta ' + fechaCorta(vuelo.vuelta_fecha) : ''}. Revisalo en el formulario antes de enviar al cliente. Si querés sumar el precio: Vuelo: vende 480` }])
      }
    }
    leyendoPrevio.current = leyendoVuelo
  }, [leyendoVuelo])

  // Cuando se genera bien la propuesta, el chat arranca de cero
  useEffect(() => {
    if (!exito) return
    datosRef.current = DATOS_VACIOS
    setDatos(DATOS_VACIOS)
    setMsgs([{ rol: 'bot', texto: 'Propuesta generada y guardada. Podés empezar otra.' }, { rol: 'bot', texto: INTRO }])
  }, [exito])

  function calcularSug(valor, caret) {
    const linea = valor.slice(0, caret).split('\n').pop()
    const m = linea.match(/^\s*(hosped\w*|habitaci\w*)\s*:\s*([^,]*)$/i)
    if (!m) return setSug({ lista: [], idx: 0 })
    const q = norm(m[2]).split(/\s+/).filter(Boolean)
    let lista = []
    if (/^hosped/i.test(m[1])) {
      lista = (hospedajesDB || []).filter(h => q.every(w => norm(h.nombre + ' ' + (h.destino || '')).includes(w)))
        .slice(0, 6).map(h => ({ valor: h.nombre, sub: h.destino || '' }))
    } else {
      const ultimo = datosRef.current.hospedajes[datosRef.current.hospedajes.length - 1]
      const habs = ultimo ? (catRef.current[ultimo.hDB.id] || []) : []
      lista = habs.filter(h => q.every(w => norm(h.nombre).includes(w))).slice(0, 6).map(h => ({ valor: h.nombre, sub: ultimo.hDB.nombre }))
    }
    setSug({ lista, idx: 0 })
  }

  function elegirSug(i) {
    const it = sug.lista[i]
    const ta = taRef.current
    if (!it || !ta) return
    const caret = ta.selectionStart
    const ini = texto.lastIndexOf('\n', caret - 1) + 1
    let fin = texto.indexOf('\n', caret)
    if (fin < 0) fin = texto.length
    const mm = texto.slice(ini, fin).match(/^(\s*[^:]+:\s*)([^,]*)(.*)$/)
    if (!mm) return
    const nueva = mm[1] + it.valor + mm[3]
    setTexto(texto.slice(0, ini) + nueva + texto.slice(fin))
    setSug({ lista: [], idx: 0 })
    const pos = ini + mm[1].length + it.valor.length
    setTimeout(() => { ta.focus(); ta.setSelectionRange(pos, pos) }, 0)
  }

  async function enviar(t, mostrar, opc) {
    const contenido = (t ?? texto).trim()
    if (!contenido || pensando) return
    setMsgs(m => [...m, { rol: 'yo', texto: mostrar ?? contenido }])
    setTexto('')
    setSug({ lista: [], idx: 0 })
    setPensando(true)
    try {
      const r = await procesar(contenido, datosRef.current, catRef.current, hospedajesDB || [])
      datosRef.current = r.datos
      setDatos(r.datos)
      const monedaR = r.datos.moneda || moneda
      const simR = SIMBOLO[monedaR] || ''
      const msg = { rol: 'bot', ent: r.ent, no: r.no, pendientes: r.pendientes, habPend: r.habPend, sim: simR }
      if (opc?.receta) msg.receta = armarResumenReceta(r.datos, simR, monedaR, vuelo)
      if (r.ambiguos.length) {
        msg.pregunta = 'Encontré varias opciones, ¿cuál?'
        msg.chips = r.ambiguos[0].opciones.map(n => ({ texto: n, linea: r.ambiguos[0].armar(n) }))
      } else {
        const ult = r.datos.hospedajes[r.datos.hospedajes.length - 1]
        const habs = ult ? (catRef.current[ult.hDB.id] || []) : []
        if (ult && !ult.habitaciones.length && !ult.venta && !ult.valoresFamilia && habs.length) {
          msg.pregunta = `¿Qué habitación de ${ult.hDB.nombre}? (o escribí el precio del hospedaje: Hospedaje: ${ult.hDB.nombre}, vende 1200)`
          msg.chips = habs.slice(0, 8).map(h => ({ texto: h.nombre, linea: `Habitación: ${h.nombre}` }))
        } else {
          msg.avisos = avisosDe(r.datos, !!(vuelo?.ida_fecha && vuelo?.vuelta_fecha), r.datos.vuelo ? parseInt(r.datos.vuelo.venta || 0, 10) : (parseFloat(vuelo?.venta) || 0))
          const f = faltantes(r.datos, hayVuelo)
          msg.pregunta = f.length ? `Falta: ${f.join(', ')}.` : 'Los datos obligatorios están completos. Revisá el panel y tocá "Generar PDF".'
        }
      }
      if (!r.ent.length && !r.no.length && !r.ambiguos.length && !r.pendientes.length && !r.habPend.length) msg.texto = 'No encontré datos para cargar.'
      setMsgs(m => [...m, msg])
    } catch (e) {
      setMsgs(m => [...m, { rol: 'bot', texto: 'Hubo un problema leyendo eso. Probá de nuevo.' }])
    }
    setPensando(false)
  }

  function alTeclear(e) {
    const abierta = sug.lista.length > 0
    if (abierta && e.key === 'ArrowDown') { e.preventDefault(); setSug(s => ({ ...s, idx: (s.idx + 1) % s.lista.length })) }
    else if (abierta && e.key === 'ArrowUp') { e.preventDefault(); setSug(s => ({ ...s, idx: (s.idx - 1 + s.lista.length) % s.lista.length })) }
    else if (abierta && (e.key === 'Enter' || e.key === 'Tab')) { e.preventDefault(); elegirSug(sug.idx) }
    else if (e.key === 'Escape') setSug({ lista: [], idx: 0 })
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
  }

  function reiniciar() {
    datosRef.current = DATOS_VACIOS
    setDatos(DATOS_VACIOS)
    setMsgs([{ rol: 'bot', texto: INTRO }])
  }

  // Foto de la receta: la IA la lee y se convierte en las mismas líneas que escribiría el
  // vendedor, que pasan por las mismas reglas (catálogo, ambigüedades, faltantes). Si no se
  // entiende, el chat pide el link de Niara como respaldo.
  async function elegirReceta(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || leyendoReceta) return
    setLeyendoReceta(true)
    // La receta manda: si antes se trajeron hospedajes desde Niara, se descartan (Niara queda solo para las habitaciones)
    if (datosRef.current.hospedajes.some(h => h.desdeNiara)) {
      datosRef.current = { ...datosRef.current, hospedajes: datosRef.current.hospedajes.filter(h => !h.desdeNiara) }
      setDatos(datosRef.current)
    }
    setMsgs(m => [...m, { rol: 'yo', texto: '[Receta adjunta]' }, { rol: 'bot', texto: 'Leyendo la receta...' }])
    const { receta, error } = await onLeerReceta(f, (datosRef.current.niara || []).map(n => n.nombre))
    setLeyendoReceta(false)
    const lineas = receta ? lineasDeReceta(receta, datosRef.current) : []
    if (error || !receta || !receta.hospedajes?.length) {
      setMsgs(m => [...m, { rol: 'bot', texto: `${error || 'No entendí la receta.'} Probá con otra foto más clara, o pegá el link de la cotización de Niara:  Niara: https://...` }])
      return
    }
    await enviar(lineas.join('\n'), '[Receta leída]', { receta: true })
  }

  function elegirArchivo(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setMsgs(m => [...m, { rol: 'yo', texto: '[Captura de vuelo adjunta]' }, { rol: 'bot', texto: 'Leyendo la captura...' }])
    onLeerVuelo(f)
  }

  const BTN_SM = 'text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:border-gray-400 dark:hover:border-zinc-500 disabled:opacity-40'
  const fila = (k, v) => (
    <div className="flex justify-between gap-3 py-2 border-b border-gray-100 dark:border-zinc-800 last:border-0 text-sm">
      <span className="font-medium text-gray-700 dark:text-zinc-300">{k}</span>
      <span className={`text-right min-w-0 break-words ${v ? 'text-gray-900 dark:text-zinc-100' : 'text-amber-600 dark:text-amber-400'}`}>{v || 'falta'}</span>
    </div>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 flex flex-col h-[640px] max-h-[80vh]">
        <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-2.5">
          {msgs.map((m, i) => <Mensaje key={i} m={m} onChip={(l, mostrar) => enviar(l, mostrar)} hospedajesDB={hospedajesDB} />)}
          {pensando && <div className="self-start text-xs text-gray-400 dark:text-zinc-500">Leyendo...</div>}
          <div ref={finRef} />
        </div>
        <div className="border-t border-gray-100 dark:border-zinc-800 p-3 relative">
          <div className="flex flex-wrap gap-1.5 mb-2">
            <button type="button" className={BTN_SM} onClick={() => { setTexto(PLANTILLA); taRef.current?.focus() }}>Insertar plantilla</button>
            <button type="button" className={BTN_SM} disabled={leyendoVuelo} onClick={() => archivoRef.current?.click()}>{leyendoVuelo ? 'Leyendo vuelo...' : 'Adjuntar captura de vuelo'}</button>
            <button type="button" className={BTN_SM} disabled={leyendoReceta || pensando} onClick={() => recetaRef.current?.click()}>{leyendoReceta ? 'Leyendo receta...' : 'Adjuntar receta (foto)'}</button>
            <button type="button" className={BTN_SM} onClick={reiniciar}>Empezar de nuevo</button>
            <input ref={archivoRef} type="file" accept="image/*" className="hidden" onChange={elegirArchivo} />
            <input ref={recetaRef} type="file" accept="image/*" className="hidden" onChange={elegirReceta} />
          </div>
          {sug.lista.length > 0 && (
            <div className="absolute left-3 right-3 bottom-[calc(100%-44px)] z-10 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg dark:shadow-black/40 overflow-hidden">
              {sug.lista.map((s, i) => (
                <button key={i} type="button" onMouseDown={e => { e.preventDefault(); elegirSug(i) }}
                  className={`w-full text-left px-3 py-2 text-sm flex justify-between gap-3 ${i === sug.idx ? 'bg-gray-100 dark:bg-zinc-800' : 'hover:bg-gray-50 dark:hover:bg-zinc-800'}`}>
                  <span className="text-gray-900 dark:text-zinc-100">{s.valor}</span>
                  <span className="text-xs text-gray-400 dark:text-zinc-500">{s.sub}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-end">
            <textarea ref={taRef} value={texto} rows={4}
              onChange={e => { setTexto(e.target.value); calcularSug(e.target.value, e.target.selectionStart) }}
              onClick={e => calcularSug(e.target.value, e.target.selectionStart)}
              onKeyDown={alTeclear}
              placeholder="Escribí el nombre del cliente   (Enter envía, Shift+Enter nueva línea)"
              className="flex-1 resize-none border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            <button type="button" onClick={() => enviar()} disabled={pensando || !texto.trim()}
              className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-40">Enviar</button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500 mb-2">Propuesta en armado</h3>
        {fila('Cliente', datos.cliente)}
        {fila('Pasajeros', datos.adultos != null || datos.edades.length
          ? `${datos.adultos || 0} adultos, ${datos.edades.length} menores${datos.edades.filter(Boolean).length ? ` (${datos.edades.filter(Boolean).join(', ')})` : ''}${datos.bebes.some(Boolean) ? ' + bebé' : ''}` : '')}
        {fila('Fechas', vuelo?.ida_fecha && vuelo?.vuelta_fecha
          ? `${fechaCorta(vuelo.ida_fecha)} al ${fechaCorta(vuelo.vuelta_fecha)} - ${noches(vuelo.ida_fecha, vuelo.vuelta_fecha)} noches (del vuelo)`
          : (datos.ida ? `${fechaCorta(datos.ida)} al ${fechaCorta(datos.vuelta)} - ${noches(datos.ida, datos.vuelta)} noches` : ''))}
        {datos.tipo === 'grupo' && datos.familias.map((f, i) => fila(`Familia ${i + 1}`, descFamilia(f)))}
        {fila('Tipo de propuesta', datos.tipo === 'grupo' ? 'Grupo (valor por familia)' : datos.tipo !== 'simple' ? `${datos.tipo === 'combinada_uni' ? 'Combinada uni' : 'Combinada'}${datos.etapas.length ? ': ' + datos.etapas.map(e => `${e.destino} (${noches(e.ida, e.vuelta)} noches)`).join(' + ') : ''}` : 'Simple')}
        {fila('Moneda', sim)}
        {datos.equipaje.length > 0 && fila('Equipaje opcional', datos.equipaje.map(e => `${e.tipo === 'carryOn' ? 'Carry on' : 'Valija 23 kg'} ${sim} ${formato(e.precio)}`).join(' · '))}
        {fila('Vuelo (opcional)', hayVuelo ? `${vuelo.origen_ciudad || '?'} - ${vuelo.destino_ciudad || '?'}${datos.vuelo ? ` · ${sim} ${formato(datos.vuelo.venta)}` : ''}` : (datos.vuelo ? `${sim} ${formato(datos.vuelo.venta)}` : ''))}
        {fila('Traslado (opcional)', datos.traslado ? `${datos.traslado.ida && datos.traslado.vuelta ? 'Ida y vuelta' : datos.traslado.ida ? 'Solo ida' : 'Solo vuelta'}${datos.traslado.venta ? ` · ${sim} ${formato(datos.traslado.venta)}` : ''}` : '')}

        <div className="pt-3">
          <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Hospedajes (opciones)</p>
          {!datos.hospedajes.length && <p className="text-sm text-amber-600 dark:text-amber-400">falta</p>}
          {datos.hospedajes.map((h, i) => (
            <div key={i} className="rounded-xl border border-gray-100 dark:border-zinc-800 p-3 mb-2 text-sm">
              <p className="font-semibold text-gray-900 dark:text-zinc-100">{h.hDB.nombre}</p>
              {h.habitaciones.map((r, j) => (
                <p key={j} className="text-gray-600 dark:text-zinc-400">{r.cantidad > 1 ? r.cantidad + ' x ' : ''}{r.hab.nombre}: {r.venta ? `${sim} ${formato(r.venta)}` : <span className="text-amber-600 dark:text-amber-400">falta el precio</span>}</p>
              ))}
              {!h.habitaciones.length && <p className="text-gray-600 dark:text-zinc-400">{h.venta ? `${sim} ${formato(h.venta)}` : <span className="text-amber-600 dark:text-amber-400">sin habitación ni precio</span>}</p>}
              {h.costo && <p className="text-xs text-gray-500 dark:text-zinc-400">Costo interno: R$ {formato(h.costo)} (no se muestra al cliente)</p>}
              {h.valoresFamilia ? <p className="mt-1 text-gray-900 dark:text-zinc-100 font-semibold tabular-nums">Por familia: {h.valoresFamilia.map(x => `${sim} ${formato(x)}`).join(' · ')}</p> : <p className="mt-1 text-gray-900 dark:text-zinc-100 font-semibold tabular-nums">{h.fijo ? 'Incluido en todas las opciones' : datos.tipo === 'combinada' ? 'Valor del hospedaje' : 'Total de esta opción'}: {sim} {formato(totalOpcion(datos, h, vueloVenta))}{h.etapa ? ` · ${h.etapa}` : ''}</p>}
            </div>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {exito && <p className="mt-3 text-sm text-green-700 dark:text-green-400">Propuesta generada y guardada.</p>}
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <button type="button" disabled={faltan.length > 0 || generando}
            onClick={() => onGenerar(datosRef.current)}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-3 rounded-xl disabled:opacity-40">
            {generando ? 'Generando PDF...' : 'Generar y descargar PDF'}
          </button>
          <button type="button" disabled={generando} onClick={() => onPasarAlFormulario(datosRef.current)}
            className="border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 text-sm font-semibold px-4 py-3 rounded-xl hover:border-gray-400 dark:hover:border-zinc-500 disabled:opacity-40">
            Pasar al formulario
          </button>
        </div>
        {faltan.length > 0 && <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400">Para generar falta: {faltan.join(', ')}.</p>}
      </div>
    </div>
  )
}
