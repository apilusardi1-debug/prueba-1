import { rgb, PDFName, PDFArray, PDFString, pushGraphicsState, popGraphicsState, moveTo, lineTo, closePath, clip, endPath, appendBezierCurve } from 'pdf-lib'
import { pathRectRedondeado } from './pdfPlantillaAereos.js'
import { embedImagenAuto } from './pdfImagen.js'

const NAVY_BG = rgb(0x07 / 255, 0x2e / 255, 0x40 / 255)
const NAVY_TXT = rgb(0x07 / 255, 0x2e / 255, 0x40 / 255)
const CREMA_BG = rgb(0xf0 / 255, 0xec / 255, 0xe7 / 255)
// Mismo tono que CREMA_BG, pero usado como color de TEXTO sobre el fondo
// navy del encabezado (no existía en este archivo porque "HOSPEDAJES" viene
// impreso en la plantilla real, no se dibuja por código — hace falta para
// escribir el destino al lado, en el mismo renglón).
const CREMA_TXT = rgb(0xf0 / 255, 0xec / 255, 0xe7 / 255)

function formatearNumero(n) {
  return Number(n || 0).toLocaleString('es-AR')
}

// Convierte un rectangulo de la pagina en un area clickeable que abre `url`.
function agregarLink(page, doc, { x, y, width, height }, url) {
  const annotRef = doc.context.register(
    doc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [x, y, x + width, y + height],
      Border: [0, 0, 0],
      A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
    })
  )
  const existentes = page.node.lookup(PDFName.of('Annots'), PDFArray)
  const annots = existentes || doc.context.obj([])
  annots.push(annotRef)
  page.node.set(PDFName.of('Annots'), annots)
}

export const SITIO_URL = import.meta.env.VITE_SITIO_URL

// Contorno de un rectángulo con las puntas redondeadas, para recortar la foto
function contornoRedondeado(x, y, w, h, r) {
  const k = r * 0.5523 // aproximación de un cuarto de círculo con una curva
  return [
    moveTo(x + r, y), lineTo(x + w - r, y), appendBezierCurve(x + w - r + k, y, x + w, y + r - k, x + w, y + r),
    lineTo(x + w, y + h - r), appendBezierCurve(x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h),
    lineTo(x + r, y + h), appendBezierCurve(x + r - k, y + h, x, y + h - r + k, x, y + h - r),
    lineTo(x, y + r), appendBezierCurve(x, y + r - k, x + r - k, y, x + r, y), closePath(),
  ]
}

// Todas las fotos ocupan el mismo recuadro (pedido explícito: iguales entre sí). La foto no se deforma:
// se agranda hasta llenar el recuadro y se recorta lo que sobra, centrada (como object-fit: cover).
function dibujarImagenCover(page, img, { x, y, width, height }) {
  const escala = Math.max(width / img.width, height / img.height)
  const anchoDibujado = img.width * escala
  const altoDibujado = img.height * escala
  page.pushOperators(pushGraphicsState())
  page.pushOperators(...contornoRedondeado(x, y, width, height, RADIO), clip(), endPath())
  page.drawImage(img, { x: x - (anchoDibujado - width) / 2, y: y - (altoDibujado - height) / 2, width: anchoDibujado, height: altoDibujado })
  page.pushOperators(popGraphicsState())
}

// Parte una descripcion larga en lineas que entren en un ancho maximo, usando
// las metricas reales de la fuente (igual que haria un navegador).
function partirEnLineas(texto, font, size, anchoMax) {
  const palabras = (texto || '').split(/\s+/).filter(Boolean)
  const lineas = []
  let actual = ''
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra
    if (font.widthOfTextAtSize(prueba, size) > anchoMax && actual) {
      lineas.push(actual)
      actual = palabra
    } else {
      actual = prueba
    }
  }
  if (actual) lineas.push(actual)
  return lineas
}

// Layout nuevo: 4 hospedajes por pagina (antes 2), sin descripcion, con la foto
// siempre a la izquierda y un cartelito clickable "VER INFORMACIÓN Y FOTOS"
// pegado debajo de la foto. No hay plantilla real de referencia para este
// layout (el original solo traia 2 por hoja) — las coordenadas se calculan
// dividiendo en 4 filas iguales la misma zona de contenido que antes usaba el
// grupo de 2 (entre el encabezado "HOSPEDAJES" y el pie de pagina).
const CONTENIDO_TOP = 750
const CONTENIDO_BOTTOM = 60
const FILAS = 4
const ALTO_FILA = (CONTENIDO_TOP - CONTENIDO_BOTTOM) / FILAS
// Tres columnas por hospedaje: foto a la izquierda, información con el precio grande al medio y los botones
// de fotos a la derecha, centrados a la altura de la fila (pedido explícito).
const IMG_X = 24
const IMG_ANCHO = 200
const IMG_ALTO = 156 // casi 4:3, el formato más común de las fotos: es el que menos recorta
const RADIO = 8 // puntas redondeadas de fotos, precios y botones
const CAJA_ALTO = 68 // recuadro del precio; dos botones apilados miden lo mismo
const TEXTO_X = IMG_X + IMG_ANCHO + 14
const BOTONES_X = 420
const BOTONES_ANCHO = 150
const TEXTO_ANCHO = BOTONES_X - TEXTO_X - 8
const BOTON_SIZE = 15
const BOTON_PADDING = 8
const BOTON_GAP = 6
const BOTON_TXT = rgb(0xc9 / 255, 0xe3 / 255, 0x4f / 255)
const PRECIO_SIZE = 28

function crearSlot(fila, filas = 4) {
  const altoFila = (CONTENIDO_TOP - CONTENIDO_BOTTOM) / filas
  const top = CONTENIDO_TOP - fila * altoFila
  // Sin "+8" acá: el tapado tiene que cubrir el slice completo, sin dejar hueco
  // entre filas — un hueco sin tapar dejaba asomar la foto vieja de la plantilla
  // original (de 2 por hoja) que quedaba justo ahí debajo.
  const bottom = top - altoFila
  const bandaY = bottom + 6
  // Grilla de la fila: la foto, el recuadro del precio y los botones terminan en la misma línea, y el nombre
  // empieza a la altura del borde de arriba de la foto
  const fotoAbajo = bottom + (altoFila - IMG_ALTO) / 2
  const fotoArriba = fotoAbajo + IMG_ALTO
  return {
    nombre: { x: TEXTO_X, y: fotoArriba - 12, size: 17 },
    // 9, no 12: quedaba casi del mismo tamaño que el título de al lado.
    subtitulo: { x: TEXTO_X, y: fotoArriba - 26, size: 9 },
    infoX: TEXTO_X, infoYTop: fotoArriba - 42, infoSize: 12.5, infoGap: 13.5,
    itemsX: TEXTO_X, itemsSize: 11, itemsGap: 13,
    imagen: { x: IMG_X, y: fotoAbajo, width: IMG_ANCHO, height: IMG_ALTO },
    bandaY, top, bottom,
    zonaLimpiarTop: top, zonaLimpiarBottom: bottom, zonaLimpiarLeft: 20, zonaLimpiarRight: 575,
  }
}

const SLOTS = [0, 1, 2, 3].map(f => crearSlot(f, 4))
// Con 3 hospedajes o menos por hoja cada uno tiene más alto: entra el renglón "los N pasajeros", el botón
// del video y la descripción completa.
const SLOTS_3 = [0, 1, 2].map(f => crearSlot(f, 3))

const DIAS_CORTOS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
function diaCorto(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${DIAS_CORTOS[new Date(y, m - 1, d).getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}

// Las descripciones del catálogo vienen de cualquier parte (Niara, La Playa, copiadas a mano) y traen caracteres que
// la fuente del PDF no puede escribir (espacios de ancho cero, emojis, comillas raras): uno solo rompería todo el PDF.
const WIN_ANSI_EXTRA = new Set([0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178])
export function limpiarParaPdf(texto) {
  return Array.from(String(texto ?? ''))
    .map(c => {
      const n = c.codePointAt(0)
      if (n === 0x00a0 || n === 0x2007 || n === 0x202f) return ' '
      if (n === 0x200b || n === 0x200c || n === 0x200d || n === 0xfeff || n === 0x00ad) return ''
      if ((n >= 0x20 && n <= 0x7e) || (n >= 0xa1 && n <= 0xff) || WIN_ANSI_EXTRA.has(n)) return c
      return n < 0x20 ? ' ' : ''
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

// Descripción del hospedaje que cabe en `lineasMax` renglones: se corta en una palabra y termina en "…"
function descripcionEnLineas(texto, font, size, ancho, lineasMax) {
  const lineas = partirEnLineas(texto, font, size, ancho)
  if (lineas.length <= lineasMax) return lineas
  const corte = lineas.slice(0, lineasMax)
  let ultima = corte[lineasMax - 1].replace(/[\s,.;:]+$/, '')
  while (ultima && font.widthOfTextAtSize(ultima + '…', size) > ancho) ultima = ultima.replace(/\s*\S+$/, '')
  corte[lineasMax - 1] = ultima + '…'
  return corte
}

export async function agregarPaginaHospedajes(doc, plantillaDoc, bebas, helv, grupo, baseVueloTraslado = 0, combinada = false, opciones = {}) {
  const [paginaPlantilla] = await doc.copyPages(plantillaDoc, [1])
  doc.addPage(paginaPlantilla)

  function tapar(x, y, w, h, color) {
    paginaPlantilla.drawRectangle({ x, y, width: w, height: h, color })
  }
  function escribir(texto, x, y, size, color, font, opciones = {}) {
    paginaPlantilla.drawText(texto, { x, y, size, font, color, ...opciones })
  }

  // Destino al lado de "HOSPEDAJES", mismo renglón y tipografía — coordenadas
  // de "HOSPEDAJES" sacadas de la plantilla real (x=67, y=789, tamaño 30,
  // Bebas Neue) inspeccionando el PDF con pdfjs, porque ese título viene
  // impreso en la plantilla, no se dibuja por código. Un solo destino por
  // hoja (los hospedajes ya vienen agrupados por destino antes de llamar acá,
  // ver GeneradorPropuesta.jsx) — se toma del primero del grupo. Se achica si
  // no entra antes del ícono decorativo de la derecha (no hay coordenada
  // exacta de ese ícono en la plantilla, así que el límite es conservador).
  const destino = grupo[0]?.destino
  if (destino) {
    const HOSPEDAJES_X = 67
    const HOSPEDAJES_Y = 789
    const HOSPEDAJES_SIZE = 30
    const GAP = 18
    // Verificado renderizando la plantilla real: el ícono decorativo de la
    // derecha empieza cerca de x=522 — se deja margen hasta acá.
    const LIMITE_DERECHO = 505
    const xDestino = HOSPEDAJES_X + bebas.widthOfTextAtSize('HOSPEDAJES', HOSPEDAJES_SIZE) + GAP
    let tamanoDestino = HOSPEDAJES_SIZE
    const textoDestino = destino.toUpperCase()
    while (tamanoDestino > 12 && xDestino + bebas.widthOfTextAtSize(textoDestino, tamanoDestino) > LIMITE_DERECHO) tamanoDestino -= 0.5
    escribir(textoDestino, xDestino, HOSPEDAJES_Y, tamanoDestino, CREMA_TXT, bebas)
  }

  // La plantilla real trae 2 hospedajes de muestra fijos (para el diseño de 2 por
  // hoja original). Si esta pagina tiene menos de 4 hospedajes reales, las filas
  // sobrantes nunca se dibujaban y quedaba asomando esa muestra de la plantilla
  // (nombre, descripcion y foto de un hospedaje que nadie cargo). Por eso las 4
  // filas se limpian SIEMPRE, haya o no contenido real para cada una.
  tapar(20, CONTENIDO_BOTTOM, 555, CONTENIDO_TOP - CONTENIDO_BOTTOM, CREMA_BG)

  const amplio = grupo.length <= 3
  const slots = amplio ? SLOTS_3 : SLOTS
  const pasajeros = opciones.pasajeros || 0

  for (let idx = 0; idx < grupo.length; idx++) {
    const h = grupo[idx]
    const s = slots[idx]
    // Nombre y subtitulo van en la columna de texto (a la derecha de la foto, que
    // ahora siempre esta a la izquierda) — sin descripcion, hay lugar de sobra para
    // 2 lineas de nombre sin invadir nada.
    const anchoColumnaTexto = TEXTO_ANCHO
    // Descripción del hospedaje (del catálogo): columna a la derecha de la información
    // La descripción del hospedaje no va en la propuesta (ya está en el link de Niara)
    const descTxt = ''
    const DESC_X = 398
    const anchoInfo = descTxt ? DESC_X - s.infoX - 10 : anchoColumnaTexto
    const ajustar = (txt, size, ancho = anchoInfo, min = 6) => { let t = size; while (t > min && bebas.widthOfTextAtSize(txt, t) > ancho) t -= 0.5; return t }
    let tamanoNombreH = s.nombre.size
    while (tamanoNombreH > 13 && bebas.widthOfTextAtSize((h.nombre || '').toUpperCase(), tamanoNombreH) > anchoColumnaTexto) tamanoNombreH -= 0.5
    const lineasNombre = partirEnLineas((h.nombre || '').toUpperCase(), bebas, tamanoNombreH, anchoColumnaTexto).slice(0, 2)
    lineasNombre.forEach((linea, i) => {
      escribir(linea, s.nombre.x, s.nombre.y - i * (tamanoNombreH * 0.95), tamanoNombreH, NAVY_TXT, bebas)
    })
    const ySubtitulo = s.subtitulo.y - (lineasNombre.length - 1) * (tamanoNombreH * 0.95)
    let yFinEncabezado = ySubtitulo
    if (h.subtitulo) {
      let tamanoSub = s.subtitulo.size
      while (tamanoSub > 7 && helv.widthOfTextAtSize(h.subtitulo.toUpperCase(), tamanoSub) > anchoColumnaTexto) tamanoSub -= 0.25
      const lineasSub = partirEnLineas(h.subtitulo.toUpperCase(), helv, tamanoSub, anchoColumnaTexto).slice(0, 2)
      lineasSub.forEach((linea, i) => {
        escribir(linea, s.subtitulo.x, ySubtitulo - i * (tamanoSub * 1.1), tamanoSub, NAVY_TXT, helv)
      })
      yFinEncabezado = ySubtitulo - (lineasSub.length - 1) * (tamanoSub * 1.1)
    }

    // Un mismo hospedaje/complejo puede ofrecer mas de una habitacion o
    // departamento (hasta 4, elegidas en el Generador) — cada una necesita su
    // propio boton de areas internas (no uno compartido), porque cada una tiene
    // su propia ficha/fotos en el sitio.
    const habitacionesElegidas = h.habitaciones?.length
      ? h.habitaciones
      : (h.habitacion_id ? [{ id: h.habitacion_id, nombre: null }] : [])
    const nombreHabitacion = hab => ((hab.nombre || 'Habitación') + (hab.cantidad > 1 ? ` x${hab.cantidad}` : '')).toUpperCase()

    // Botones de fotos (internas por habitacion + externas del complejo): van
    // abajo de la informacion, en la columna de texto al lado de la foto, en
    // filas de izquierda a derecha. Se arman antes que la informacion para
    // saber cuanto lugar ocupan y que los renglones no se les metan encima.
    const botones = []
    if (h.id) {
      for (const hab of habitacionesElegidas) {
        botones.push({
          // Con una sola habitacion el nombre ya figura en la informacion; con
          // varias, el nombre va en el boton para saber cual es cual.
          texto: habitacionesElegidas.length > 1 ? `FOTOS ${nombreHabitacion(hab)} >` : 'VER FOTOS ÁREAS INTERNAS >',
          url: `${SITIO_URL}/hoteles/${h.id}?habitacion=${hab.id}&standalone=1`,
        })
      }
      // Fotos generales del complejo (pileta, canchas, areas comunes) — SIN
      // habitacion puntual — en modo standalone (el cliente no puede navegar a
      // otros hospedajes desde el link del PDF).
      botones.push({ texto: 'VER FOTOS ÁREAS EXTERNAS >', url: `${SITIO_URL}/hoteles/${h.id}?standalone=1` })
    }
    // Video del departamento / habitación (de la plataforma). Con los botones en columna entra también con 4 por hoja.
    if (h.video_depto) {
      botones.splice(botones.length - 1, 0, {
        texto: /departamento/i.test(h.tipo_alojamiento || '') ? 'VER VIDEO DEL DEPTO. >' : 'VER VIDEO >',
        url: h.video_depto,
      })
    }
    // Piso de la información: abajo queda reservado el lugar del precio
    const piso = s.imagen.y + 52

    // Precio: en Simple, cada hospedaje es una OPCIÓN alternativa, así que se
    // imprime el PAQUETE completo (aéreo + traslado + este hospedaje, vía
    // baseVueloTraslado) — SIEMPRE, no depende del tilde "Pública" de cada
    // hospedaje/habitación (ese tilde es para el precio individual, no para
    // este total; el total del paquete es público siempre, pedido explícito).
    // Antes se mostraba solo el precio del hospedaje y el total del paquete
    // vivía en una hoja final aparte (sacada del PDF).
    // En Combinada cada hospedaje es una ETAPA propia del viaje (aéreo y
    // traslado ya se imprimen aparte, discriminados, en sus propias hojas) —
    // sumarle baseVueloTraslado (el total de TODAS las etapas) en cada hoja
    // lo duplicaría por cada hospedaje. Se imprime solo el precio de ESE
    // hospedaje, y ahí sí respeta "Pública" como el resto de los precios
    // individuales (pedido explícito).
    let y = Math.min(s.infoYTop, yFinEncabezado - 15)
    const textoNoches = h.noches
      ? `${h.noches} NOCHES${opciones.conFechas && h.fecha_entrada && h.fecha_salida ? ` · DEL ${diaCorto(h.fecha_entrada)} AL ${diaCorto(h.fecha_salida)}` : ':'}`
      : 'NOCHES:'
    escribir(textoNoches, s.infoX, y, ajustar(textoNoches, s.infoSize), NAVY_TXT, bebas); y -= s.infoGap
    if (h.incluye && y >= piso) { escribir(h.incluye, s.infoX, y, ajustar(h.incluye, s.infoSize), NAVY_TXT, bebas); y -= s.infoGap }
    // Servicios tildados (Desayuno/Desayuno opcional/Media Pensión/Pensión
    // Completa/Servicio de Limpieza) — SIEMPRE se imprime, sin el chequeo de
    // espacio (y >= piso) que tienen las demás líneas opcionales: es
    // información que el cliente necesita ver sí o sí en cada hospedaje.
    if (h.pension) { escribir(h.pension, s.infoX, y, ajustar(h.pension, s.infoSize), NAVY_TXT, bebas); y -= s.infoGap }
    if (h.limpieza_no_incluida && y >= piso) { escribir('LIMPIEZA NO INCLUIDA', s.infoX, y, ajustar('LIMPIEZA NO INCLUIDA', s.infoSize), NAVY_TXT, bebas); y -= s.infoGap }

    // Nombre de la habitacion elegida, como un renglon mas de la informacion
    // (misma tipografia que "NOCHES"). Solo con una: con varias, cada nombre
    // ya va en su boton y repetirlos no entra en la fila.
    if (habitacionesElegidas.length === 1 && y >= piso) {
      const nombreHab = nombreHabitacion(habitacionesElegidas[0])
      let tamanoNombre = s.infoSize
      while (tamanoNombre > 6 && bebas.widthOfTextAtSize(nombreHab, tamanoNombre) > anchoInfo) tamanoNombre -= 0.5
      escribir(nombreHab, s.itemsX, y, tamanoNombre, NAVY_TXT, bebas)
      y -= s.infoGap
    }

    // Habitación que cotizó Niara en un hotel que no está en el catálogo: solo el nombre (no hay fotos que abrir)
    if (!habitacionesElegidas.length && h.habitacion_nombre && y >= piso) {
      const nombreHab = String(h.habitacion_nombre).toUpperCase()
      let tamanoNombre = s.infoSize
      while (tamanoNombre > 6 && bebas.widthOfTextAtSize(nombreHab, tamanoNombre) > anchoInfo) tamanoNombre -= 0.5
      escribir(nombreHab, s.itemsX, y, tamanoNombre, NAVY_TXT, bebas)
      y -= s.infoGap
    }

    // Precio en un recuadro azul con letras blancas (mismo diseño que "La base del viaje"), debajo de la información
    const precios = []
    let rotulo = ''
    let pie = ''
    if (combinada) {
      if (h.precio && h.precio_publico !== false) { precios.push(`${h.moneda || 'ARS'}$ ${formatearNumero(h.precio)}`); rotulo = 'SOLO HOSPEDAJE' }
    } else if (opciones.familias?.length && h.valores_familia?.length) {
      // Grupo: el valor total de cada familia (aéreos + hospedaje + traslados)
      h.valores_familia.forEach((valor, i) => precios.push(`${opciones.familias[i] || 'FAMILIA ' + (i + 1)}: ${h.moneda || 'ARS'}$ ${formatearNumero(valor)}`))
    } else if (h.fijo) {
      // Combinada uni: este hospedaje va incluido en el total de todas las opciones del otro destino
      precios.push('INCLUIDO EN TODAS LAS OPCIONES')
    } else {
      precios.push(`${h.moneda || 'ARS'}$ ${formatearNumero(baseVueloTraslado + (parseFloat(h.precio) || 0))}`)
      rotulo = 'TOTAL DEL PAQUETE'
    }
    if (!combinada && rotulo && pasajeros) pie = `LOS ${pasajeros} PASAJEROS`
    // El recuadro termina donde termina la foto; si la información ocupa mucho, se acorta un poco
    const cajaAlto = Math.max(48, Math.min(CAJA_ALTO, y + 6 - s.imagen.y))
    if (precios.length) {
      const varios = precios.length > 1
      const base = varios ? 16 : PRECIO_SIZE
      const altoContenido = (rotulo ? 14 : 0) + precios.length * (base + 3) + (pie ? 12 : 0)
      const k = Math.min(1, (cajaAlto - 6) / altoContenido)
      paginaPlantilla.drawSvgPath(pathRectRedondeado(TEXTO_ANCHO, cajaAlto, RADIO), { x: s.infoX, y: s.imagen.y + cajaAlto, color: NAVY_BG })
      const centrado = (t, yy, size) => {
        const tam = ajustar(t, size, TEXTO_ANCHO - 12)
        escribir(t, s.infoX + (TEXTO_ANCHO - bebas.widthOfTextAtSize(t, tam)) / 2, yy, tam, CREMA_TXT, bebas)
      }
      // Contenido centrado dentro del recuadro
      let yy = s.imagen.y + cajaAlto - (cajaAlto - altoContenido * k) / 2
      if (rotulo) { yy -= 10 * k; centrado(rotulo, yy, 11 * k); yy -= 4 * k }
      for (const t of precios) { yy -= base * k * 0.82; centrado(t, yy, base * k); yy -= (base * 0.18 + 3) * k }
      if (pie) { yy -= 8 * k; centrado(pie, yy, 10.5 * k) }
    }

    // Descripción del hospedaje, en la columna de la derecha (de la altura de "NOCHES" hasta los botones)
    if (descTxt) {
      const TAM = 8
      const LEAD = 10
      const yIni = Math.min(s.infoYTop, yFinEncabezado - 17)
      const maximas = Math.max(1, Math.floor((yIni - (s.bandaY + 2)) / LEAD) + 1)
      descripcionEnLineas(descTxt, helv, TAM, 570 - DESC_X, maximas).forEach((linea, i) => {
        escribir(linea, DESC_X, yIni - i * LEAD, TAM, NAVY_TXT, helv)
      })
    }

    // Botones de fotos: columna de la derecha, apilados desde la misma línea de abajo que la foto y el precio.
    // Dos botones ocupan exactamente el alto del recuadro del precio.
    const botonAlto = (cajaAlto - BOTON_GAP) / 2
    botones.forEach((b, i) => {
      const rect = { x: BOTONES_X, y: s.imagen.y + (botones.length - 1 - i) * (botonAlto + BOTON_GAP), width: BOTONES_ANCHO, height: botonAlto }
      let size = BOTON_SIZE
      while (size > 8 && bebas.widthOfTextAtSize(b.texto, size) + 2 * BOTON_PADDING > BOTONES_ANCHO) size -= 0.5
      paginaPlantilla.drawSvgPath(pathRectRedondeado(rect.width, rect.height, RADIO), { x: rect.x, y: rect.y + rect.height, color: NAVY_BG })
      // Bebas tiene la altura de mayusculas en ~0.7 del tamaño: asi queda centrado.
      escribir(b.texto, rect.x + (rect.width - bebas.widthOfTextAtSize(b.texto, size)) / 2, rect.y + (botonAlto - size * 0.7) / 2, size, BOTON_TXT, bebas)
      agregarLink(paginaPlantilla, doc, rect, b.url)
    })

    // Foto a la izquierda, todas del mismo tamaño
    tapar(s.imagen.x - 4, s.imagen.y - 4, s.imagen.width + 8, s.imagen.height + 8, CREMA_BG)
    let hayFoto = false
    if (h.imagen) {
      try {
        const bytes = await fetch(h.imagen).then(r => r.arrayBuffer())
        const img = await embedImagenAuto(doc, bytes)
        dibujarImagenCover(paginaPlantilla, img, s.imagen)
        hayFoto = true
      } catch (_) { /* si falla la imagen, seguimos sin romper el resto */ }
    }

    // La foto también es clickeable y lleva a las fotos generales del complejo,
    // igual que el boton "VER FOTOS ÁREAS EXTERNAS".
    if (h.id && hayFoto) agregarLink(paginaPlantilla, doc, s.imagen, `${SITIO_URL}/hoteles/${h.id}?standalone=1`)

    // Linea separadora entre hospedajes (no despues del ultimo) — inset
    // respecto de los margenes de la hoja, negra, mismo criterio que los
    // separadores del resto de la app.
    if (idx < grupo.length - 1) {
      paginaPlantilla.drawLine({ start: { x: 60, y: s.zonaLimpiarBottom }, end: { x: 540, y: s.zonaLimpiarBottom }, thickness: 0.75, color: rgb(0, 0, 0) })
    }
  }

  return paginaPlantilla
}
