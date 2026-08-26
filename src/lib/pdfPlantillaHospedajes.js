import { rgb, PDFName, PDFArray, PDFString, pushGraphicsState, popGraphicsState, moveTo, lineTo, closePath, clip, endPath } from 'pdf-lib'

const NAVY_BG = rgb(0x07 / 255, 0x2e / 255, 0x40 / 255)
const NAVY_TXT = rgb(0x07 / 255, 0x2e / 255, 0x40 / 255)
const CREMA_BG = rgb(0xf0 / 255, 0xec / 255, 0xe7 / 255)
// Relacion cap-height/tamano de Bebas Neue, para alinear por el tope dos lineas de
// distinto tamano en la misma fuente (calibrado a ojo, se ajusta si hace falta).
const CAP_RATIO = 0.75

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

// Coordenadas de la plantilla (extraidas del PDF de referencia real, pagina 2).
// Cada slot es una de las dos posiciones de hospedaje en la pagina; se alternan
// imagen izquierda/derecha igual que el diseño original.
const SLOTS = [
  {
    nombre: { x: 30.90, y: 723.77, size: 29 },
    subtitulo: { x: 30.90, y: 700.12, size: 14.5 },
    infoX: 315.86, infoYTop: 737.91, infoSize: 15, infoGap: 14,
    imagen: { x: 30.90, y: 440.32, width: 265.72, height: 264.67 },
    descX: 314.69, descYTop: 673.15, descSize: 10, descGap: 13, descAncho: 250,
    itemsX: 315.50, itemsYTop: 559.45, itemsSize: 10, itemsGap: 13,
    videoX: 119.18, videoY: 469.02,
    zonaLimpiarTop: 750, zonaLimpiarBottom: 440, zonaLimpiarLeft: 20, zonaLimpiarRight: 570,
  },
  {
    nombre: { x: 30.75, y: 347.02, size: 29 },
    subtitulo: { x: 30.75, y: 323.37, size: 14.5 },
    infoX: 296.68, infoYTop: 361.74, infoSize: 15, infoGap: 14,
    imagen: { x: 296.68, y: 84.63, width: 264.54, height: 264.54 },
    descX: 31.53, descYTop: 292.46, descSize: 10, descGap: 13, descAncho: 250,
    itemsX: 30.53, itemsYTop: 223.85, itemsSize: 10, itemsGap: 12,
    videoX: 386.65, videoY: 89.84,
    zonaLimpiarTop: 373, zonaLimpiarBottom: 60, zonaLimpiarLeft: 20, zonaLimpiarRight: 570,
  },
]

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
    // Limpiamos toda la zona variable de este hospedaje (texto viejo de la referencia)
    // y la volvemos a dibujar entera con los datos reales.
    tapar(s.zonaLimpiarLeft, s.zonaLimpiarBottom, s.zonaLimpiarRight - s.zonaLimpiarLeft, s.zonaLimpiarTop - s.zonaLimpiarBottom, CREMA_BG)

    // Nombre y subtitulo se ajustan a un ancho maximo (no invaden la columna del
    // precio a la derecha) y el subtitulo baja si el nombre ocupo mas de una linea.
    const anchoColumnaIzq = 270
    const lineasNombre = partirEnLineas((h.nombre || '').toUpperCase(), bebas, s.nombre.size, anchoColumnaIzq).slice(0, 2)
    lineasNombre.forEach((linea, i) => {
      escribir(linea, s.nombre.x, s.nombre.y - i * (s.nombre.size * 0.95), s.nombre.size, NAVY_TXT, bebas)
    })
    const ySubtitulo = s.subtitulo.y - (lineasNombre.length - 1) * (s.nombre.size * 0.95)
    // Guardamos donde termino realmente el subtitulo (puede ser 1 o 2 lineas) para
    // correr la descripcion hacia abajo si hizo falta mas espacio del previsto.
    let yFinEncabezado = ySubtitulo
    if (h.subtitulo) {
      const lineasSub = partirEnLineas(h.subtitulo.toUpperCase(), helv, s.subtitulo.size, anchoColumnaIzq).slice(0, 2)
      lineasSub.forEach((linea, i) => {
        escribir(linea, s.subtitulo.x, ySubtitulo - i * (s.subtitulo.size * 1.1), s.subtitulo.size, NAVY_TXT, helv)
      })
      yFinEncabezado = ySubtitulo - (lineasSub.length - 1) * (s.subtitulo.size * 1.1)
    }
    const descYTop = Math.min(s.descYTop, yFinEncabezado - 22)

    // El bloque de precio siempre se alinea por el TOPE con la primera linea del
    // titulo (misma fuente, asi que la diferencia de tamano define el offset exacto
    // entre lineas base) — independiente de si el nombre ocupo 1 o 2 lineas.
    let y = s.nombre.y + (s.nombre.size - s.infoSize) * CAP_RATIO
    escribir(h.noches ? `${h.noches} NOCHES:` : 'NOCHES:', s.infoX, y, s.infoSize, NAVY_TXT, bebas); y -= s.infoGap
    escribir(`${h.moneda || 'ARS'}$ ${formatearNumero(h.precio)}`, s.infoX, y, s.infoSize, NAVY_TXT, bebas); y -= s.infoGap
    if (h.incluye) { escribir(h.incluye, s.infoX, y, s.infoSize, NAVY_TXT, bebas); y -= s.infoGap }
    if (h.pension) { escribir(h.pension, s.infoX, y, s.infoSize, NAVY_TXT, bebas); y -= s.infoGap }

    // La foto nunca puede invadir el espacio del titulo/subtitulo que esta arriba de
    // ella: si el borde superior original queda muy cerca, se achica la imagen (no se
    // mueve el texto) para dejar un margen de seguridad limpio.
    const imagenTopMax = yFinEncabezado - 14
    const imagenTopOriginal = s.imagen.y + s.imagen.height
    const imagen = imagenTopOriginal > imagenTopMax
      ? { ...s.imagen, height: imagenTopMax - s.imagen.y }
      : s.imagen

    // Tapamos la foto vieja de la plantilla (con margen de seguridad) ANTES de poner
    // la nueva: si no, quedan restos de la imagen original asomando en los bordes.
    // Ojo: el margen de arriba NO se agranda (queda pegado al borde real de la imagen),
    // porque el subtitulo puede estar justo encima y un margen de mas lo tapa.
    tapar(imagen.x - 4, imagen.y - 4, imagen.width + 8, imagen.height + 4, CREMA_BG)
    if (h.imagen) {
      try {
        const bytes = await fetch(h.imagen).then(r => r.arrayBuffer())
        const esJpg = h.imagen.toLowerCase().includes('.jpg') || h.imagen.toLowerCase().includes('.jpeg') || h.imagen.startsWith('data:image/jpeg')
        const img = esJpg ? await doc.embedJpg(bytes) : await doc.embedPng(bytes)
        dibujarImagenCover(paginaPlantilla, img, imagen)
      } catch (_) { /* si falla la imagen, seguimos sin romper el resto */ }
    }

    // La foto es clickeable y lleva a la ficha de ese hospedaje en el sitio publico
    // (con la galeria de fotos del cuarto/habitacion elegida), si sabemos su id real.
    // Se agrega ademas un boton "VER FOTOS" visible, propio (no el de la plantilla
    // vieja), para que quede bien pegado al borde real de la imagen aunque se haya
    // achicado por falta de espacio.
    if (h.id) {
      const urlHotel = h.habitacion_id
        ? `${SITIO_URL}/hoteles/${h.id}?habitacion=${h.habitacion_id}`
        : `${SITIO_URL}/hoteles/${h.id}`
      agregarLink(paginaPlantilla, doc, imagen, urlHotel)

      const bandaAlto = 18
      tapar(imagen.x, imagen.y, imagen.width, bandaAlto, NAVY_BG)
      escribir('VER FOTOS >', imagen.x + 8, imagen.y + 5, 10, rgb(0xc9 / 255, 0xe3 / 255, 0x4f / 255), helv)
      agregarLink(paginaPlantilla, doc, { x: imagen.x, y: imagen.y, width: imagen.width, height: bandaAlto }, urlHotel)
    }

    // La descripcion puede ser mucho mas larga que la de la referencia: la dibujamos
    // completa y despues corremos el bloque de servicios hacia abajo si hizo falta,
    // para que nunca se pisen (antes quedaba todo superpuesto con textos largos).
    // Nunca dibujamos por debajo del piso de la zona de este hospedaje: si el
    // contenido es muy largo, se corta ahi en vez de invadir el otro hospedaje.
    const piso = s.zonaLimpiarBottom + 6
    let finDescripcion = s.itemsYTop + s.itemsGap
    if (h.descripcion) {
      const lineas = partirEnLineas(h.descripcion, helv, s.descSize, s.descAncho)
      let yd = descYTop
      for (const linea of lineas) {
        if (yd < piso) break
        escribir(linea, s.descX, yd, s.descSize, NAVY_TXT, helv)
        yd -= s.descGap
      }
      finDescripcion = yd
    }

    const items = (h.items || []).filter(Boolean)
    if (items.length) {
      let yi = Math.min(s.itemsYTop, finDescripcion - 10)
      if (yi >= piso) {
        escribir(h.items_titulo || 'SERVICIOS:', s.itemsX, yi, s.itemsSize, NAVY_TXT, bebas); yi -= s.itemsGap
        for (const it of items) {
          if (yi < piso) break
          escribir(`- ${it}`, s.itemsX, yi, s.itemsSize, NAVY_TXT, helv)
          yi -= s.itemsGap
        }
      }
    }

    if (h.link_video) {
      escribir('CLIC ACÁ PARA VER VIDEOS >', s.videoX, s.videoY, 10, rgb(0xc9/255, 0xe3/255, 0x4f/255), helv)
    }
  }

  return paginaPlantilla
}
