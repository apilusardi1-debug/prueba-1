import { rgb, PDFName, PDFArray, PDFString, pushGraphicsState, popGraphicsState, moveTo, lineTo, closePath, clip, endPath } from 'pdf-lib'

const NAVY_BG = rgb(0x07 / 255, 0x2e / 255, 0x40 / 255)
const NAVY_TXT = rgb(0x07 / 255, 0x2e / 255, 0x40 / 255)
const CREMA_BG = rgb(0xf0 / 255, 0xec / 255, 0xe7 / 255)

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

const SITIO_URL = 'https://prueba-1-rose.vercel.app'

// Dibuja la imagen manteniendo su proporcion real, recortando lo que sobre para
// llenar la caja completa (equivalente a object-fit:cover en CSS) — sin esto,
// pdf-lib estira la imagen para que encaje exacto y queda deformada.
function dibujarImagenCover(page, img, { x, y, width, height }) {
  const escala = Math.max(width / img.width, height / img.height)
  const anchoDibujado = img.width * escala
  const altoDibujado = img.height * escala
  const offsetX = x - (anchoDibujado - width) / 2
  const offsetY = y - (altoDibujado - height) / 2

  page.pushOperators(pushGraphicsState())
  page.pushOperators(
    moveTo(x, y),
    lineTo(x + width, y),
    lineTo(x + width, y + height),
    lineTo(x, y + height),
    closePath(),
    clip(),
    endPath(),
  )
  page.drawImage(img, { x: offsetX, y: offsetY, width: anchoDibujado, height: altoDibujado })
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
const IMG_LADO = 145
const BANDA_ALTO = 16
const GAP_BANDA_IMG = 3

function crearSlot(fila) {
  const top = CONTENIDO_TOP - fila * ALTO_FILA
  // Sin "+8" acá: el tapado tiene que cubrir el slice completo, sin dejar hueco
  // entre filas — un hueco sin tapar dejaba asomar la foto vieja de la plantilla
  // original (de 2 por hoja) que quedaba justo ahí debajo. El aire visual entre
  // filas se logra dejando margen en la posicion de la banda/foto, no en el tapado.
  const bottom = top - ALTO_FILA
  const bandaY = bottom + 6
  const imagenY = bandaY + BANDA_ALTO + GAP_BANDA_IMG
  const textoX = 30 + IMG_LADO + 18
  return {
    nombre: { x: textoX, y: top - 15, size: 16 },
    subtitulo: { x: textoX, y: top - 32, size: 9.5 },
    infoX: textoX, infoYTop: top - 50, infoSize: 10, infoGap: 12.5,
    itemsX: textoX, itemsSize: 9, itemsGap: 10.5,
    imagen: { x: 30, y: imagenY, width: IMG_LADO, height: IMG_LADO },
    bandaY,
    zonaLimpiarTop: top, zonaLimpiarBottom: bottom, zonaLimpiarLeft: 20, zonaLimpiarRight: 570,
  }
}

const SLOTS = [0, 1, 2, 3].map(crearSlot)

export async function agregarPaginaHospedajes(doc, plantillaDoc, bebas, helv, grupo) {
  const [paginaPlantilla] = await doc.copyPages(plantillaDoc, [1])
  doc.addPage(paginaPlantilla)

  function tapar(x, y, w, h, color) {
    paginaPlantilla.drawRectangle({ x, y, width: w, height: h, color })
  }
  function escribir(texto, x, y, size, color, font, opciones = {}) {
    paginaPlantilla.drawText(texto, { x, y, size, font, color, ...opciones })
  }

  for (let idx = 0; idx < grupo.length; idx++) {
    const h = grupo[idx]
    const s = SLOTS[idx]
    const piso = s.zonaLimpiarBottom + 4
    // Limpiamos toda la zona variable de este hospedaje (texto viejo de la referencia
    // o del hospedaje anterior en este mismo slot) y la volvemos a dibujar entera.
    tapar(s.zonaLimpiarLeft, s.zonaLimpiarBottom, s.zonaLimpiarRight - s.zonaLimpiarLeft, s.zonaLimpiarTop - s.zonaLimpiarBottom, CREMA_BG)

    // Nombre y subtitulo van en la columna de texto (a la derecha de la foto, que
    // ahora siempre esta a la izquierda) — sin descripcion, hay lugar de sobra para
    // 2 lineas de nombre sin invadir nada.
    const anchoColumnaTexto = 570 - s.nombre.x
    const lineasNombre = partirEnLineas((h.nombre || '').toUpperCase(), bebas, s.nombre.size, anchoColumnaTexto).slice(0, 2)
    lineasNombre.forEach((linea, i) => {
      escribir(linea, s.nombre.x, s.nombre.y - i * (s.nombre.size * 0.95), s.nombre.size, NAVY_TXT, bebas)
    })
    const ySubtitulo = s.subtitulo.y - (lineasNombre.length - 1) * (s.nombre.size * 0.95)
    let yFinEncabezado = ySubtitulo
    if (h.subtitulo) {
      const lineasSub = partirEnLineas(h.subtitulo.toUpperCase(), helv, s.subtitulo.size, anchoColumnaTexto).slice(0, 2)
      lineasSub.forEach((linea, i) => {
        escribir(linea, s.subtitulo.x, ySubtitulo - i * (s.subtitulo.size * 1.1), s.subtitulo.size, NAVY_TXT, helv)
      })
      yFinEncabezado = ySubtitulo - (lineasSub.length - 1) * (s.subtitulo.size * 1.1)
    }

    // Bloque de precio, empieza siempre despues del subtitulo real (baja si el
    // nombre o el subtitulo ocuparon 2 lineas) y nunca invade la fila de abajo.
    let y = Math.min(s.infoYTop, yFinEncabezado - 14)
    escribir(h.noches ? `${h.noches} NOCHES:` : 'NOCHES:', s.infoX, y, s.infoSize, NAVY_TXT, bebas); y -= s.infoGap
    escribir(`${h.moneda || 'ARS'}$ ${formatearNumero(h.precio)}`, s.infoX, y, s.infoSize, NAVY_TXT, bebas); y -= s.infoGap
    if (h.incluye && y >= piso) { escribir(h.incluye, s.infoX, y, s.infoSize, NAVY_TXT, bebas); y -= s.infoGap }
    if (h.pension && y >= piso) { escribir(h.pension, s.infoX, y, s.infoSize, NAVY_TXT, bebas); y -= s.infoGap }

    // Servicios: lista corta (la fila es chica, no hay lugar para mucho mas que
    // precio + un puñado de items) — se corta en el piso de la fila, nunca invade
    // la siguiente.
    const items = (h.items || []).filter(Boolean)
    if (items.length && y - s.itemsGap >= piso) {
      escribir(h.items_titulo || 'SERVICIOS:', s.itemsX, y, s.itemsSize, NAVY_TXT, bebas); y -= s.itemsGap
      for (const it of items) {
        if (y < piso) break
        escribir(`- ${it}`, s.itemsX, y, s.itemsSize, NAVY_TXT, helv)
        y -= s.itemsGap
      }
    }

    // Foto siempre a la izquierda, con la banda clickeable "VER INFORMACIÓN Y
    // FOTOS" pegada debajo (no encima como en la version de 2 por hoja, para que
    // se lea "al lado de la foto" y no tape parte de la imagen).
    tapar(s.imagen.x - 4, s.imagen.y - 4, s.imagen.width + 8, s.imagen.height + 8, CREMA_BG)
    if (h.imagen) {
      try {
        const bytes = await fetch(h.imagen).then(r => r.arrayBuffer())
        const esJpg = h.imagen.toLowerCase().includes('.jpg') || h.imagen.toLowerCase().includes('.jpeg') || h.imagen.startsWith('data:image/jpeg')
        const img = esJpg ? await doc.embedJpg(bytes) : await doc.embedPng(bytes)
        dibujarImagenCover(paginaPlantilla, img, s.imagen)
      } catch (_) { /* si falla la imagen, seguimos sin romper el resto */ }
    }

    // La foto y el cartelito son clickeables y llevan a la ficha de ese hospedaje
    // en el sitio publico (con la galeria de fotos del cuarto/habitacion elegida),
    // si sabemos su id real.
    if (h.id) {
      const urlHotel = h.habitacion_id
        ? `${SITIO_URL}/hoteles/${h.id}?habitacion=${h.habitacion_id}`
        : `${SITIO_URL}/hoteles/${h.id}`
      agregarLink(paginaPlantilla, doc, s.imagen, urlHotel)

      const banda = { x: s.imagen.x, y: s.bandaY, width: s.imagen.width, height: BANDA_ALTO }
      tapar(banda.x, banda.y, banda.width, banda.height, NAVY_BG)
      escribir('VER INFO Y FOTOS >', banda.x + 6, banda.y + 5, 8, rgb(0xc9 / 255, 0xe3 / 255, 0x4f / 255), helv)
      agregarLink(paginaPlantilla, doc, banda, urlHotel)
    }
  }

  return paginaPlantilla
}
