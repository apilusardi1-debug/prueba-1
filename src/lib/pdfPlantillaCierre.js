import { PDFDocument, rgb, StandardFonts, PDFName, PDFArray, PDFString, pushGraphicsState, popGraphicsState, moveTo, lineTo, closePath, clip, endPath } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { convertirImagenABase64 } from './supabase.js'

// Mismos colores exactos que el resto de las plantillas (muestreados del PDF real).
// Navy y crema sirven tanto de fondo como de texto segun la zona (texto claro sobre
// fondo navy en el encabezado, texto oscuro sobre fondo crema en el resto).
const NAVY_TXT = rgb(0x07 / 255, 0x2e / 255, 0x40 / 255)
const NAVY_BG = rgb(0x07 / 255, 0x2e / 255, 0x40 / 255)
const CREMA_BG = rgb(0xf0 / 255, 0xec / 255, 0xe7 / 255)
const CREMA_TXT = rgb(0xf0 / 255, 0xec / 255, 0xe7 / 255)
// Las cajas de IDA/VUELTA son navy (no crema) y las horas van en una pildora
// amarilla — muestreados directo del PDF real, igual que el resto de los colores.
const AMARILLO_BG = rgb(0xc6 / 255, 0x9a / 255, 0x00 / 255)
const SITIO_URL = 'https://prueba-1-rose.vercel.app'

// Arma el texto de pasajeros con adultos y, si hay, menores (+ edades entre
// parentesis) — antes solo existia "cantidad de pasajeros" como si todos
// fueran adultos.
function textoPasajeros(adultos, menores, edades) {
  const nAdultos = Number(adultos) || 0
  const nMenores = Number(menores) || 0
  if (!nAdultos && !nMenores) return '—'
  let texto = nAdultos ? `${nAdultos} ${nAdultos === 1 ? 'ADULTO' : 'ADULTOS'}` : ''
  if (nMenores) {
    const menorTxt = `${nMenores} ${nMenores === 1 ? 'MENOR' : 'MENORES'}${edades?.trim() ? ` (${edades.trim()})` : ''}`
    texto = texto ? `${texto} + ${menorTxt}` : menorTxt
  }
  return texto
}

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
function fechaLarga(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} de ${MESES_LARGOS[m - 1]}`
}
function fechaCorta(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function formatearNumero(n) {
  return Number(n || 0).toLocaleString('es-AR')
}

// Dibuja la imagen manteniendo su proporcion real, recortando lo que sobre para
// llenar la caja completa (equivalente a object-fit:cover en CSS) — mismo patron
// que en pdfPlantillaHospedajes.js.
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

// Muchas fotos de hospedajes/habitaciones vienen de dominios externos (Omnibees,
// etc.) que no habilitan CORS para fetch() desde el navegador — igual que ya
// resuelve GeneradorPropuesta.jsx para la pagina de Hospedajes, las bajamos server-side
// (Edge Function "proxy-imagen") y de ahi sacamos los bytes, en vez de un fetch directo.
async function bytesDeImagen(url) {
  if (!url) return null
  try {
    const dataUri = url.startsWith('data:') ? url : (await convertirImagenABase64(url)).data?.dataUri
    if (!dataUri) return null
    const bytes = await fetch(dataUri).then(r => r.arrayBuffer())
    const esJpg = dataUri.startsWith('data:image/jpeg')
    return { bytes, esJpg }
  } catch (_) {
    return null
  }
}

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

// Todas las coordenadas salen de leer "Cierre propuesta.pdf" (texto vectorial real)
// con pdfjs-dist — igual que se hizo con la plantilla de Aereos/Hospedajes.
export async function generarPDFCierre(propuesta) {
  const plantillaBytes = await fetch('/plantilla-cierre.pdf').then(r => r.arrayBuffer())
  const doc = await PDFDocument.load(plantillaBytes)
  doc.registerFontkit(fontkit)
  const page = doc.getPage(0)

  const fontBytes = await fetch('/fonts/BebasNeue-Regular.ttf').then(r => r.arrayBuffer())
  const bebas = await doc.embedFont(fontBytes)
  const helv = await doc.embedFont(StandardFonts.Helvetica)

  function tapar(x, y, w, h, color = CREMA_BG) {
    page.drawRectangle({ x: x - 3, y: y - 3, width: w + 8, height: h, color })
  }
  function escribir(texto, x, y, size, color = NAVY_TXT, font = bebas) {
    page.drawText(String(texto ?? ''), { x, y, size, font, color })
  }
  // Alto del rectangulo ajustado al cap-height real (no size+8, que se comia la
  // linea de arriba en textos grandes como "vencimiento") con un margen chico.
  // El color de fondo del parche tiene que ser el fondo real de esa zona (crema en
  // el cuerpo, navy en el encabezado) — si no, queda un parche mal pegado.
  function reemplazar(texto, x, y, size, anchoMax, color, font = bebas, fondo = CREMA_BG) {
    tapar(x, y, Math.max(anchoMax, font.widthOfTextAtSize(String(texto ?? ''), size)), size * 0.8 + 5, fondo)
    escribir(texto, x, y, size, color, font)
  }
  // Para textos que pueden ser largos (nombre de hospedaje): en vez de desbordar
  // la columna o pisar la foto de al lado, achica la letra hasta que entre.
  function reemplazarAjustado(texto, x, y, size, anchoMax, color, font = bebas, fondo = CREMA_BG, tamanoMin = 12) {
    let tamano = size
    while (tamano > tamanoMin && font.widthOfTextAtSize(String(texto ?? ''), tamano) > anchoMax) tamano -= 1
    tapar(x, y - (size - tamano), anchoMax + 8, size * 0.8 + 5 + (size - tamano), fondo)
    escribir(texto, x, y, tamano, color, font)
  }
  // Ciudades de origen/destino: si el nombre no entra en el ancho real de la
  // caja (sobre todo el lado "destino", angosto por la esquina redondeada) se
  // achica hasta que entre, en vez de desbordar la caja o pisar el ícono de la
  // esquina — antes quedaban "cortadas" porque el ancho no se respetaba nunca.
  function reemplazarCiudad(texto, x, y, size, anchoMax, color, font = bebas, fondo = NAVY_BG, tamanoMin = 3.2) {
    let tamano = size
    while (tamano > tamanoMin && font.widthOfTextAtSize(String(texto ?? ''), tamano) > anchoMax) tamano -= 0.2
    tapar(x, y, anchoMax + 8, size * 0.8 + 5, fondo)
    escribir(texto, x, y, tamano, color, font)
  }
  function partirEnLineas(texto, font, size, anchoMax) {
    const palabras = String(texto ?? '').split(/\s+/).filter(Boolean)
    const lineas = []
    let actual = ''
    for (const palabra of palabras) {
      const prueba = actual ? `${actual} ${palabra}` : palabra
      if (font.widthOfTextAtSize(prueba, size) > anchoMax && actual) { lineas.push(actual); actual = palabra }
      else actual = prueba
    }
    if (actual) lineas.push(actual)
    return lineas
  }
  // Nombres largos de hospedaje: en vez de una linea que pisa la foto, se parte en
  // hasta 3 lineas cortas (la foto queda muy cerca del texto, hay poco ancho real).
  function reemplazarMultilinea(texto, x, y, size, anchoMax, gapLinea, color, font = bebas, fondo = CREMA_BG, maxLineas = 3) {
    const lineas = partirEnLineas(texto, font, size, anchoMax).slice(0, maxLineas)
    tapar(x, y - (lineas.length - 1) * gapLinea - 4, anchoMax + 8, lineas.length * gapLinea + 8, fondo)
    lineas.forEach((linea, i) => escribir(linea, x, y - i * gapLinea, size, color, font))
  }

  const vuelo = propuesta.vuelo || {}
  const hospedaje = (propuesta.hospedajes_detalle || [])[0] || {}
  const total = Number(propuesta.total) || 0
  const sena = Number(propuesta.sena) || 0
  const saldo = Math.max(total - sena, 0)

  // Encabezado — estos dos van sobre el fondo navy, por eso el parche y el texto
  // se invierten (parche navy, texto claro) en vez de los valores por defecto.
  reemplazar((propuesta.cliente_nombre || '').toUpperCase(), 31.2, 730.2, 20, 220, CREMA_TXT, bebas, NAVY_BG)
  // Propuestas viejas (previas al desglose adultos/menores) solo tienen
  // cantidad_pasajeros guardado — se usa como fallback tomandolos como adultos.
  const adultosParaTexto = propuesta.cantidad_adultos != null ? propuesta.cantidad_adultos : propuesta.cantidad_pasajeros
  reemplazar(textoPasajeros(adultosParaTexto, propuesta.cantidad_menores, propuesta.edades_menores), 31.2, 680.6, 20, 220, CREMA_TXT, bebas, NAVY_BG)
  // El campo "código de reserva" se sacó del flujo de cierre (ya no se pide al
  // cerrar la propuesta) — se tapa siempre, con o sin valor guardado, porque la
  // plantilla real tiene ahí texto de muestra ("e3p9hy") que si no se tapa queda
  // visible en todos los PDF.
  tapar(305.5, 601.7, 160, 60, CREMA_BG)

  // Ida (mitad izquierda) y vuelta (mitad derecha) — misma estructura, espejada.
  // Todo este bloque va sobre el fondo navy de la caja de vuelo (parche + texto
  // claro), salvo las horas que van en una pildora amarilla (parche amarillo +
  // texto oscuro) — confirmado muestreando el PDF real, no era fondo crema.
  // Mismo tamano para IDA y VUELTA (14 para codigos, 5 para ciudades) y misma
  // altura Y (antes vuelta quedaba 1-2pt mas abajo que ida porque la referencia
  // traia esos valores asi de muestra, sin estar realmente alineados entre si).
  const SIZE_CODIGO = 14
  const SIZE_CIUDAD = 5
  const SIZE_HORA = 10
  // Bajado 4pt respecto al valor original (560.2/553.6): a tamano 14 el codigo
  // (IGU/REC) llegaba con el techo de la letra casi pegado a la etiqueta estatica
  // "Origen"/"Destino" de la plantilla, quedando superpuestos.
  const Y_CODIGO = 556.2
  const Y_CIUDAD = 549.6
  reemplazar(fechaLarga(vuelo.ida_fecha).toUpperCase(), 46.1, 549.4, 9.3, 100, CREMA_TXT, bebas, NAVY_BG)
  reemplazar((vuelo.origen_codigo || '').toUpperCase(), 97.9, Y_CODIGO, SIZE_CODIGO, 50, CREMA_TXT, bebas, NAVY_BG)
  reemplazarCiudad(vuelo.origen_ciudad || '', 98.5, Y_CIUDAD, SIZE_CIUDAD, 60, CREMA_TXT)
  reemplazar(vuelo.ida_sale || '', 102.5, 541.9, SIZE_HORA, 30, NAVY_TXT, bebas, AMARILLO_BG)
  reemplazar((vuelo.destino_codigo || '').toUpperCase(), 250.5, Y_CODIGO, SIZE_CODIGO, 20, CREMA_TXT, bebas, NAVY_BG)
  reemplazarCiudad(vuelo.destino_ciudad || '', 251.1, Y_CIUDAD, SIZE_CIUDAD, 20, CREMA_TXT)
  reemplazar(vuelo.ida_llega || '', 254.4, 541.9, SIZE_HORA, 22, NAVY_TXT, bebas, AMARILLO_BG)
  // "Directo" es texto fijo de la plantilla real — si se cargo una escala lo
  // tapamos y ponemos el dato real; si no, se deja el "Directo" original tal cual.
  if (vuelo.ida_escala_ciudad || vuelo.ida_escala_codigo) {
    const codigoEscala = vuelo.ida_escala_codigo?.toUpperCase()
    reemplazarCiudad(`ESCALA ${codigoEscala || vuelo.ida_escala_ciudad?.toUpperCase() || ''}`, 173.5, 561.7, 6.5, 42, CREMA_TXT)
  }

  reemplazar(fechaLarga(vuelo.vuelta_fecha).toUpperCase(), 324.2, 551.2, 9.3, 100, CREMA_TXT, bebas, NAVY_BG)
  reemplazar((vuelo.destino_codigo || '').toUpperCase(), 375.9, Y_CODIGO, SIZE_CODIGO, 50, CREMA_TXT, bebas, NAVY_BG)
  reemplazarCiudad(vuelo.destino_ciudad || '', 376.6, Y_CIUDAD, SIZE_CIUDAD, 60, CREMA_TXT)
  reemplazar(vuelo.vuelta_sale || '', 379.9, 541.9, SIZE_HORA, 30, NAVY_TXT, bebas, AMARILLO_BG)
  reemplazar((vuelo.origen_codigo || '').toUpperCase(), 522.2, Y_CODIGO, SIZE_CODIGO, 20, CREMA_TXT, bebas, NAVY_BG)
  reemplazarCiudad(vuelo.origen_ciudad || '', 523.0, Y_CIUDAD, SIZE_CIUDAD, 20, CREMA_TXT)
  reemplazar(vuelo.vuelta_llega || '', 527.0, 541.9, SIZE_HORA, 22, NAVY_TXT, bebas, AMARILLO_BG)
  if (vuelo.vuelta_escala_ciudad || vuelo.vuelta_escala_codigo) {
    const codigoEscala = vuelo.vuelta_escala_codigo?.toUpperCase()
    reemplazarCiudad(`ESCALA ${codigoEscala || vuelo.vuelta_escala_ciudad?.toUpperCase() || ''}`, 451.9, 560.7, 6.5, 42, CREMA_TXT)
  }

  // Hospedaje — la foto empieza en x=157.7 (medido del PDF real), asi que el nombre
  // tiene poco ancho real; si es largo se parte en varias lineas cortas en vez de
  // desbordar sobre la foto.
  if (hospedaje.nombre) {
    reemplazarMultilinea(hospedaje.nombre.toUpperCase(), 31.2, 417.2, 14, 118, 14, NAVY_TXT, bebas, CREMA_BG, 3)
  }
  // La plantilla real trae una foto de muestra fija ahi (no era la del hospedaje
  // real, quedaba siempre la misma pileta sin importar cual se elija) — la tapamos
  // y dibujamos la foto real del hospedaje con cover-fit, igual que en la pagina de
  // Hospedajes.
  const fotoHospedaje = { x: 157.7, y: 366.5, width: 115.7, height: 115.7 }
  tapar(fotoHospedaje.x - 4, fotoHospedaje.y - 4, fotoHospedaje.width + 8, fotoHospedaje.height + 8, CREMA_BG)
  const fotoHospedajeDatos = await bytesDeImagen(hospedaje.imagen)
  if (fotoHospedajeDatos) {
    try {
      const img = fotoHospedajeDatos.esJpg ? await doc.embedJpg(fotoHospedajeDatos.bytes) : await doc.embedPng(fotoHospedajeDatos.bytes)
      dibujarImagenCover(page, img, fotoHospedaje)
    } catch (_) { /* si falla la imagen, seguimos sin romper el resto */ }
  }
  if (hospedaje.pension) {
    reemplazar(hospedaje.pension, 308.5, 444.1, 25, 200)
  }
  if (hospedaje.habitacion_nombre) {
    reemplazar(hospedaje.habitacion_nombre, 308.5, 414.1, 25, 200)
  }
  // Foto chica de la habitacion elegida (no del hospedaje en general) — pedido
  // explicito del usuario, no existia en la plantilla original. Mismo tamano que
  // la foto del hospedaje (115.7x115.7) y misma altura Y, mas a la derecha —
  // medido sobre una captura real que el usuario marco con un recuadro.
  const fotoHabitacionDatos = await bytesDeImagen(hospedaje.habitacion_imagen)
  if (fotoHabitacionDatos) {
    const fotoHabitacion = { x: 434, y: 366.5, width: 115.7, height: 115.7 }
    try {
      const img = fotoHabitacionDatos.esJpg ? await doc.embedJpg(fotoHabitacionDatos.bytes) : await doc.embedPng(fotoHabitacionDatos.bytes)
      dibujarImagenCover(page, img, fotoHabitacion)
    } catch (_) { /* si falla la imagen, seguimos sin romper el resto */ }
  }
  if (hospedaje.id) {
    const url = hospedaje.habitacion_id
      ? `${SITIO_URL}/hoteles/${hospedaje.id}?habitacion=${hospedaje.habitacion_id}`
      : `${SITIO_URL}/hoteles/${hospedaje.id}`
    agregarLink(page, doc, { x: 308, y: 368, width: 80, height: 16 }, url)
  }

  // Saldo pendiente y desglose. "Traslados" se sacó del flujo de cierre — se
  // tapa esa línea (la plantilla real trae "-Traslados R$ 300" de muestra ahí)
  // en vez de dejarla con el dato viejo, y el detalle queda en una sola línea.
  reemplazar(`${propuesta.moneda || 'ARS'}$ ${formatearNumero(saldo)}`, 308.7, 197.0, 25, 150)
  reemplazar(`-Hospedaje ${propuesta.moneda || 'ARS'}$ ${formatearNumero(saldo)}`, 308.6, 172.8, 10, 200, NAVY_TXT, helv)
  tapar(305.6, 161.8, 200, 13, CREMA_BG)
  if (propuesta.vencimiento_saldo) {
    reemplazar(`VENCIMIENTO: ${fechaCorta(propuesta.vencimiento_saldo)}`, 32.4, 173.3, 25, 260)
  }

  return doc
}
