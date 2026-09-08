import { PDFDocument, rgb, StandardFonts, PDFName, PDFArray, PDFString, pushGraphicsState, popGraphicsState, moveTo, lineTo, closePath, clip, endPath } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { convertirImagenABase64 } from './supabase.js'
import { embedImagenAuto } from './pdfImagen.js'
// Misma caja de tramo (borde redondeado, flecha, escala centrada) que la
// grilla de vuelos de la propuesta inicial — antes este PDF tenia su propio
// diseño viejo (pildoras amarillas fijas de la plantilla), inconsistente con
// el otro PDF.
import { dibujarCajaTramo, altoCajaTramo, EQUIPAJE_LABELS } from './pdfPlantillaAereos.js'

// Mismos colores exactos que el resto de las plantillas (muestreados del PDF real).
// Navy y crema sirven tanto de fondo como de texto segun la zona (texto claro sobre
// fondo navy en el encabezado, texto oscuro sobre fondo crema en el resto).
const NAVY_TXT = rgb(0x07 / 255, 0x2e / 255, 0x40 / 255)
const NAVY_BG = rgb(0x07 / 255, 0x2e / 255, 0x40 / 255)
const CREMA_BG = rgb(0xf0 / 255, 0xec / 255, 0xe7 / 255)
const CREMA_TXT = rgb(0xf0 / 255, 0xec / 255, 0xe7 / 255)
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
    return await fetch(dataUri).then(r => r.arrayBuffer())
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
  // Se probó extraer del PDF real la fuente que usa "Observaciones importantes"
  // (misma familia, "Helvetica"/"Helvetica-Bold" segun el nombre interno) para
  // que el bloque de pago combine exacto — pero esa copia embebida en la
  // plantilla nunca necesitó números, "$" ni "/" en esa página, y esos glifos
  // vienen directamente vacíos en el archivo (no es un bug nuestro, el dato no
  // está). Se usa la Helvetica estandar en su lugar: mismo nombre de familia,
  // con todos los glifos que necesitamos garantizados.
  const helv = await doc.embedFont(StandardFonts.Helvetica)
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold)

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
  // Parrafo con partes en negrita (bloque de pago) — mismo tono que la pagina
  // "Observaciones importantes" de la plantilla real: texto corrido con los
  // datos clave resaltados, en vez de renglones sueltos tipo ficha tecnica.
  // Cada segmento es {texto, bold}; la puntuacion que deba pegarse a una
  // palabra (coma, punto) va incluida en el texto de ESE segmento, nunca
  // suelta en uno propio — si no, el word-wrap le mete un espacio antes.
  // Separada del dibujado para poder MEDIR cuantas lineas ocupa un parrafo
  // (cuanta altura va a usar) antes de decidir donde dibujarlo — la usa el
  // checklist de DETALLE (ver mas abajo) para repartir el espacio libre de su
  // pagina entre los items en vez de dejarlos amontonados arriba.
  function partirEnLineasRico(segmentos, size, anchoMax) {
    const ESPACIO = helv.widthOfTextAtSize(' ', size)
    const palabras = []
    for (const { texto, bold } of segmentos) {
      const font = bold ? helvBold : helv
      for (const palabra of String(texto).split(/\s+/).filter(Boolean)) palabras.push({ texto: palabra, font })
    }
    const lineas = [[]]
    let anchoLinea = 0
    for (const p of palabras) {
      const anchoPalabra = p.font.widthOfTextAtSize(p.texto, size)
      const lineaActual = lineas[lineas.length - 1]
      const anchoConEspacio = lineaActual.length ? anchoLinea + ESPACIO + anchoPalabra : anchoPalabra
      if (anchoConEspacio > anchoMax && lineaActual.length) {
        lineas.push([p])
        anchoLinea = anchoPalabra
      } else {
        lineaActual.push(p)
        anchoLinea = anchoConEspacio
      }
    }
    return { lineas, ESPACIO }
  }

  // `pagina` parametrizado (default: la de siempre) — el checklist de DETALLE
  // se movio a una hoja aparte (ver mas abajo) y necesita dibujar sobre esa
  // pagina nueva, no sobre la primera.
  function dibujarParrafoRico(segmentos, x, y, size, anchoMax, gapLinea, color, pagina = page) {
    const { lineas, ESPACIO } = partirEnLineasRico(segmentos, size, anchoMax)
    lineas.forEach((linea, i) => {
      let cursorX = x
      const yLinea = y - i * gapLinea
      linea.forEach(p => {
        pagina.drawText(p.texto, { x: cursorX, y: yLinea, size, font: p.font, color })
        cursorX += p.font.widthOfTextAtSize(p.texto, size) + ESPACIO
      })
    })
    // Devuelve cuantas lineas ocupo — el llamador lo usa para ubicar lo que va
    // justo debajo pegado a este bloque, sin importar si salieron 1, 2 o 3 lineas.
    return lineas.length
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

  // "AÉREOS" traía un botón fijo "VER DETALLES" debajo que no llevaba a
  // ningún lado real — se saca, y el título baja un poco para quedar
  // centrado en el aire que deja libre (antes quedaba pegado arriba, con
  // el botón pisándole el espacio de abajo).
  // Tamaño 29 (no 25): medido pixel a pixel sobre "HOSPEDAJE" (titulo fijo de
  // la plantilla, sin tocar) para que los tres titulos de seccion — AÉREOS,
  // HOSPEDAJE, TRASLADOS — queden todos del mismo tamaño visual en vez de
  // cada uno a una escala distinta.
  tapar(28, 600, 250, 65, CREMA_BG)
  // x=28, no 31.96: alineado con el borde izquierdo de la caja de IDA de abajo
  // (X_CAJA_IDA) y con "IDA · ..." — antes quedaba un pelo mas a la derecha
  // que ambos, notorio en la comparacion pixel a pixel que hizo el usuario.
  escribir('AÉREOS', 28, 620, 29, NAVY_TXT)

  // Boton chico (navy + texto lima, mismo estilo que el resto de los carteles
  // clickeables de la app) al lado del titulo — el link al e-ticket/voucher
  // del vuelo, cargado en el panel de Documentos, antes no tenia ningun lugar
  // donde aparecer en este PDF (solo quedaba en el checklist de DETALLE, mas
  // chico y facil de pasar por alto).
  const linkAereoBoton = propuesta.aereo_link || propuesta.aereo_pdf_url
  if (linkAereoBoton) {
    const textoBotonAereo = 'VER E-TICKET / VOUCHER'
    const anchoBotonAereo = helv.widthOfTextAtSize(textoBotonAereo, 7.5)
    const botonAereo = { x: 150, y: 613, width: anchoBotonAereo + 12, height: 16 }
    page.drawRectangle({ ...botonAereo, color: NAVY_BG })
    escribir(textoBotonAereo, botonAereo.x + 6, botonAereo.y + 5, 7.5, rgb(0xc9 / 255, 0xe3 / 255, 0x4f / 255), helvBold)
    agregarLink(page, doc, botonAereo, linkAereoBoton)
  }

  // El campo "código de reserva" se sacó del flujo de cierre (ya no se pide al
  // cerrar la propuesta) — se tapa siempre, con o sin valor guardado, porque la
  // plantilla real tiene ahí texto de muestra ("e3p9hy") que si no se tapa queda
  // visible en todos los PDF.
  tapar(305.5, 601.7, 160, 60, CREMA_BG)
  // Linea vertical fija de la plantilla real (separaba "AÉREOS" de "CÓDIGO DE
  // RESERVA") — con ese campo tapado ya no separa nada, queda flotando sola
  // arriba de la caja de VUELTA. Medida sobre la plantilla real: x≈297.4,
  // y 540-653. Alto tope en 127 (no mas: el limite navy/crema de esta franja
  // esta en y=662 — un tapado mas alto asomaba un mordisco crema en el fondo
  // navy del encabezado, arriba de ese limite).
  tapar(295, 538, 4, 127, CREMA_BG)

  // Ida (mitad izquierda) y vuelta (mitad derecha): mismas cajas con borde
  // redondeado + flecha + escala centrada que la grilla de vuelos de la
  // propuesta inicial (dibujarCajaTramo, importada) — antes esta seccion
  // usaba las pildoras amarillas fijas de la plantilla real, con un diseño
  // que no combinaba con el del otro PDF. Se tapa esa zona entera (medida
  // sobre la plantilla real: x 25-569, y 525-603) y se redibuja desde cero.
  tapar(28, 528, 536, 78, CREMA_BG)
  const X_CAJA_IDA = 28
  const X_CAJA_VUELTA = 306
  const ANCHO_CAJA = 254
  let yCaja = 597
  escribir(`IDA · ${fechaLarga(vuelo.ida_fecha).toUpperCase()}`, X_CAJA_IDA, yCaja, 11, NAVY_TXT)
  escribir(`VUELTA · ${fechaLarga(vuelo.vuelta_fecha).toUpperCase()}`, X_CAJA_VUELTA, yCaja, 11, NAVY_TXT)
  yCaja -= 14
  const hayEscalaIda = vuelo.ida_escala_ciudad || vuelo.ida_escala_codigo
  const hayEscalaVuelta = vuelo.vuelta_escala_ciudad || vuelo.vuelta_escala_codigo
  const altoCajasVuelo = Math.max(altoCajaTramo(hayEscalaIda), altoCajaTramo(hayEscalaVuelta))
  dibujarCajaTramo(page, bebas, {
    x: X_CAJA_IDA, yTop: yCaja, ancho: ANCHO_CAJA,
    codigoSale: vuelo.origen_codigo, ciudadSale: vuelo.origen_ciudad, horaSale: vuelo.ida_sale,
    codigoLlega: vuelo.destino_codigo, ciudadLlega: vuelo.destino_ciudad, horaLlega: vuelo.ida_llega,
    escalaCiudad: vuelo.ida_escala_ciudad, escalaCodigo: vuelo.ida_escala_codigo, escalaLlega: vuelo.ida_escala_llega, escalaSale: vuelo.ida_escala_sale,
  })
  dibujarCajaTramo(page, bebas, {
    x: X_CAJA_VUELTA, yTop: yCaja, ancho: ANCHO_CAJA,
    codigoSale: vuelo.destino_codigo, ciudadSale: vuelo.destino_ciudad, horaSale: vuelo.vuelta_sale,
    codigoLlega: vuelo.origen_codigo, ciudadLlega: vuelo.origen_ciudad, horaLlega: vuelo.vuelta_llega,
    escalaCiudad: vuelo.vuelta_escala_ciudad, escalaCodigo: vuelo.vuelta_escala_codigo, escalaLlega: vuelo.vuelta_escala_llega, escalaSale: vuelo.vuelta_escala_sale,
  })
  const pisoCajas = yCaja - altoCajasVuelo

  // Equipaje: no se mostraba en ningun lado de este PDF — se agrega la misma
  // linea centrada que ya usa la grilla de vuelos, debajo de las cajas. Antes
  // quedaba pegada arriba (10pt fijos bajo la caja) con todo el aire libre
  // amontonado abajo, mas notorio cuanto mas corta la caja (sin escala) — se
  // centra en el espacio real entre el piso de las cajas y la linea horizontal
  // fija de la plantilla (medida sobre el PDF real: y≈499) que separa esta
  // seccion de HOSPEDAJE.
  const SEPARADOR_AEREOS_Y = 499
  const equipajeSeleccionado = ['mochila', 'carryOn', 'valija23', 'extra']
    .filter(k => (vuelo.equipaje?.[k] || 0) > 0)
    .map(k => {
      const cantidad = vuelo.equipaje?.[k] || 0
      const extra = k === 'extra' && vuelo.equipaje?.extraDescripcion?.trim()
      return `${cantidad} ${EQUIPAJE_LABELS[k]}${extra ? `: ${vuelo.equipaje.extraDescripcion.toUpperCase()}` : ''}`
    })
  if (equipajeSeleccionado.length) {
    const textoEquipaje = `EQUIPAJE INCLUIDO: ${equipajeSeleccionado.join(' + ')}`
    let tamanoEquipaje = 10
    while (tamanoEquipaje > 6 && bebas.widthOfTextAtSize(textoEquipaje, tamanoEquipaje) > X_CAJA_VUELTA + ANCHO_CAJA - X_CAJA_IDA) tamanoEquipaje -= 0.5
    const anchoEquipaje = bebas.widthOfTextAtSize(textoEquipaje, tamanoEquipaje)
    const xCentroCajas = (X_CAJA_IDA + X_CAJA_VUELTA + ANCHO_CAJA) / 2
    const yEquipaje = (pisoCajas + SEPARADOR_AEREOS_Y) / 2 - tamanoEquipaje * 0.36
    escribir(textoEquipaje, xCentroCajas - anchoEquipaje / 2, yEquipaje, tamanoEquipaje, NAVY_TXT)
  }

  // Traslados: la plantilla real trae fijo "TRASLADOS PRIVADOS INCLUIDOS" a
  // tamaño 25, igual que AÉREOS — pero al ser una frase larga (no una palabra
  // sola) no entra entera a ese tamaño en la columna disponible. Se redibuja
  // siempre (no solo cuando NO hay traslados) apuntando al mismo tamaño 29
  // que AÉREOS/HOSPEDAJE (ver mas arriba) y se achica solo lo minimo
  // indispensable para entrar en el ancho de la columna — con las frases
  // reales termina en 26 ("...INCLUIDOS") o 24 ("...NO INCLUIDOS"), mucho mas
  // cerca de los otros dos titulos que el 18 fijo que tenia antes.
  // Tapado previo generoso: a tamaño 25-29 el texto original/nuevo es bastante
  // mas ancho que la version chica de antes, y el tapado propio de
  // reemplazarAjustado (ajustado al tamaño final) no llegaba a cubrirlo
  // entero — quedaba asomando la cola. Ancho tope en 260 (no mas: a partir de
  // x=305 empieza la columna real "AEROPUERTO / HOTEL, IN-OUT", que no hay
  // que tocar — pasarse la borra tambien, como paso en un intento anterior).
  tapar(32.66, 278, 260, 38, CREMA_BG)
  // Bajado de y=292 a y=278: a la altura vieja quedaba muy arriba respecto del
  // bloque "AEROPUERTO / HOTEL" + "IN - OUT" de al lado (que ocupa de y=268.87
  // a y=292.87) — asi queda mas centrado verticalmente contra ese bloque.
  reemplazarAjustado(
    propuesta.traslados_incluidos === false ? 'TRASLADOS PRIVADOS NO INCLUIDOS' : 'TRASLADOS PRIVADOS INCLUIDOS',
    32.66, 278, 29, 260, NAVY_TXT, bebas, CREMA_BG, 14
  )
  // "AEROPUERTO / HOTEL" / "IN - OUT" (columna derecha) es texto fijo de la
  // plantilla real, pensado para el caso simple (un solo trayecto). En una
  // propuesta combinada hay un tramo de transfer por cada destino (cargados
  // en la sección "Transfers" del Generador) — se reemplaza ese texto fijo
  // por el detalle real ("- SALIDA / DESTINO" por tramo), mismo formato que
  // ya usa la sección de Aéreos para esto.
  const destinosTraslados = (propuesta.destinos_detalle || []).filter(d => d.salida?.trim() || d.destino?.trim())
  if (propuesta.traslados_incluidos === false) {
    // Mismo tapado alto que el caso de destinos (ver mas abajo): tambien tapa
    // la linea vertical fija de la plantilla, que sin esto quedaba asomando
    // sola arriba y abajo del hueco vacio.
    tapar(295, 265, 280, 78, CREMA_BG)
  } else if (destinosTraslados.length) {
    // Tapado alto (no solo el texto "AEROPUERTO/HOTEL, IN-OUT": tambien la
    // linea vertical fija de la plantilla que separaba esa columna — medido
    // sobre la plantilla real, el bloque completo llega hasta y≈333, no solo
    // hasta donde arranca el texto visible).
    tapar(295, 265, 280, 78, CREMA_BG)
    let yTraslado = 290
    for (const d of destinosTraslados) {
      if (yTraslado < 265) break
      const salida = d.salida?.trim().toUpperCase() || '—'
      const destino = d.destino?.trim().toUpperCase() || '—'
      escribir(`- ${salida} / ${destino}`, 308.5, yTraslado, 10, NAVY_TXT)
      yTraslado -= 13
    }
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
  const fotoHospedajeBytes = await bytesDeImagen(hospedaje.imagen)
  if (fotoHospedajeBytes) {
    try {
      const img = await embedImagenAuto(doc, fotoHospedajeBytes)
      dibujarImagenCover(page, img, fotoHospedaje)
    } catch (_) { /* si falla la imagen, seguimos sin romper el resto */ }
  }
  // Banda "VER ÁREAS EXTERNAS" pegada debajo de la foto general del hospedaje
  // — mismo estilo (navy + texto lima) y mismo criterio que la pagina de
  // Hospedajes de la propuesta inicial, para que ambos PDF queden consistentes
  // (antes esta foto no tenia ningun link propio).
  if (hospedaje.id) {
    const urlExternas = `${SITIO_URL}/hoteles/${hospedaje.id}?standalone=1`
    agregarLink(page, doc, fotoHospedaje, urlExternas)
    const bandaExt = { x: fotoHospedaje.x, y: fotoHospedaje.y - 19, width: fotoHospedaje.width, height: 16 }
    tapar(bandaExt.x - 4, bandaExt.y - 4, bandaExt.width + 8, bandaExt.height + 8, CREMA_BG)
    page.drawRectangle({ ...bandaExt, color: NAVY_BG })
    const textoExt = 'VER ÁREAS EXTERNAS >'
    let tamanoExt = 7.5
    while (tamanoExt > 5.5 && helv.widthOfTextAtSize(textoExt, tamanoExt) > bandaExt.width - 10) tamanoExt -= 0.5
    escribir(textoExt, bandaExt.x + 5, bandaExt.y + (bandaExt.height - tamanoExt) / 2 + 1, tamanoExt, rgb(0xc9 / 255, 0xe3 / 255, 0x4f / 255), helv)
    agregarLink(page, doc, bandaExt, urlExternas)
  }
  // Ancho real disponible antes de la foto de la habitacion (que arranca en
  // x=434) — con 200 (el ancho viejo) el texto largo quedaba pisado por la
  // foto en vez de cortarse antes. "pension" achica letra si hace falta;
  // "habitacion_nombre" puede ser bastante mas largo (nombre real del tipo de
  // cuarto, no una palabra corta), asi que ademas se parte en hasta 2 lineas.
  const ANCHO_COL_HABITACION = 118
  // Tapado previo generoso de toda la columna: la plantilla real trae texto de
  // muestra ahi ("Media Pensión" / "Cuarto Superior") a un tamaño mas grande
  // que el que se usa ahora — el tapado propio de reemplazarAjustado/
  // reemplazarMultilinea (ajustado al tamaño final, mas chico) no llegaba a
  // cubrirlo entero y quedaba asomando arriba.
  // +25 (no +10): quedaba un resto de la plantilla real asomando justo a la
  // derecha del tapado viejo (un caracter suelto tipo comilla/parentesis,
  // visto en un PDF real generado sin foto de habitacion) — el tapado no
  // llegaba a cubrirlo del todo.
  tapar(308.5, 400, ANCHO_COL_HABITACION + 25, 70, CREMA_BG)
  // El boton fijo "VER DETALLES" de la plantilla real (navy, debajo de esta
  // columna de texto) queda tapado — se reemplaza por la banda "VER ÁREAS
  // INTERNAS" debajo de la foto de la habitacion, mismo criterio que "VER
  // ÁREAS EXTERNAS" de arriba.
  tapar(302, 362, 105, 34, CREMA_BG)
  if (hospedaje.pension) {
    reemplazarAjustado(hospedaje.pension, 308.5, 444.1, 18, ANCHO_COL_HABITACION, NAVY_TXT, bebas, CREMA_BG, 10)
  }
  if (hospedaje.habitacion_nombre) {
    reemplazarAjustado(hospedaje.habitacion_nombre.toUpperCase(), 308.5, 414.1, 14, ANCHO_COL_HABITACION, NAVY_TXT, bebas, CREMA_BG, 8)
  }
  // Foto chica de la habitacion elegida (no del hospedaje en general) — pedido
  // explicito del usuario, no existia en la plantilla original. Mismo tamano que
  // la foto del hospedaje (115.7x115.7) y misma altura Y, mas a la derecha —
  // medido sobre una captura real que el usuario marco con un recuadro.
  const fotoHabitacion = { x: 434, y: 366.5, width: 115.7, height: 115.7 }
  const fotoHabitacionBytes = await bytesDeImagen(hospedaje.habitacion_imagen)
  if (fotoHabitacionBytes) {
    try {
      const img = await embedImagenAuto(doc, fotoHabitacionBytes)
      dibujarImagenCover(page, img, fotoHabitacion)
    } catch (_) { /* si falla la imagen, seguimos sin romper el resto */ }
  }
  // Banda "VER ÁREAS INTERNAS": solo si hay una unidad puntual elegida (con o
  // sin foto propia cargada — el link vale igual). Pegada debajo de la foto
  // de la habitacion, mismo patron exacto que "VER ÁREAS EXTERNAS" debajo de
  // la foto del hospedaje (ancho de la banda = ancho de la foto).
  if (hospedaje.id && hospedaje.habitacion_id) {
    const urlInternas = `${SITIO_URL}/hoteles/${hospedaje.id}?habitacion=${hospedaje.habitacion_id}&standalone=1`
    agregarLink(page, doc, fotoHabitacion, urlInternas)
    const bandaInt = { x: fotoHabitacion.x, y: fotoHabitacion.y - 19, width: fotoHabitacion.width, height: 16 }
    tapar(bandaInt.x - 4, bandaInt.y - 4, bandaInt.width + 8, bandaInt.height + 8, CREMA_BG)
    page.drawRectangle({ ...bandaInt, color: NAVY_BG })
    const textoInt = 'VER ÁREAS INTERNAS >'
    let tamanoInt = 7.5
    while (tamanoInt > 5.5 && helv.widthOfTextAtSize(textoInt, tamanoInt) > bandaInt.width - 10) tamanoInt -= 0.5
    escribir(textoInt, bandaInt.x + 5, bandaInt.y + (bandaInt.height - tamanoInt) / 2 + 1, tamanoInt, rgb(0xc9 / 255, 0xe3 / 255, 0x4f / 255), helv)
    agregarLink(page, doc, bandaInt, urlInternas)
  }

  // Link al voucher del hospedaje (cargado en el panel de Documentos) — poco
  // aire libre en esta columna (el botón fijo "VER DETALLES" y la foto de la
  // habitación ya ocupan casi todo), asi que va como texto chico clickeable
  // en vez de un botón navy completo, en el hueco justo debajo de "VER
  // DETALLES" y arriba del separador con la sección de Traslados.
  const linkHospedajeBoton = propuesta.hospedaje_voucher_url || propuesta.hospedaje_link
  if (linkHospedajeBoton) {
    const textoVoucher = 'VER VOUCHER ›'
    const tamanoVoucher = 8
    escribir(textoVoucher, 308.5, 353, tamanoVoucher, NAVY_TXT, helvBold)
    const anchoVoucher = helvBold.widthOfTextAtSize(textoVoucher, tamanoVoucher)
    agregarLink(page, doc, { x: 306, y: 350, width: anchoVoucher + 4, height: tamanoVoucher + 5 }, linkHospedajeBoton)
  }

  // Pie de pago: la plantilla real trae esto en dos columnas con etiquetas y
  // bullets ("saldo pendiente" / "detalle" / "importante" en un recuadro
  // aparte). Se reemplaza por un bloque redactado en prosa, tipo contrato,
  // que destaca primero lo más importante (saldo, vencimiento, total) y
  // despues explica las condiciones de pago en un parrafo, en vez de quedar
  // repartido en varias etiquetas sueltas.
  const moneda = propuesta.moneda || 'ARS'
  // Alto tope en 178 (no mas: "IN - OUT" de la columna de al lado empieza en
  // y=268.87 — con un tapado mas alto el borde de arriba de este rectangulo le
  // pisaba el renglon de abajo a esas letras, medido con el PDF real).
  tapar(28, 85, 540, 178, CREMA_BG)

  // Circulo relleno a la izquierda de un parrafo, alineado con la altura x del
  // texto (no la linea de base) para que quede centrado con el renglón.
  function bullet(x, yTexto, size, pagina = page, escala = 1) {
    pagina.drawEllipse({ x, y: yTexto + size * 0.32, xScale: 1.8 * escala, yScale: 1.8 * escala, color: NAVY_TXT })
  }

  // Checklist con TODO lo que se le resume al cliente en esta segunda propuesta
  // (paquete ya elegido) — mismo contenido que se le manda armado a mano por
  // WhatsApp, pero acá sale directo de los campos reales de la propuesta en
  // vez de tipearse de nuevo. Cada item es un parrafo propio (bullet + texto
  // con los valores en negrita), apilados uno debajo del otro segun las lineas
  // que ocupe cada uno — mismo mecanismo que ya usaba el bloque de pago viejo.
  const totalTxt = `${moneda}$ ${formatearNumero(total)}`
  const saldoTxt = `${moneda}$ ${formatearNumero(saldo)}`
  const senaTxt = `${moneda}$ ${formatearNumero(sena)}`
  const nombreMoneda = moneda === 'ARS' ? 'pesos argentinos' : (moneda === 'BRL' ? 'reales' : moneda)

  const itemsDetalle = []

  // Vuelo: trayecto + fechas + directo/con escala, todo en un mismo renglon.
  const hayEscala = vuelo.ida_escala_ciudad || vuelo.ida_escala_codigo || vuelo.vuelta_escala_ciudad || vuelo.vuelta_escala_codigo
  const trayecto = (vuelo.origen_ciudad || vuelo.destino_ciudad)
    ? `${vuelo.origen_ciudad || '—'} - ${vuelo.destino_ciudad || '—'}`
    : ''
  const fechasVuelo = (vuelo.ida_fecha || vuelo.vuelta_fecha)
    ? `, del ${fechaCorta(vuelo.ida_fecha) || '—'} al ${fechaCorta(vuelo.vuelta_fecha) || '—'}`
    : ''
  if (trayecto) {
    itemsDetalle.push({ segmentos: [
      { texto: 'Vuelos ida y vuelta:' },
      { texto: `${trayecto}${fechasVuelo} (${hayEscala ? 'con escala' : 'ida directa'}).`, bold: true },
    ] })
  }
  // E-ticket del aereo: el link cargado (o, a falta de eso, el PDF subido) —
  // uso interno hasta ahora, se agrega como renglon clickeable (toda la linea
  // es el area del link, no una palabra suelta) para que quede accesible
  // tambien desde el PDF que se descarga.
  const linkAereo = propuesta.aereo_link || propuesta.aereo_pdf_url
  if (linkAereo) {
    itemsDetalle.push({ segmentos: [{ texto: 'E-ticket del vuelo: ver documento.', bold: true }], link: linkAereo })
  }

  // Alojamiento: noches + hospedaje + tipo de habitacion/pension elegidos.
  if (hospedaje.nombre) {
    const nochesTxt = hospedaje.noches ? `${hospedaje.noches} noches` : 'estadía'
    const tipoHabitacion = hospedaje.habitacion_nombre || hospedaje.pension
    itemsDetalle.push({ segmentos: [
      { texto: 'Alojamiento:' },
      { texto: `${nochesTxt} en ${hospedaje.nombre}${tipoHabitacion ? ` (${tipoHabitacion})` : ''}.`, bold: true },
    ] })
  }
  // Voucher del hospedaje: mismo criterio que el e-ticket del aereo.
  const linkHospedaje = propuesta.hospedaje_link || propuesta.hospedaje_voucher_url
  if (linkHospedaje) {
    itemsDetalle.push({ segmentos: [{ texto: 'Voucher del hospedaje: ver documento.', bold: true }], link: linkHospedaje })
  }

  // Traslados: mismo dato (traslados_incluidos) que ya se muestra arriba como
  // titulo de sección, repetido acá como parte del resumen completo.
  itemsDetalle.push({ segmentos: [
    { texto: 'Traslados aeropuerto-hotel (ida y vuelta):' },
    { texto: propuesta.traslados_incluidos === false ? 'no incluidos.' : 'incluidos.', bold: true },
  ] })

  // Seguro de viaje — mismo criterio que traslados_incluidos (decision que se
  // toma al cerrar, default false: no se asume incluido salvo que se marque).
  itemsDetalle.push({ segmentos: [
    { texto: 'Seguro de viaje:' },
    { texto: propuesta.seguro_viaje ? 'incluido.' : 'no incluido.', bold: true },
  ] })

  // Monto total.
  itemsDetalle.push({ segmentos: [
    { texto: 'Monto total del paquete:' },
    { texto: `${totalTxt}.`, bold: true },
  ] })

  // Pago inicial — solo si ya se registro (si no, el saldo de abajo ya es el total).
  if (sena > 0) {
    itemsDetalle.push({ segmentos: [
      { texto: 'Pago inicial (para confirmar la reserva):' },
      { texto: `${senaTxt}.`, bold: true },
    ] })
  }

  // Saldo pendiente + vencimiento + equivalente en reales (si se cargó).
  const segmentoSaldo = [
    propuesta.vencimiento_saldo
      ? { texto: `Saldo pendiente (vencimiento ${fechaCorta(propuesta.vencimiento_saldo)}):` }
      : { texto: 'Saldo pendiente:' },
    { texto: `${saldoTxt}.`, bold: true },
  ]
  if (propuesta.valor_congelado_brl && moneda !== 'BRL') {
    segmentoSaldo.push({ texto: `(equivalente a R$ ${formatearNumero(propuesta.valor_congelado_brl)} valor congelado).` })
  }
  itemsDetalle.push({ segmentos: segmentoSaldo })

  // Opciones para abonar el saldo — texto fijo (politica de pago de la agencia,
  // no un dato por propuesta), pero con la moneda real de esta propuesta.
  itemsDetalle.push({ segmentos: [
    { texto: `Opciones para abonar el saldo: transferencia en ${nombreMoneda}, transferencia mediante PIX, o en cuotas manteniendo el valor en reales congelado al tipo de cambio del día de cada pago.` },
  ] })

  // El detalle completo (checklist de todo lo que el cliente esta comprando)
  // pasa a su propia hoja, con la misma tipografia/tono que "Observaciones
  // importantes" — en la hoja 1 el bloque quedaba muy chico (8.4pt, apretado
  // contra el pie de pagina) para ser la parte mas importante del PDF. Se
  // arma copiando la hoja de Observaciones como base (mismo encabezado navy +
  // logo + pie con el logo de Dream Tours) y se tapan titulo y cuerpo para
  // dibujar el checklist encima, mucho mas grande y con aire real. Se inserta
  // ANTES de Observaciones (que pasa a la pagina 3).
  const [paginaDetalle] = await doc.copyPages(doc, [1])
  doc.insertPage(1, paginaDetalle)

  // Titulo: mismo lugar/tamaño que tenia "OBSERVACIONES IMPORTANTES" en la
  // plantilla real (medido: x 31-304, y 790-811 aprox.) — se tapa sobre fondo
  // navy (no crema, esta parte todavia esta dentro del encabezado) y se
  // reemplaza por un titulo propio.
  paginaDetalle.drawRectangle({ x: 25, y: 782, width: 400, height: 40, color: NAVY_BG })
  paginaDetalle.drawText('DETALLE DE TU PROPUESTA', { x: 31.2, y: 790, size: 26, font: bebas, color: CREMA_TXT })

  // Cuerpo entero: de borde a borde (igual que el resto de los tapados de
  // esta plantilla) entre el pie del encabezado (y≈761) y el techo del pie de
  // pagina (y≈62) — ahi vivia todo el texto fijo de "Observaciones..." de la
  // copia, se borra completo para dibujar el checklist desde cero.
  paginaDetalle.drawRectangle({ x: -5, y: 65, width: 605, height: 693, color: CREMA_BG })

  paginaDetalle.drawText('Esto es lo que tu propuesta incluye:', { x: 31.2, y: 715, size: 20, font: bebas, color: NAVY_TXT })

  // Mismo contenido que antes (itemsDetalle), mas grande y con aire — pero en
  // vez de un espacio FIJO entre items (que con pocos items dejaba media hoja
  // en blanco al pie, y con muchos podia quedar apretado) se mide primero
  // cuanto ocupa el texto de cada item (con `partirEnLineasRico`, sin dibujar) y
  // se reparte TODO el espacio libre de la pagina entre los items — repartido
  // en vez de amontonado, y quedan pocos o muchos items, siempre llena la
  // hoja de la misma manera prolija que "Observaciones importantes".
  const SIZE_ITEM = 14
  const GAP_ITEM = 20
  const X_TEXTO = 46
  const ANCHO_ITEM = 510
  const Y_INICIO = 668
  const Y_MIN = 110
  const GAP_ENTRE_ITEMS_MIN = 14
  const GAP_ENTRE_ITEMS_MAX = 36

  const alturaItems = itemsDetalle.reduce((acc, { segmentos }) => {
    const { lineas } = partirEnLineasRico(segmentos, SIZE_ITEM, ANCHO_ITEM)
    return acc + (lineas.length - 1) * GAP_ITEM + GAP_ITEM
  }, 0)
  const gapEntreItems = itemsDetalle.length > 1
    ? Math.min(GAP_ENTRE_ITEMS_MAX, Math.max(GAP_ENTRE_ITEMS_MIN, (Y_INICIO - Y_MIN - alturaItems) / (itemsDetalle.length - 1)))
    : GAP_ENTRE_ITEMS_MIN

  // Con MUY pocos items (propuesta sin vuelo/hospedaje cargado, caso raro) el
  // gap ya toca el tope de arriba y sobra espacio igual — ese sobrante se
  // reparte mitad arriba/mitad abajo (centrado en el area disponible) en vez
  // de dejarlo todo amontonado al pie de la pagina.
  const alturaTotal = alturaItems + gapEntreItems * Math.max(itemsDetalle.length - 1, 0)
  const espacioLibre = Math.max(0, (Y_INICIO - Y_MIN) - alturaTotal)
  let yItem = Y_INICIO - espacioLibre / 2
  itemsDetalle.forEach(({ segmentos, link }) => {
    bullet(31.2, yItem, SIZE_ITEM, paginaDetalle, 1.5)
    const lineas = dibujarParrafoRico(segmentos, X_TEXTO, yItem, SIZE_ITEM, ANCHO_ITEM, GAP_ITEM, NAVY_TXT, paginaDetalle)
    // Toda la linea (no solo el texto "ver documento") es el area clickeable
    // del link, mismo criterio que el link de "VER DETALLES" del hospedaje.
    if (link) {
      agregarLink(paginaDetalle, doc, { x: 31.2, y: yItem - (lineas - 1) * GAP_ITEM - 4, width: ANCHO_ITEM, height: lineas * GAP_ITEM }, link)
    }
    yItem -= (lineas - 1) * GAP_ITEM + GAP_ITEM + gapEntreItems
  })

  return doc
}
