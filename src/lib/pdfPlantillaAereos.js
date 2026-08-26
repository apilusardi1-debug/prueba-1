import { PDFDocument, rgb, PDFName, PDFArray, PDFString } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

// Convierte todo el recuadro del banner "SI TE INTERESA VER LAS ACTIVIDADES..." en un
// area clickeable que abre `url` (coordenadas medidas en la referencia real, en puntos PDF).
function agregarLinkBanner(page, doc, url) {
  const rect = [140, 85, 455, 166]
  const annotRef = doc.context.register(
    doc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: rect,
      Border: [0, 0, 0],
      A: {
        Type: 'Action',
        S: 'URI',
        URI: PDFString.of(url),
      },
    })
  )
  const existentes = page.node.lookup(PDFName.of('Annots'), PDFArray)
  const annots = existentes || doc.context.obj([])
  annots.push(annotRef)
  page.node.set(PDFName.of('Annots'), annots)
}

// Colores exactos muestreados del PDF de referencia (no los de la app, que son
// aproximados) — con esto los rectangulos que tapan texto viejo quedan invisibles.
const NAVY_BG = rgb(0x07 / 255, 0x2e / 255, 0x40 / 255)
const NAVY_TXT = rgb(0x07 / 255, 0x2e / 255, 0x40 / 255)
const CREMA_TXT = rgb(0xf0 / 255, 0xec / 255, 0xe7 / 255)
const CREMA_BG = rgb(0xf0 / 255, 0xec / 255, 0xe7 / 255)

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
function fechaLarga(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} de ${MESES_LARGOS[m - 1]}`.toUpperCase()
}

const EQUIPAJE_LABELS = {
  mochila: 'MOCHILA DE MANO',
  carryOn: 'CARRY ON 10 KG',
  valija23: 'VALIJA 23 KG',
  extra: 'EQUIPAJE EXTRA',
}

// Todas las coordenadas vienen de leer el PDF de referencia real con pdfjs-dist
// (texto embebido, no una imagen) — son puntos PDF exactos, no aproximaciones.
export async function generarPaginaAereosPDF({ clienteNombre, cantidadPasajeros, vuelo }) {
  const plantillaBytes = await fetch('/plantilla-aereos.pdf').then(r => r.arrayBuffer())
  const doc = await PDFDocument.load(plantillaBytes)
  doc.registerFontkit(fontkit)

  // Nos quedamos solo con la pagina 1 (Aereos); la 2 era el hospedaje de muestra del template.
  while (doc.getPageCount() > 1) doc.removePage(1)
  const page = doc.getPage(0)

  const fontBytes = await fetch('/fonts/BebasNeue-Regular.ttf').then(r => r.arrayBuffer())
  const bebas = await doc.embedFont(fontBytes)

  function tapar(x, y, w, h, color) {
    page.drawRectangle({ x: x - 3, y: y - 6, width: w + 8, height: h, color })
  }
  function escribir(texto, x, y, size, color, font = bebas) {
    page.drawText(texto, { x, y, size, font, color })
  }
  function reemplazarLinea({ x, y, anchoMax, alto, texto, size, color, bg }) {
    tapar(x, y, Math.max(anchoMax, bebas.widthOfTextAtSize(texto, size)), alto, bg)
    escribir(texto, x, y, size, color)
  }
  // Si el texto no entra en el ancho disponible (nombres de ciudad largos), achica la
  // letra hasta que entre, en vez de dejarlo desbordar el margen derecho de la pagina.
  function reemplazarLineaAjustada({ x, y, anchoMax, alto, texto, size, color, bg, tamanoMin = 14 }) {
    let tamano = size
    while (tamano > tamanoMin && bebas.widthOfTextAtSize(texto, tamano) > anchoMax) tamano -= 1
    tapar(x, y - 8, anchoMax + 20, alto + 8, bg)
    escribir(texto, x, y, tamano, color)
  }

  // Nombre del cliente y cantidad de pasajeros (fondo navy)
  reemplazarLinea({ x: 31.38, y: 730.82, anchoMax: 220, alto: 26, texto: clienteNombre.toUpperCase(), size: 20, color: CREMA_TXT, bg: NAVY_BG })
  const textoAdultos = `${cantidadPasajeros || '—'} ${Number(cantidadPasajeros) === 1 ? 'ADULTO' : 'ADULTOS'}`
  reemplazarLinea({ x: 31.36, y: 681.22, anchoMax: 220, alto: 26, texto: textoAdultos, size: 20, color: CREMA_TXT, bg: NAVY_BG })

  // Equipaje: lista dinamica segun checkboxes, con reflow del contenido de abajo
  // (Traslados, Aeropuerto/Hotel, In-Out) si la cantidad de lineas cambia respecto
  // a la referencia (que tenia 3 lineas).
  const equipajeSeleccionado = ['mochila', 'carryOn', 'valija23', 'extra']
    .filter(k => vuelo.equipaje?.[k])
    .map(k => {
      const extra = k === 'extra' && vuelo.equipaje?.extraDescripcion?.trim()
      return `- 1 ${EQUIPAJE_LABELS[k]}${extra ? `: ${vuelo.equipaje.extraDescripcion.toUpperCase()}` : ''}`
    })

  const REF_EQUIPAJE_TOP = 525.42 // y de la primera linea de equipaje en la referencia
  const REF_EQUIPAJE_LINEAS = 3
  const GAP_LINEA = 24
  const REF_TRASLADOS_Y = 399.89

  // Tapamos toda la zona variable (desde arriba de la primera linea de equipaje
  // hasta abajo de "IN - OUT") y la volvemos a dibujar entera con las posiciones
  // correctas segun cuantas lineas de equipaje haya realmente.
  const zonaTop = REF_EQUIPAJE_TOP + 22
  const zonaBottom = 351.89 - 8
  tapar(56, zonaBottom, 500, zonaTop - zonaBottom, CREMA_BG)

  let y = REF_EQUIPAJE_TOP
  for (const linea of equipajeSeleccionado) {
    escribir(linea, 56.07, y, 20, NAVY_TXT)
    y -= GAP_LINEA
  }
  const yTraslados = REF_TRASLADOS_Y + (REF_EQUIPAJE_LINEAS - equipajeSeleccionado.length) * GAP_LINEA
  escribir('TRASLADOS PRIVADOS INCLUIDOS:', 59.90, yTraslados, 25, NAVY_TXT)
  escribir('AEROPUERTO / HOTEL', 59.90, yTraslados - 24, 20, NAVY_TXT)
  escribir('IN - OUT', 59.90, yTraslados - 48, 20, NAVY_TXT)

  // IDA / VUELTA — tapamos cada linea completa y la re-escribimos entera
  // (simplificacion: sin negrita parcial dentro de la linea, mismo tamano/color/fuente que la referencia).
  reemplazarLinea({ x: 94.82, y: 279.21, anchoMax: 160, alto: 30, texto: fechaLarga(vuelo.ida_fecha), size: 25, color: NAVY_TXT, bg: CREMA_BG })
  reemplazarLineaAjustada({ x: 61.19, y: 255.21, anchoMax: 292, alto: 24, texto: `SALE DE ${vuelo.origen_ciudad?.toUpperCase() || ''} (${vuelo.origen_codigo?.toUpperCase() || ''}) ${vuelo.ida_sale || ''} HS`, size: 20, color: NAVY_TXT, bg: CREMA_BG })
  reemplazarLineaAjustada({ x: 61.19, y: 231.21, anchoMax: 292, alto: 24, texto: `LLEGA A ${vuelo.destino_ciudad?.toUpperCase() || ''} (${vuelo.destino_codigo?.toUpperCase() || ''}) ${vuelo.ida_llega || ''} HS`, size: 20, color: NAVY_TXT, bg: CREMA_BG })

  reemplazarLinea({ x: 444.78, y: 278.63, anchoMax: 160, alto: 30, texto: fechaLarga(vuelo.vuelta_fecha), size: 25, color: NAVY_TXT, bg: CREMA_BG })
  reemplazarLineaAjustada({ x: 381.70, y: 254.63, anchoMax: 180, alto: 24, texto: `SALE DE ${vuelo.destino_ciudad?.toUpperCase() || ''} (${vuelo.destino_codigo?.toUpperCase() || ''}) ${vuelo.vuelta_sale || ''} HS`, size: 20, color: NAVY_TXT, bg: CREMA_BG })
  reemplazarLineaAjustada({ x: 381.70, y: 230.63, anchoMax: 180, alto: 24, texto: `LLEGA A ${vuelo.origen_ciudad?.toUpperCase() || ''} (${vuelo.origen_codigo?.toUpperCase() || ''}) ${vuelo.vuelta_llega || ''} HS`, size: 20, color: NAVY_TXT, bg: CREMA_BG })

  // Recuadro "SI TE INTERESA VER LAS ACTIVIDADES..." clickeable, si el vuelo tiene
  // un link de actividades cargado en el formulario.
  if (vuelo.banner_link) {
    agregarLinkBanner(page, doc, vuelo.banner_link)
  }

  return doc
}
