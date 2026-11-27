import { rgb, PDFName, PDFArray, PDFString } from 'pdf-lib'
import { pathRectRedondeado } from './pdfPlantillaAereos.js'

// Última página de la propuesta: "TODOS LOS VALORES". Junta en una sola hoja todo lo que ve el
// cliente: la base del viaje (combinada), cada hospedaje con su valor agrupado por destino, el
// equipaje opcional y el botón al catálogo de paseos.
// Organizada en bloques (base, una tabla por destino, equipaje, catálogo) pero con NUESTRO estilo: la
// misma hoja de plantilla que los hospedajes (encabezado, fondo crema, pie con el logo), tipografía
// Bebas, azul oscuro, crema y verde de los botones, y la línea negra fina entre renglones.
// Solo recibe lo que es público: nunca costos ni valores marcados como privados.

const NAVY = rgb(0x07 / 255, 0x2e / 255, 0x40 / 255)
const CREMA = rgb(0xf0 / 255, 0xec / 255, 0xe7 / 255)
const CREMA_OSCURO = rgb(0xe6 / 255, 0xe0 / 255, 0xd6 / 255)
const LIMA = rgb(0xc9 / 255, 0xe3 / 255, 0x4f / 255)
const NEGRO = rgb(0, 0, 0)

// Zona de contenido de las hojas de hospedajes: de y=60 a y=750 (debajo está el pie con el logo)
const TOPE = 750
const PISO = 62
const BX0 = 60
const BX1 = 540
const BW = BX1 - BX0
const PAD = 14

function numero(n) {
  return Number(n || 0).toLocaleString('es-AR')
}

// "USD$ 1.333", "ARS$ 5.000.000", "R$ 900" (mismo formato que las hojas de hospedajes)
export function textoMonto(moneda, valor) {
  const m = moneda || 'ARS'
  return `${m === 'BRL' ? 'R' : m}$ ${numero(valor)}`
}

function agregarLink(page, doc, { x, y, width, height }, url) {
  const ref = doc.context.register(doc.context.obj({
    Type: 'Annot', Subtype: 'Link', Rect: [x, y, x + width, y + height], Border: [0, 0, 0],
    A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
  }))
  const existentes = page.node.lookup(PDFName.of('Annots'), PDFArray)
  const annots = existentes || doc.context.obj([])
  annots.push(ref)
  page.node.set(PDFName.of('Annots'), annots)
}

// Las fuentes del PDF no tienen la flecha: se escribe ">"
const limpio = t => String(t ?? '').replace(/→/g, '>')

function partir(texto, font, size, ancho) {
  const palabras = limpio(texto).split(/\s+/).filter(Boolean)
  const lineas = []
  let actual = ''
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p
    if (font.widthOfTextAtSize(prueba, size) > ancho && actual) { lineas.push(actual); actual = p } else actual = prueba
  }
  if (actual) lineas.push(actual)
  return lineas
}

function achicar(texto, font, size, ancho, minimo = 6) {
  const t = limpio(texto)
  let s = size
  while (s > minimo && font.widthOfTextAtSize(t, s) > ancho) s -= 0.5
  return s
}

/**
 * datos = {
 *   resumen: 'RESUMEN · 11 AL 21 DE FEBRERO DE 2027 · 10 NOCHES',
 *   subtitulo: 'Valores en dólares, totales para los 2 pasajeros. ...',
 *   base: { texto, monto, nota } | null,           // combinada: vuelo + traslados
 *   secciones: [{ titulo, colMedia, colDer, filas: [{ nombre, sub, medio, monto }] }],
 *   equipaje: [{ etiqueta, monto, nota }],
 *   catalogoUrl: 'https://...' | null,
 * }
 */
export async function agregarPaginaValores(doc, plantillaDoc, bebas, helv, _helvBold, datos) {
  let pagina
  let y

  async function nuevaPagina(esPrimera) {
    const [p] = await doc.copyPages(plantillaDoc, [1])
    doc.addPage(p)
    pagina = p
    // Cuerpo limpio, igual que las hojas de hospedajes (de y=60 a y=758, sin tocar el pie con el logo),
    // y título propio en el encabezado.
    pagina.drawRectangle({ x: 20, y: 60, width: 550, height: TOPE + 8 - 60, color: CREMA })
    pagina.drawRectangle({ x: 60, y: 780, width: 440, height: 36, color: NAVY })
    pagina.drawText(esPrimera ? 'TODOS LOS VALORES' : 'TODOS LOS VALORES (CONT.)', { x: 67, y: 789, size: 30, font: bebas, color: CREMA })
    y = TOPE
  }

  // Todos los recuadros con las puntas redondeadas
  const rect = (x, yy, w, h, color) => pagina.drawSvgPath(pathRectRedondeado(w, h, 7), { x, y: yy + h, color })
  const texto = (t, x, yy, size, font, color = NAVY) => pagina.drawText(limpio(t), { x, y: yy, size, font, color })
  const derecha = (t, xDer, yy, size, font, color = NAVY) => texto(t, xDer - font.widthOfTextAtSize(limpio(t), size), yy, size, font, color)
  const linea = (yy) => pagina.drawLine({ start: { x: BX0, y: yy }, end: { x: BX1, y: yy }, thickness: 0.75, color: NEGRO })

  await nuevaPagina(true)

  // Alto aproximado de todo: si se pasa por poco de una hoja, se compacta para no dejar una segunda casi vacía
  const nFilas = datos.secciones.reduce((s, sec) => s + sec.filas.length, 0)
  const altoEstimado = (datos.resumen ? 20 : 0)
    + (datos.explicacion ? 45 + partir(datos.explicacion, helv, 8.5, BW).length * 11 : datos.subtitulo ? 24 : 0)
    + (datos.base ? 70 : 0) + datos.secciones.length * 38 + nFilas * 40
    + (datos.equipaje?.length ? 98 : 0)
    + (datos.incluye?.length ? 32 + datos.incluye.reduce((s, t) => s + partir(String(t).toUpperCase(), bebas, 12.5, BW - 12).length, 0) * 13 : 0)
    + (datos.catalogoUrl ? 68 : 0) + (datos.notaAparte ? 22 : 12)
  const sobra = altoEstimado - (TOPE - PISO)
  const ahorroFijo = (datos.secciones.length + 2) * 6 + 8 + 24 // lo que se gana juntando y achicando los bloques
  const compacta = !datos.tablaGrupo && sobra > 0 && sobra <= ahorroFijo + nFilas * 9
  // Cuánto se achica cada renglón: solo lo necesario (nunca menos de 34 puntos)
  const altoFilaCompacta = compacta ? Math.max(34, 40 - Math.ceil(Math.max(sobra - ahorroFijo, 0) / Math.max(nFilas, 1)) - 1) : 40

  if (datos.resumen) {
    texto(String(datos.resumen).toUpperCase(), BX0, y - 8, 8, helv)
    y -= 20
  }
  if (datos.explicacion) {
    // Cómo se lee esta propuesta: qué se elige y qué incluye cada valor
    const lineas = partir(datos.explicacion, helv, 8.5, BW)
    texto('CÓMO SE LEE ESTA PROPUESTA', BX0, y - 12, 14, bebas)
    lineas.forEach((l, i) => texto(l, BX0, y - 25 - i * 11, 8.5, helv))
    y -= 25 + lineas.length * 11 + 8
    linea(y)
    y -= 12
  } else if (datos.subtitulo) {
    const sub = String(datos.subtitulo).toUpperCase()
    texto(sub, BX0, y - 8, achicar(sub, helv, 8.5, BW), helv)
    y -= 24
  }

  // Grupo: quiénes son las familias
  if (datos.grupo?.length) {
    texto('EL GRUPO', BX0, y - 12, 14, bebas)
    y -= 20
    datos.grupo.forEach(f => {
      linea(y)
      texto(String(f.nombre).toUpperCase(), BX0, y - 15, 10, bebas)
      texto(f.detalle, BX0 + 90, y - 15, 9, helv)
      y -= 22
    })
    linea(y)
    y -= 14
  }

  // Base del viaje (combinada): vuelo + traslados
  if (datos.base) {
    const alto = compacta ? 48 : 56
    const sube = compacta ? 3.5 : 0
    rect(BX0, y - alto, BW, alto, NAVY)
    texto('LA BASE DEL VIAJE', BX0 + PAD, y - 17 + sube, 12, bebas, LIMA)
    texto(String(datos.base.texto || '').toUpperCase(), BX0 + PAD, y - 36 + sube * 1.5, achicar(String(datos.base.texto || '').toUpperCase(), bebas, 13, BW * 0.55, 8), bebas, CREMA)
    derecha(datos.base.monto, BX1 - PAD, y - 30 + sube, 28, bebas, CREMA)
    if (datos.base.nota) derecha(String(datos.base.nota).toUpperCase(), BX1 - PAD, y - 46 + sube * 1.5, 11, bebas, CREMA)
    y -= alto + (compacta ? 8 : 14)
  }

  // Una tabla por destino (o la lista simple): encabezado azul y un renglón por hospedaje
  const ALTO_HEAD = 24
  const ALTO_FILA = altoFilaCompacta
  const d = (40 - ALTO_FILA) * 0.43 // cuánto suben los textos dentro del renglón compacto
  const X_MEDIO = BX0 + BW * 0.56
  for (const sec of datos.secciones) {
    const filas = sec.filas
    let i = 0
    while (i < filas.length) {
      if (y - ALTO_HEAD - ALTO_FILA < PISO) await nuevaPagina(false)
      const entran = Math.max(1, Math.floor((y - ALTO_HEAD - PISO) / ALTO_FILA))
      const tramo = filas.slice(i, i + entran)
      rect(BX0, y - ALTO_HEAD, BW, ALTO_HEAD, NAVY)
      texto(sec.titulo, BX0 + PAD, y - 16, achicar(sec.titulo, bebas, 13, BW * 0.5, 9), bebas, CREMA)
      if (sec.colMedia) texto(sec.colMedia, X_MEDIO, y - 16, 12, bebas, CREMA)
      derecha(sec.colDer, BX1 - PAD, y - 16, 12, bebas, LIMA)
      y -= ALTO_HEAD
      tramo.forEach((f, k) => {
        // El sombreado deja libre 1 punto arriba para que se vea la línea del renglón anterior
        if ((i + k) % 2 === 1) rect(BX0, y - ALTO_FILA, BW, ALTO_FILA - 1, CREMA_OSCURO)
        const nombre = f.nombre.toUpperCase()
        texto(nombre, BX0 + PAD, y - 17 + d, achicar(nombre, bebas, 16, BW * 0.52, 9), bebas)
        const info = String(f.sub || '').toUpperCase()
        if (info) texto(info, BX0 + PAD, y - 31 + d * 1.5, achicar(info, bebas, 11.5, BW * 0.52, 7), bebas)
        if (f.medio) texto(String(f.medio).toUpperCase(), X_MEDIO, y - 23 + d, achicar(String(f.medio).toUpperCase(), bebas, 13, BW * 0.2, 8), bebas)
        if (f.monto) derecha(f.monto, BX1 - PAD, y - (f.nota ? 20 : 24) + d, 17, bebas)
        if (f.monto && f.nota) derecha(String(f.nota).toUpperCase(), BX1 - PAD, y - 33 + d * 1.5, 10.5, bebas)
        y -= ALTO_FILA
        linea(y)
      })
      i += tramo.length
      if (i < filas.length) await nuevaPagina(false)
    }
    y -= compacta ? 8 : 14
  }

  // Grupo: una tabla con una fila por familia y una columna por opción de hospedaje
  if (datos.tablaGrupo) {
    const t = datos.tablaGrupo
    const n = t.columnas.length
    const colW = Math.min(150, (BW * 0.6) / n)
    if (y - ALTO_HEAD - ALTO_FILA * t.filas.length < PISO) await nuevaPagina(false)
    rect(BX0, y - ALTO_HEAD, BW, ALTO_HEAD, NAVY)
    texto(t.titulo, BX0 + PAD, y - 16, achicar(t.titulo, bebas, 12, BW - n * colW - PAD, 7), bebas, CREMA)
    t.columnas.forEach((c, k) => {
      const xr = BX1 - PAD - (n - 1 - k) * colW
      const nom = String(c).toUpperCase()
      derecha(nom, xr, y - 16, achicar(nom, bebas, 12, colW - 10, 6.5), bebas, LIMA)
    })
    y -= ALTO_HEAD
    t.filas.forEach((f, i) => {
      if (i % 2 === 1) rect(BX0, y - ALTO_FILA, BW, ALTO_FILA - 1, CREMA_OSCURO)
      texto(String(f.nombre).toUpperCase(), BX0 + PAD, y - 17, 16, bebas)
      const sub = String(f.sub || '').toUpperCase()
      if (sub) texto(sub, BX0 + PAD, y - 31, achicar(sub, bebas, 11, BW - n * colW - PAD - 6, 6.5), bebas)
      f.montos.forEach((m, k) => {
        const xr = BX1 - PAD - (n - 1 - k) * colW
        derecha(m, xr, y - 24, achicar(m, bebas, 16, colW - 10, 8), bebas)
      })
      y -= ALTO_FILA
      linea(y)
    })
    y -= 14
  }

  // Equipaje opcional: bloque azul con una celda crema por tipo de equipaje
  if (datos.equipaje?.length) {
    const alto = compacta ? 74 : 84
    const altoCelda = compacta ? 34 : 38
    if (y - alto < PISO) await nuevaPagina(false)
    rect(BX0, y - alto, BW, alto, NAVY)
    texto('EQUIPAJE OPCIONAL', BX0 + PAD, y - (compacta ? 18 : 21), 17, bebas, CREMA)
    texto('CADA VALOR ES POR VALIJA E INCLUYE LA IDA Y LA VUELTA', BX0 + PAD, y - (compacta ? 29 : 33), 11, bebas, CREMA)
    const n = datos.equipaje.length
    const gap = 10
    const w = (BW - 2 * PAD - gap * (n - 1)) / n
    datos.equipaje.forEach((e, k) => {
      const x = BX0 + PAD + k * (w + gap)
      const abajo = y - alto + (compacta ? 6 : 9)
      rect(x, abajo, w, altoCelda, CREMA)
      texto(e.etiqueta, x + 10, abajo + altoCelda - 12, 10.5, bebas)
      texto(e.monto, x + 10, abajo + (compacta ? 6 : 8), 17, bebas)
      if (e.nota) texto(String(e.nota).toUpperCase(), x + 10 + bebas.widthOfTextAtSize(e.monto, 17) + 8, abajo + (compacta ? 7 : 9), 10, bebas)
    })
    y -= alto + (compacta ? 8 : 14)
  }

  // El paquete incluye: resumen en renglones (aéreos, noches por destino, traslados)
  if (datos.incluye?.length) {
    const lineas = datos.incluye.flatMap(t => partir(String(t).toUpperCase(), bebas, 12.5, BW - 12))
    const renglon = compacta ? 12 : 13
    const alto = 26 + lineas.length * renglon
    if (y - alto < PISO) await nuevaPagina(false)
    linea(y)
    texto('EL PAQUETE INCLUYE', BX0, y - 18, 17, bebas)
    let yy = y - 34
    datos.incluye.forEach(t => {
      const ls = partir(String(t).toUpperCase(), bebas, 12.5, BW - 12)
      ls.forEach((l, k) => { texto((k === 0 ? '- ' : '  ') + l, BX0, yy, 12.5, bebas); yy -= renglon })
    })
    y = yy - 6
  }

  // Catálogo de paseos: bloque azul con el botón verde
  if (datos.catalogoUrl) {
    const alto = compacta ? 50 : 58
    if (y - alto < PISO) await nuevaPagina(false)
    rect(BX0, y - alto, BW, alto, NAVY)
    texto('CATÁLOGO DE PASEOS', BX0 + PAD, y - 24, 17, bebas, CREMA)
    texto('LAS ACTIVIDADES DE LA ZONA, PARA IR ARMANDO LOS DÍAS', BX0 + PAD, y - 38, 11, bebas, CREMA)
    const bw = 178
    const boton = { x: BX1 - PAD - bw, y: y - alto + (compacta ? 8 : 12), width: bw, height: 34 }
    rect(boton.x, boton.y, boton.width, boton.height, LIMA)
    texto('TOCÁ PARA ABRIR', boton.x + 14, boton.y + 23, 9, bebas)
    texto('VER CATÁLOGO DE PASEOS >', boton.x + 14, boton.y + 9, 13, bebas)
    agregarLink(pagina, doc, boton, datos.catalogoUrl)
    y -= alto + 10
  }

  let yPie = Math.max(y - 4, 66)
  if (datos.notaAparte) {
    texto(String(datos.notaAparte).toUpperCase(), BX0, yPie, 7, helv)
    yPie = Math.max(yPie - 10, 62)
  }
  texto('TARIFAS SUJETAS A DISPONIBILIDAD Y RECONFIRMACIÓN AL MOMENTO DE RESERVAR.', BX0, yPie, 7, helv)
}

const NOMBRE_MONEDA = { USD: 'dólares', ARS: 'pesos', BRL: 'reales' }
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const ddmm = iso => (iso ? iso.split('-').reverse().slice(0, 2).join('/') : '')
const DIAS_CORTOS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
// "VIE 12/03"
const diaddmm = iso => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${DIAS_CORTOS[new Date(y, m - 1, d).getDay()]} ${ddmm(iso)}`
}

// "11 AL 21 DE FEBRERO DE 2027" (o "28 DE ENERO AL 4 DE FEBRERO DE 2027" si cambia el mes)
function rangoFechas(ida, vuelta) {
  if (!ida || !vuelta) return ''
  const [ya, ma, da] = ida.split('-').map(Number)
  const [yv, mv, dv] = vuelta.split('-').map(Number)
  if (ya === yv && ma === mv) return `${da} al ${dv} de ${MESES[mv - 1]} de ${yv}`
  if (ya === yv) return `${da} de ${MESES[ma - 1]} al ${dv} de ${MESES[mv - 1]} de ${yv}`
  return `${da} de ${MESES[ma - 1]} de ${ya} al ${dv} de ${MESES[mv - 1]} de ${yv}`
}
const nochesEntre = (ida, vuelta) => {
  if (!ida || !vuelta) return 0
  return Math.round((new Date(vuelta + 'T00:00:00') - new Date(ida + 'T00:00:00')) / 86400000)
}

// Arma lo que se imprime en la página de valores a partir de lo que ya tiene el generador.
// Solo entra lo público: los hospedajes con el valor marcado como privado no se listan.
// Texto de "el paquete incluye" y "cómo se lee": se arma con lo que ya tiene la propuesta
function minus(t) { const s = String(t || ''); return s.charAt(0).toLowerCase() + s.slice(1) }
function textoPension(p) {
  const t = String(p || '').trim()
  if (!t || /^sin desayuno/i.test(t)) return ''
  if (/media pensi/i.test(t)) return 'con media pensión: desayuno y cena'
  if (/pensi[oó]n completa/i.test(t)) return 'con pensión completa: desayuno, almuerzo y cena'
  if (/all inclusive|todo incluido/i.test(t)) return 'con all inclusive'
  return `con ${minus(t)}`
}
function armarIncluye({ tipo, vuelo, grupos, destinos }) {
  const l = []
  if (vuelo?.origen_ciudad && vuelo?.destino_ciudad) {
    const aero = vuelo.aerolinea ? ` con ${vuelo.aerolinea}` : ''
    const directo = vuelo.aerolinea && !vuelo.ida_escala_ciudad && !vuelo.vuelta_escala_ciudad ? ', los dos tramos directos' : ''
    const n = Number(vuelo.equipaje?.valija23 || 0)
    const valijas = n > 0 ? `, con ${n} valija${n > 1 ? 's' : ''} despachada${n > 1 ? 's' : ''}` : ''
    l.push(`Aéreos ${vuelo.origen_ciudad} - ${vuelo.destino_ciudad} - ${vuelo.origen_ciudad}${aero}${directo}${valijas}.`)
    const eq = [
      Number(vuelo.equipaje?.articuloPersonal || 0) > 0 && '1 artículo personal',
      Number(vuelo.equipaje?.mochila || 0) > 0 && '1 mochila o bolso de mano',
      Number(vuelo.equipaje?.carryOn || 0) > 0 && '1 carry on',
    ].filter(Boolean)
    if (eq.length) l.push(`Equipaje incluido por persona: ${eq.length > 1 ? `${eq.slice(0, -1).join(', ')} y ${eq[eq.length - 1]}` : eq[0]}.`)
  }
  if (tipo !== 'simple') {
    grupos.forEach(g => {
      const f0 = g[0] || {}
      if (!f0.noches) return
      if (g.length === 1 && f0.fijo) l.push(`${f0.noches} noches en ${f0.nombre}, en ${f0.destino}${textoPension(f0.pension) ? ', ' + textoPension(f0.pension) : ''}.`)
      else l.push(`${f0.noches} noches en ${f0.destino}, ${tipo === 'combinada_uni' || tipo === 'grupo' ? 'en la opción que se elija' : 'en una de las opciones'}.`)
    })
  }
  const tramos = (destinos || []).filter(d => d.salida?.trim() || d.destino?.trim())
  if (tramos.length) {
    const partes = tramos.map((d, i) => {
      const a = i === 0 ? `aeropuerto de ${d.salida}` : d.salida
      const b = i === tramos.length - 1 && /^(recife|aeropuerto)/i.test(String(d.destino || '').trim()) ? 'aeropuerto' : d.destino
      return `${a} - ${b}`
    })
    l.push(`Todos los traslados privados: ${partes.join(', ')}.`)
  } else if (vuelo?.traslado_ida || vuelo?.traslado_vuelta) {
    l.push(`Traslados privados de ida y vuelta entre el aeropuerto de ${vuelo.destino_ciudad || 'llegada'} y el alojamiento, con chófer esperando en el arribo.`)
  }
  return l
}
function armarExplicacion({ tipo, grupos, pas, noches }) {
  if (tipo === 'grupo') return `Los valores son por familia y ya incluyen aéreos, ${noches ? `las ${noches} noches de hospedaje` : 'las noches de hospedaje'} y los traslados de ida y vuelta al aeropuerto. Todas las familias eligen la misma opción.`
  const varios = grupos.filter(g => !(g.length === 1 && g[0].fijo))
  const fijos = grupos.filter(g => g.length === 1 && g[0].fijo)
  if (tipo === 'combinada_uni') {
    const dv = varios[0]?.[0]?.destino || 'el destino con opciones'
    const partes = grupos.map(g => {
      const f0 = g[0] || {}
      const fijo = g.length === 1 && f0.fijo
      return `las ${f0.noches || ''} noches en ${f0.destino}${fijo && textoPension(f0.pension) ? ' ' + textoPension(f0.pension) : ''}`
    })
    return `Lo único que se elige es el hospedaje de ${dv}. Cada valor es el total del paquete para los ${pas} pasajeros: aéreos, ${partes.join(', ')} y todos los traslados${fijos.length ? '' : ''}.`
  }
  if (tipo === 'combinada') {
    const ds = grupos.map(g => g[0]?.destino).filter(Boolean)
    return `Se elige un hospedaje de cada destino (${ds.join(' y ')}). Cada valor es solo el hospedaje: a la base del viaje, que incluye los aéreos y los traslados, se le suma una opción de cada etapa.`
  }
  return `Se elige una de las opciones de hospedaje. Cada valor es el total del paquete para los ${pas} pasajeros, con aéreos, traslados y las noches de hospedaje.`
}

export function armarDatosValores({ tipo, grupos, hospedajes, baseVueloTraslado, moneda, pasajeros, equipajeExtras, catalogoUrl, ida, vuelta, vuelo, destinos, familias }) {
  const pas = pasajeros || 0
  const lugar = (h) => h.habitaciones?.[0]?.nombre || h.habitacion_nombre || ''
  const noches = nochesEntre(ida, vuelta)
  const resumen = ida && vuelta ? `Resumen · ${rangoFechas(ida, vuelta)}${noches > 0 ? ` · ${noches} noches` : ''}` : ''
  let secciones
  let base = null
  let subtitulo
  let tablaGrupo = null
  let grupo = null
  if (tipo === 'grupo') {
    subtitulo = ''
    secciones = []
    grupo = (familias || []).map((f, i) => ({ nombre: `Familia ${i + 1}`, detalle: f }))
    tablaGrupo = {
      titulo: `${noches ? noches + ' NOCHES · ' : ''}AÉREOS Y TRASLADOS INCLUIDOS`,
      columnas: hospedajes.map(h => h.nombre),
      filas: (familias || []).map((f, i) => ({
        nombre: `Familia ${i + 1}`,
        sub: f,
        montos: hospedajes.map(h => (h.valores_familia?.[i] ? textoMonto(h.moneda || moneda, h.valores_familia[i]) : '')),
      })),
    }
  } else if (tipo === 'combinada') {
    subtitulo = `Valores en ${NOMBRE_MONEDA[moneda] || moneda}, totales para los ${pas} pasajeros. A la base se le suma una opción de cada etapa.`
    if (baseVueloTraslado > 0) base = { texto: 'Aéreos ida y vuelta, más todos los traslados', monto: textoMonto(moneda, baseVueloTraslado), nota: `Los ${pas} pasajeros` }
    secciones = grupos.map(g => {
      const f0 = g[0] || {}
      const fechas = f0.fecha_entrada && f0.fecha_salida ? ` · ${diaddmm(f0.fecha_entrada)} → ${diaddmm(f0.fecha_salida)}` : ''
      return {
        titulo: `${(f0.destino || 'HOSPEDAJES').toUpperCase()}${fechas}`,
        colMedia: 'ESTADÍA',
        colDer: 'SOLO HOSPEDAJE',
        filas: g.filter(h => h.precio_publico !== false && parseFloat(h.precio) > 0).map(h => ({
          nombre: h.nombre,
          medio: h.noches ? `${h.noches} noches` : '',
          sub: [h.pension, lugar(h)].filter(Boolean).join(' · '),
          monto: textoMonto(h.moneda || moneda, h.precio),
        })),
      }
    }).filter(s => s.filas.length)
  } else if (tipo === 'combinada_uni') {
    subtitulo = `Cada opción suma aéreos, traslados y el hospedaje fijo. Total del paquete para los ${pas} pasajeros.`
    secciones = grupos.map(g => {
      const f0 = g[0] || {}
      const fechas = f0.fecha_entrada && f0.fecha_salida ? ` · ${diaddmm(f0.fecha_entrada)} → ${diaddmm(f0.fecha_salida)}` : ''
      const fijo = g.every(h => h.fijo)
      return {
        titulo: `${(f0.destino || 'HOSPEDAJES').toUpperCase()}${fechas}`,
        colMedia: 'ESTADÍA',
        colDer: fijo ? 'INCLUIDO EN TODAS LAS OPCIONES' : 'TOTAL DEL PAQUETE',
        filas: g.map(h => ({
          nombre: h.nombre,
          medio: h.noches ? `${h.noches} noches` : '',
          sub: [h.pension, lugar(h)].filter(Boolean).join(' · '),
          monto: fijo ? '' : textoMonto(h.moneda || moneda, (baseVueloTraslado || 0) + (parseFloat(h.precio) || 0)),
          nota: fijo ? '' : `Los ${pas} pasajeros`,
        })),
      }
    })
  } else {
    const incluye = hospedajes.find(h => h.incluye)?.incluye || ''
    const nochesH = hospedajes.find(h => h.noches)?.noches
    subtitulo = `Cada opción muestra el total del paquete para los ${pas} pasajeros${incluye ? `: ${incluye}` : ''}.`
    secciones = [{
      titulo: `HOSPEDAJE${nochesH ? ` · ${nochesH} NOCHES` : ''}${incluye ? ` · ${incluye.toUpperCase()}` : ''}`,
      colMedia: 'ALIMENTACIÓN',
      colDer: 'TOTAL DEL PAQUETE',
      filas: hospedajes.map(h => ({
        nombre: h.nombre,
        medio: h.pension || '',
        sub: [h.destino, lugar(h)].filter(Boolean).join(' · '),
        monto: textoMonto(h.moneda || moneda, (baseVueloTraslado || 0) + (parseFloat(h.precio) || 0)),
        nota: `Los ${pas} pasajeros`,
      })),
    }]
  }
  const equipaje = (equipajeExtras || []).filter(e => e.publica !== false && parseFloat(e.precio) > 0).map(e => ({
    etiqueta: e.tipo === 'valija23' ? 'VALIJA DESPACHADA DE 23 KG' : 'CARRY ON 10 KG',
    monto: textoMonto(e.moneda || moneda, e.precio),
    nota: 'por valija',
  }))
  const explicacion = armarExplicacion({ tipo, grupos: grupos.filter(g => g.length), pas, noches })
  const incluye = armarIncluye({ tipo, vuelo, grupos: grupos.filter(g => g.length), destinos })
  // Si hay desayuno opcional o limpieza no incluida, se aclara que se paga aparte en el alojamiento
  const hayOpcional = hospedajes.some(h => /opcional/i.test(h.pension || ''))
  const hayLimpieza = hospedajes.some(h => h.limpieza_no_incluida)
  const notaAparte = hayOpcional || hayLimpieza
    ? `${hayOpcional && hayLimpieza ? 'El desayuno opcional y la limpieza, donde corresponda, se abonan' : hayOpcional ? 'El desayuno opcional, donde corresponda, se abona' : 'La limpieza, donde corresponda, se abona'} aparte directamente en el alojamiento.`
    : ''
  return { resumen, subtitulo, explicacion, incluye, base, secciones, equipaje, catalogoUrl, grupo, tablaGrupo, notaAparte }
}
