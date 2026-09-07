import { PDFDocument, rgb, PDFName, PDFArray, PDFString } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

// Convierte un rectangulo cualquiera de la pagina en un area clickeable que
// abre `url` — mismo mecanismo que en pdfPlantillaHospedajes.js/Cierre.js.
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

// Recuadro fijo del banner "SI TE INTERESA VER LAS ACTIVIDADES..." de la
// pagina de UN solo vuelo (coordenadas medidas en la referencia real).
function agregarLinkBanner(page, doc, url) {
  agregarLink(page, doc, { x: 140, y: 85, width: 315, height: 81 }, url)
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

// Todas las coordenadas vienen de leer el PDF de referencia real con pdfjs-dist
// (texto embebido, no una imagen) — son puntos PDF exactos, no aproximaciones.
// Dibuja UNA pagina de Aereos completa (un solo vuelo) ya insertada en `doc`
// (la deja lista para guardar) — usada solo cuando la propuesta tiene un
// unico vuelo; con 2 o mas se usa la grilla compacta mas abajo.
async function dibujarPaginaAereos(doc, page, bebas, { clienteNombre, cantidadAdultos, cantidadMenores, edadesMenores, vuelo }) {
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
  // Calcula a que tamaño hay que achicar el texto para que entre en anchoMax, sin
  // dibujar nada — se usa para IDA y VUELTA por separado y despues quedarse con el
  // menor de los dos, asi ambas columnas quedan siempre al mismo tamaño de letra.
  function medirTamanoAjustado(texto, anchoMax, size, tamanoMin = 14) {
    let tamano = size
    while (tamano > tamanoMin && bebas.widthOfTextAtSize(texto, tamano) > anchoMax) tamano -= 1
    return tamano
  }
  // Dibuja ya con un tamaño decidido de antemano (a diferencia de la version vieja,
  // que decidia su propio tamaño por su cuenta — por eso ida y vuelta terminaban
  // con letras de tamaños distintos, cada una achicandose de forma independiente).
  // No tapa nada antes de escribir: la zona entera ya se limpio una sola vez mas
  // arriba, asi que un tapar() extra aca era redundante — y ese rectangulo de mas
  // era justo lo que terminaba pisando el borde inferior del icono de VUELTA.
  function reemplazarLineaTamano({ x, y, texto, size, color }) {
    escribir(texto, x, y, size, color)
  }

  // Iconos: la plantilla real los trae fijos en su posicion vieja (traslados,
  // ida/vuelta) — como el orden cambia, no alcanza con dejarlos donde estaban.
  // Se recortaron de la plantilla real como imagen chica y se reubican junto al
  // contenido que corresponde en el nuevo orden. El de equipaje (maleta) no hace
  // falta tocarlo: esta pegado al encabezado, que no se mueve ni se tapa.
  const iconAutoBytes = await fetch('/icono-auto.png').then(r => r.arrayBuffer())
  const iconCalendarioBytes = await fetch('/icono-calendario.png').then(r => r.arrayBuffer())
  const iconAuto = await doc.embedPng(iconAutoBytes)
  // Se incrusta DOS VECES (ida/vuelta) en vez de reusar el mismo objeto embebido:
  // algunos visores de PDF cachean el bitmap rasterizado por XObject y, al
  // repetir la misma imagen en dos posiciones no alineadas al pixel, el segundo
  // dibujo salia recortado (bug de render, no del PDF en si).
  const iconCalendarioIda = await doc.embedPng(iconCalendarioBytes)
  const iconCalendarioVuelta = await doc.embedPng(iconCalendarioBytes)
  // Antes 19.3 — medido en un render real, el icono de equipaje (fijo en la
  // plantilla, no lo dibujamos nosotros) mide ~28pt de diametro, mientras que
  // estos se dibujaban mas chicos. Se agranda para que los 3 iconos midan igual.
  const ICON_SIZE = 28
  const ICON_X_IZQ = 44 // columna izquierda (equipaje, traslados, ida)
  const ICON_X_DER = 364.5 // columna derecha (vuelta) — mismo offset que "vuelta:" respecto a "ida:" en la referencia real
  function dibujarIcono(img, cx, cy) {
    page.drawImage(img, { x: cx - ICON_SIZE / 2, y: cy - ICON_SIZE / 2, width: ICON_SIZE, height: ICON_SIZE })
  }

  // Nombre del cliente y cantidad de pasajeros (fondo navy)
  reemplazarLinea({ x: 31.38, y: 730.82, anchoMax: 220, alto: 26, texto: clienteNombre.toUpperCase(), size: 20, color: CREMA_TXT, bg: NAVY_BG })
  reemplazarLinea({ x: 31.36, y: 681.22, anchoMax: 220, alto: 26, texto: textoPasajeros(cantidadAdultos, cantidadMenores, edadesMenores), size: 20, color: CREMA_TXT, bg: NAVY_BG })

  // Orden pedido: 1) equipaje (igual que antes) 2) vuelo ida/vuelta 3) traslados
  // (antes iba equipaje / traslados / vuelo). Como el orden cambia completo, en
  // vez de tapar franja por franja tapamos TODA la zona dinamica de una sola vez
  // y volvemos a dibujar todo — incluidos los iconos, que en la referencia estan
  // fijos en sus posiciones viejas y quedarian mal ubicados si no se reubican.
  const equipajeSeleccionado = ['mochila', 'carryOn', 'valija23', 'extra']
    .filter(k => (vuelo.equipaje?.[k] || 0) > 0)
    .map(k => {
      const cantidad = vuelo.equipaje?.[k] || 0
      const extra = k === 'extra' && vuelo.equipaje?.extraDescripcion?.trim()
      return `- ${cantidad} ${EQUIPAJE_LABELS[k]}${extra ? `: ${vuelo.equipaje.extraDescripcion.toUpperCase()}` : ''}`
    })

  const REF_EQUIPAJE_TOP = 525.42 // y de la primera linea de equipaje (sin cambios)
  const GAP_LINEA = 24
  const MARGEN_INFERIOR = 15 // aire minimo entre el ultimo renglon y el banner de abajo

  const zonaTop = REF_EQUIPAJE_TOP + 22
  const zonaBottom = 195 // arriba del banner de actividades, que es fijo
  tapar(20, zonaBottom, 550, zonaTop - zonaBottom, CREMA_BG)

  // Cuantos renglones tiene cada seccion (para repartir el aire entre ellas de
  // forma pareja y que el bloque completo use todo el recuadro disponible, en
  // vez de quedar amontonado arriba con un espacio muerto abajo).
  const hayEscalaIda = vuelo.ida_escala_ciudad || vuelo.ida_escala_codigo
  const hayEscalaVuelta = vuelo.vuelta_escala_ciudad || vuelo.vuelta_escala_codigo
  const nEquipaje = equipajeSeleccionado.length
  const nVuelo = 3 + (hayEscalaIda || hayEscalaVuelta ? 1 : 0) // titulo + sale + llega [+ escala]
  const hayTraslados = vuelo.traslado_ida || vuelo.traslado_vuelta
  const nTraslados = hayTraslados ? 3 : 0

  const secciones = [nEquipaje, nVuelo, nTraslados].filter(n => n > 0)
  const totalLineas = secciones.reduce((a, b) => a + b, 0)
  const targetUltimaBaseline = zonaBottom + MARGEN_INFERIOR
  const GAP_SECCION = secciones.length > 1
    ? Math.max(20, ((REF_EQUIPAJE_TOP - targetUltimaBaseline) - (totalLineas - secciones.length) * GAP_LINEA) / (secciones.length - 1))
    : 20

  // 1) Equipaje — misma posicion de siempre. El icono maleta esta pegado al
  // encabezado "EQUIPAJE INCLUIDO:", que queda arriba de la zona que tapamos, asi
  // que el icono original sigue ahi solo (no hace falta redibujarlo).
  let y = REF_EQUIPAJE_TOP
  for (const linea of equipajeSeleccionado) {
    escribir(linea, 61.19, y, 20, NAVY_TXT)
    y -= GAP_LINEA
  }
  // Y de la ULTIMA linea de equipaje realmente dibujada (no una de mas) — asi el
  // aire hasta el titulo IDA queda igual que el aire entre vuelo y traslados.
  const finEquipaje = REF_EQUIPAJE_TOP - Math.max(nEquipaje - 1, 0) * GAP_LINEA

  // 2) Vuelo ida/vuelta — mismas columnas X que antes (izquierda/derecha), ahora
  // arrancando debajo del equipaje. Icono calendario en cada columna.
  const yVuelo = finEquipaje - GAP_SECCION
  dibujarIcono(iconCalendarioIda, ICON_X_IZQ, yVuelo)
  dibujarIcono(iconCalendarioVuelta, ICON_X_DER, yVuelo)
  escribir(`IDA: ${fechaLarga(vuelo.ida_fecha)}`, 61.19, yVuelo, 25, NAVY_TXT)
  escribir(`VUELTA: ${fechaLarga(vuelo.vuelta_fecha)}`, 381.70, yVuelo, 25, NAVY_TXT)

  const textoIdaSale = `SALE DE ${vuelo.origen_ciudad?.toUpperCase() || ''} (${vuelo.origen_codigo?.toUpperCase() || ''}) ${vuelo.ida_sale || ''} HS`
  const textoVueltaSale = `SALE DE ${vuelo.destino_ciudad?.toUpperCase() || ''} (${vuelo.destino_codigo?.toUpperCase() || ''}) ${vuelo.vuelta_sale || ''} HS`
  const tamanoSale = Math.min(medirTamanoAjustado(textoIdaSale, 292, 20), medirTamanoAjustado(textoVueltaSale, 180, 20))
  const ySale = yVuelo - GAP_LINEA
  reemplazarLineaTamano({ x: 61.19, y: ySale, anchoMax: 292, alto: 24, texto: textoIdaSale, size: tamanoSale, color: NAVY_TXT, bg: CREMA_BG })
  reemplazarLineaTamano({ x: 381.70, y: ySale, anchoMax: 180, alto: 24, texto: textoVueltaSale, size: tamanoSale, color: NAVY_TXT, bg: CREMA_BG })

  const textoIdaLlega = `LLEGA A ${vuelo.destino_ciudad?.toUpperCase() || ''} (${vuelo.destino_codigo?.toUpperCase() || ''}) ${vuelo.ida_llega || ''} HS`
  const textoVueltaLlega = `LLEGA A ${vuelo.origen_ciudad?.toUpperCase() || ''} (${vuelo.origen_codigo?.toUpperCase() || ''}) ${vuelo.vuelta_llega || ''} HS`
  const tamanoLlega = Math.min(medirTamanoAjustado(textoIdaLlega, 292, 20), medirTamanoAjustado(textoVueltaLlega, 180, 20))
  const yLlega = ySale - GAP_LINEA
  reemplazarLineaTamano({ x: 61.19, y: yLlega, anchoMax: 292, alto: 24, texto: textoIdaLlega, size: tamanoLlega, color: NAVY_TXT, bg: CREMA_BG })
  reemplazarLineaTamano({ x: 381.70, y: yLlega, anchoMax: 180, alto: 24, texto: textoVueltaLlega, size: tamanoLlega, color: NAVY_TXT, bg: CREMA_BG })

  if (hayEscalaIda || hayEscalaVuelta) {
    const yEscala = yLlega - GAP_LINEA
    let textoIdaEscala = '', textoVueltaEscala = ''
    if (hayEscalaIda) {
      const codigoEscala = vuelo.ida_escala_codigo?.toUpperCase()
      const horaEscala = (vuelo.ida_escala_llega || vuelo.ida_escala_sale) ? ` ${vuelo.ida_escala_llega || '--:--'}-${vuelo.ida_escala_sale || '--:--'} HS` : ''
      textoIdaEscala = `ESCALA EN ${vuelo.ida_escala_ciudad?.toUpperCase() || ''}${codigoEscala ? ` (${codigoEscala})` : ''}${horaEscala}`
    }
    if (hayEscalaVuelta) {
      const codigoEscala = vuelo.vuelta_escala_codigo?.toUpperCase()
      const horaEscala = (vuelo.vuelta_escala_llega || vuelo.vuelta_escala_sale) ? ` ${vuelo.vuelta_escala_llega || '--:--'}-${vuelo.vuelta_escala_sale || '--:--'} HS` : ''
      textoVueltaEscala = `ESCALA EN ${vuelo.vuelta_escala_ciudad?.toUpperCase() || ''}${codigoEscala ? ` (${codigoEscala})` : ''}${horaEscala}`
    }
    const tamanosEscala = []
    if (hayEscalaIda) tamanosEscala.push(medirTamanoAjustado(textoIdaEscala, 292, 20))
    if (hayEscalaVuelta) tamanosEscala.push(medirTamanoAjustado(textoVueltaEscala, 180, 20))
    const tamanoEscala = Math.min(...tamanosEscala)
    if (hayEscalaIda) reemplazarLineaTamano({ x: 61.19, y: yEscala, anchoMax: 292, alto: 24, texto: textoIdaEscala, size: tamanoEscala, color: NAVY_TXT, bg: CREMA_BG })
    if (hayEscalaVuelta) reemplazarLineaTamano({ x: 381.70, y: yEscala, anchoMax: 180, alto: 24, texto: textoVueltaEscala, size: tamanoEscala, color: NAVY_TXT, bg: CREMA_BG })
  }
  const lineasVuelo = 2 + (hayEscalaIda || hayEscalaVuelta ? 1 : 0)
  const finVuelo = yVuelo - lineasVuelo * GAP_LINEA

  // 3) Traslados — ahora al final, icono auto reubicado.
  const yTraslados = finVuelo - GAP_SECCION
  if (vuelo.traslado_ida && vuelo.traslado_vuelta) {
    dibujarIcono(iconAuto, ICON_X_IZQ, yTraslados)
    escribir('TRASLADOS PRIVADOS INCLUIDOS:', 61.19, yTraslados, 25, NAVY_TXT)
    escribir('AEROPUERTO / HOTEL', 61.19, yTraslados - 24, 20, NAVY_TXT)
    escribir('IN - OUT', 61.19, yTraslados - 48, 20, NAVY_TXT)
  } else if (vuelo.traslado_ida) {
    dibujarIcono(iconAuto, ICON_X_IZQ, yTraslados)
    escribir('TRASLADO PRIVADO INCLUIDO:', 61.19, yTraslados, 25, NAVY_TXT)
    escribir('AEROPUERTO / HOTEL', 61.19, yTraslados - 24, 20, NAVY_TXT)
    escribir('IN', 61.19, yTraslados - 48, 20, NAVY_TXT)
  } else if (vuelo.traslado_vuelta) {
    dibujarIcono(iconAuto, ICON_X_IZQ, yTraslados)
    escribir('TRASLADO PRIVADO INCLUIDO:', 61.19, yTraslados, 25, NAVY_TXT)
    escribir('HOTEL / AEROPUERTO', 61.19, yTraslados - 24, 20, NAVY_TXT)
    escribir('OUT', 61.19, yTraslados - 48, 20, NAVY_TXT)
  }

  // Recuadro "SI TE INTERESA VER LAS ACTIVIDADES..." clickeable, si el vuelo tiene
  // un link de actividades cargado en el formulario.
  if (vuelo.banner_link) {
    agregarLinkBanner(page, doc, vuelo.banner_link)
  }
}

// Primer vuelo de la propuesta: arma el documento entero desde la plantilla
// real (pagina de Aereos + una de hospedaje de muestra, que se descarta) y
// devuelve `doc` ya con esa primera pagina dibujada — mismo comportamiento de
// siempre para propuesta simple (un solo vuelo).
export async function generarPaginaAereosPDF({ clienteNombre, cantidadAdultos, cantidadMenores, edadesMenores, vuelo }) {
  const plantillaBytes = await fetch('/plantilla-aereos.pdf').then(r => r.arrayBuffer())
  const doc = await PDFDocument.load(plantillaBytes)
  doc.registerFontkit(fontkit)

  // Nos quedamos solo con la pagina 1 (Aereos); la 2 era el hospedaje de muestra del template.
  while (doc.getPageCount() > 1) doc.removePage(1)
  const page = doc.getPage(0)

  const fontBytes = await fetch('/fonts/BebasNeue-Regular.ttf').then(r => r.arrayBuffer())
  const bebas = await doc.embedFont(fontBytes)

  await dibujarPaginaAereos(doc, page, bebas, { clienteNombre, cantidadAdultos, cantidadMenores, edadesMenores, vuelo })

  return doc
}

// ── Grilla compacta: 2 o mas vuelos en la misma hoja ────────────────────────
// Igual que con hospedajes, no hay plantilla real de referencia para "varios
// vuelos por hoja" (la referencia es para UNO completo) — se calculan filas
// iguales dentro de la misma zona de contenido dinamico que antes ocupaba un
// solo vuelo (equipaje+vuelo+traslados+banner). Se usa SOLO cuando hay 2 o
// mas vuelos; con uno solo se sigue usando la pagina completa de arriba, que
// ya esta bien aprovechada.
const ZONA_GRUPO_TOP = 648 // debajo del titulo "AÉREOS:" (redibujado mas arriba al achicar el encabezado, ver dibujarPaginaAereosGrupo)
const ZONA_GRUPO_BOTTOM = 50 // medido en el PDF real: el pie de pagina fijo empieza en y=34 — 50 deja margen de sobra sin arriesgar a tocarlo
const FILAS_VUELO = 4
const ALTO_FILA_VUELO = (ZONA_GRUPO_TOP - ZONA_GRUPO_BOTTOM) / FILAS_VUELO
const COL_IZQ_X = 44
const COL_DER_X = 320
const ANCHO_COL_VUELO = 245

function crearSlotVuelo(fila) {
  const top = ZONA_GRUPO_TOP - fila * ALTO_FILA_VUELO
  return { top, bottom: top - ALTO_FILA_VUELO }
}

// Una tarjeta de vuelo dentro de su franja — mismos datos que la pagina
// completa (fechas, horarios, escalas, equipaje, traslados, banner de
// actividades) pero en lineas mas chicas, una debajo de otra en vez de
// repartidas con iconos grandes.
function dibujarVueloCompacto(doc, page, bebas, slot, vuelo, numero) {
  function escribir(texto, x, y, size, color = NAVY_TXT) {
    page.drawText(texto, { x, y, size, font: bebas, color })
  }
  function medirTamanoAjustado(texto, anchoMax, size, tamanoMin = 6.5) {
    let tamano = size
    while (tamano > tamanoMin && bebas.widthOfTextAtSize(texto, tamano) > anchoMax) tamano -= 0.5
    return tamano
  }

  let y = slot.top - 4
  escribir(`VUELO ${numero}`, COL_IZQ_X, y, 10, NAVY_TXT)
  y -= 14

  const hayEscalaIda = vuelo.ida_escala_ciudad || vuelo.ida_escala_codigo
  const hayEscalaVuelta = vuelo.vuelta_escala_ciudad || vuelo.vuelta_escala_codigo

  escribir(`IDA: ${fechaLarga(vuelo.ida_fecha)}`, COL_IZQ_X, y, 12.5, NAVY_TXT)
  escribir(`VUELTA: ${fechaLarga(vuelo.vuelta_fecha)}`, COL_DER_X, y, 12.5, NAVY_TXT)
  y -= 12.5

  const textoIdaSale = `SALE DE ${vuelo.origen_ciudad?.toUpperCase() || ''} (${vuelo.origen_codigo?.toUpperCase() || ''}) ${vuelo.ida_sale || ''} HS`
  const textoVueltaSale = `SALE DE ${vuelo.destino_ciudad?.toUpperCase() || ''} (${vuelo.destino_codigo?.toUpperCase() || ''}) ${vuelo.vuelta_sale || ''} HS`
  const tamanoSale = Math.min(medirTamanoAjustado(textoIdaSale, ANCHO_COL_VUELO, 9), medirTamanoAjustado(textoVueltaSale, ANCHO_COL_VUELO, 9))
  escribir(textoIdaSale, COL_IZQ_X, y, tamanoSale, NAVY_TXT)
  escribir(textoVueltaSale, COL_DER_X, y, tamanoSale, NAVY_TXT)
  y -= 11

  const textoIdaLlega = `LLEGA A ${vuelo.destino_ciudad?.toUpperCase() || ''} (${vuelo.destino_codigo?.toUpperCase() || ''}) ${vuelo.ida_llega || ''} HS`
  const textoVueltaLlega = `LLEGA A ${vuelo.origen_ciudad?.toUpperCase() || ''} (${vuelo.origen_codigo?.toUpperCase() || ''}) ${vuelo.vuelta_llega || ''} HS`
  const tamanoLlega = Math.min(medirTamanoAjustado(textoIdaLlega, ANCHO_COL_VUELO, 9), medirTamanoAjustado(textoVueltaLlega, ANCHO_COL_VUELO, 9))
  escribir(textoIdaLlega, COL_IZQ_X, y, tamanoLlega, NAVY_TXT)
  escribir(textoVueltaLlega, COL_DER_X, y, tamanoLlega, NAVY_TXT)
  y -= 11

  if (hayEscalaIda || hayEscalaVuelta) {
    let textoIdaEscala = '', textoVueltaEscala = ''
    if (hayEscalaIda) {
      const codigoEscala = vuelo.ida_escala_codigo?.toUpperCase()
      const horaEscala = (vuelo.ida_escala_llega || vuelo.ida_escala_sale) ? ` ${vuelo.ida_escala_llega || '--:--'}-${vuelo.ida_escala_sale || '--:--'} HS` : ''
      textoIdaEscala = `ESCALA ${vuelo.ida_escala_ciudad?.toUpperCase() || ''}${codigoEscala ? ` (${codigoEscala})` : ''}${horaEscala}`
    }
    if (hayEscalaVuelta) {
      const codigoEscala = vuelo.vuelta_escala_codigo?.toUpperCase()
      const horaEscala = (vuelo.vuelta_escala_llega || vuelo.vuelta_escala_sale) ? ` ${vuelo.vuelta_escala_llega || '--:--'}-${vuelo.vuelta_escala_sale || '--:--'} HS` : ''
      textoVueltaEscala = `ESCALA ${vuelo.vuelta_escala_ciudad?.toUpperCase() || ''}${codigoEscala ? ` (${codigoEscala})` : ''}${horaEscala}`
    }
    const tamanosEscala = []
    if (hayEscalaIda) tamanosEscala.push(medirTamanoAjustado(textoIdaEscala, ANCHO_COL_VUELO, 8))
    if (hayEscalaVuelta) tamanosEscala.push(medirTamanoAjustado(textoVueltaEscala, ANCHO_COL_VUELO, 8))
    const tamanoEscala = Math.min(...tamanosEscala)
    if (hayEscalaIda) escribir(textoIdaEscala, COL_IZQ_X, y, tamanoEscala, NAVY_TXT)
    if (hayEscalaVuelta) escribir(textoVueltaEscala, COL_DER_X, y, tamanoEscala, NAVY_TXT)
    y -= 10.5
  }

  y -= 4

  const equipajeSeleccionado = ['mochila', 'carryOn', 'valija23', 'extra']
    .filter(k => (vuelo.equipaje?.[k] || 0) > 0)
    .map(k => {
      const cantidad = vuelo.equipaje?.[k] || 0
      const extra = k === 'extra' && vuelo.equipaje?.extraDescripcion?.trim()
      return `${cantidad} ${EQUIPAJE_LABELS[k]}${extra ? `: ${vuelo.equipaje.extraDescripcion.toUpperCase()}` : ''}`
    })
  if (equipajeSeleccionado.length) {
    const texto = `EQUIPAJE: ${equipajeSeleccionado.join(' · ')}`
    escribir(texto, COL_IZQ_X, y, medirTamanoAjustado(texto, 515, 9), NAVY_TXT)
    y -= 11
  }

  if (vuelo.traslado_ida || vuelo.traslado_vuelta) {
    const texto = vuelo.traslado_ida && vuelo.traslado_vuelta
      ? 'TRASLADOS PRIVADOS INCLUIDOS: AEROPUERTO / HOTEL (IN - OUT)'
      : vuelo.traslado_ida
        ? 'TRASLADO PRIVADO INCLUIDO: AEROPUERTO / HOTEL (IN)'
        : 'TRASLADO PRIVADO INCLUIDO: HOTEL / AEROPUERTO (OUT)'
    escribir(texto, COL_IZQ_X, y, medirTamanoAjustado(texto, 515, 9), NAVY_TXT)
    y -= 11
  }

  // Cartel de actividades: siempre presente si el vuelo tiene link cargado
  // (todos lo traen por defecto, el catalogo general) — como boton navy con
  // texto lima, igual que el resto de los carteles clickeables de la app, no
  // como una linea de texto suelta que se pierde entre el resto de la
  // informacion de la tarjeta compacta.
  if (vuelo.banner_link) {
    const destino = vuelo.banner_destino?.trim() || vuelo.destino_ciudad?.trim() || 'destino'
    const texto = `VER ACTIVIDADES EN ${destino.toUpperCase()} >`
    const tamano = medirTamanoAjustado(texto, 495, 9)
    const ancho = bebas.widthOfTextAtSize(texto, tamano)
    const alto = 16
    const pillBottom = y - 11
    const rectBanner = { x: COL_IZQ_X - 6, y: pillBottom, width: ancho + 16, height: alto }
    page.drawRectangle({ ...rectBanner, color: NAVY_BG })
    escribir(texto, COL_IZQ_X + 2, pillBottom + 4.5, tamano, rgb(0xc9 / 255, 0xe3 / 255, 0x4f / 255))
    agregarLink(page, doc, rectBanner, vuelo.banner_link)
  }

  // Separador fino entre vuelos, apoyado en el piso de la franja.
  page.drawLine({ start: { x: 30, y: slot.bottom + 8 }, end: { x: 565, y: slot.bottom + 8 }, thickness: 0.5, color: rgb(0.85, 0.83, 0.78) })
}

async function dibujarPaginaAereosGrupo(page, bebas, doc, { clienteNombre, cantidadAdultos, cantidadMenores, edadesMenores, grupo }) {
  function escribir(texto, x, y, size, color) {
    page.drawText(texto, { x, y, size, font: bebas, color })
  }

  // Encabezado compacto — SOLO en esta grilla (la pagina de un solo vuelo no
  // se toca). "PAQUETE DE VIAJE" queda igual; "Nombre del cliente" y
  // "Cotización personalizada para" (que en la plantilla real son 2 renglones
  // cada uno, etiqueta + valor) se funden en 1 renglon cada uno — mismo dato,
  // menos alto. Limite navy/crema medido en el PDF real: y=665 antes, y=703
  // ahora (38pt menos de azul).
  //
  // OJO con el ANCHO de cada rectangulo, que es donde estaba el bug real:
  // - Las franjas de fondo (navy y crema) de la plantilla van de BORDE A
  //   BORDE de la hoja (x=0 a 595.276, sin el margen de 17-20pt que usa el
  //   resto del contenido) — un rectangulo mas angosto que eso deja una tira
  //   del color viejo pegada al borde, que es justo el "recuadro" que se veia
  //   flotando arriba (y el mismo problema iba a pasar abajo, contra el pie
  //   de pagina, con el tapar() de la zona de vuelos de mas abajo).
  // - El texto en cambio SI tiene que quedar angosto: el logo (swirl) esta
  //   fijo en la plantilla a la derecha de esta misma franja — si el
  //   rectangulo para borrar el texto viejo es de borde a borde, tapa el
  //   logo tambien. Se limita a un ancho seguro y el texto se achica si hace
  //   falta para no pasarse de ahi.
  const PAGINA_ANCHO = 595.276
  const LIMITE_NUEVO = 703
  const ANCHO_TEXTO_HEADER = 420 // hasta aca llega el texto como mucho — el logo esta mas a la derecha
  function medirAjustado(texto, anchoMax, size, minimo = 10) {
    let t = size
    while (t > minimo && bebas.widthOfTextAtSize(texto, t) > anchoMax) t -= 0.5
    return t
  }

  const textoNombre = `NOMBRE DEL CLIENTE: ${clienteNombre.toUpperCase()}`
  const textoCotiz = `COTIZACIÓN PARA: ${textoPasajeros(cantidadAdultos, cantidadMenores, edadesMenores)}`
  const sizeNombre = medirAjustado(textoNombre, ANCHO_TEXTO_HEADER, 15)
  const sizeCotiz = medirAjustado(textoCotiz, ANCHO_TEXTO_HEADER, 15)

  // 1) Repinta navy SOLO donde vivia el texto viejo (angosto, no toca el logo).
  page.drawRectangle({ x: 17, y: 665, width: ANCHO_TEXTO_HEADER + 20, height: 110, color: NAVY_BG })
  escribir(textoNombre, 31.38, 748, sizeNombre, CREMA_TXT)
  escribir(textoCotiz, 31.38, 720, sizeCotiz, CREMA_TXT)
  // 2) Convierte a crema la franja que se le saca al azul — esta si de borde
  //    a borde, porque ahi (por debajo de donde vive el logo) es solo fondo.
  page.drawRectangle({ x: -5, y: 665, width: PAGINA_ANCHO + 10, height: LIMITE_NUEVO - 665, color: CREMA_BG })

  // "AÉREOS:" (con su icono de avion, fijos en la plantilla) sube la misma
  // distancia que se le achico al azul, para no dejar un hueco vacio entre
  // el encabezado y el resto — se redibuja sin el icono (vector propio de la
  // plantilla, no hay forma de reubicarlo sin el asset original).
  page.drawRectangle({ x: 17, y: 598, width: 300, height: 34, color: CREMA_BG })
  escribir('AÉREOS:', 63, LIMITE_NUEVO - 51.5, 30, NAVY_TXT)

  // Limpia de una sola vez toda la zona dinamica (incluido el banner fijo de
  // la plantilla de un solo vuelo, que acá no aplica) antes de dibujar las
  // filas — de borde a borde por la misma razon que el punto 2: el pie de
  // pagina fijo tambien es de borde a borde.
  page.drawRectangle({ x: -5, y: ZONA_GRUPO_BOTTOM, width: PAGINA_ANCHO + 10, height: ZONA_GRUPO_TOP - ZONA_GRUPO_BOTTOM, color: CREMA_BG })

  for (let i = 0; i < grupo.length && i < FILAS_VUELO; i++) {
    dibujarVueloCompacto(doc, page, bebas, crearSlotVuelo(i), grupo[i], i + 1)
  }
}

// Primer grupo (hasta 4 vuelos) de una propuesta con 2 o mas vuelos: arma el
// documento entero, igual que generarPaginaAereosPDF pero con la grilla.
export async function generarPaginaAereosGrupoPDF({ clienteNombre, cantidadAdultos, cantidadMenores, edadesMenores, vuelos }) {
  const plantillaBytes = await fetch('/plantilla-aereos.pdf').then(r => r.arrayBuffer())
  const doc = await PDFDocument.load(plantillaBytes)
  doc.registerFontkit(fontkit)
  while (doc.getPageCount() > 1) doc.removePage(1)
  const page = doc.getPage(0)

  const fontBytes = await fetch('/fonts/BebasNeue-Regular.ttf').then(r => r.arrayBuffer())
  const bebas = await doc.embedFont(fontBytes)

  await dibujarPaginaAereosGrupo(page, bebas, doc, { clienteNombre, cantidadAdultos, cantidadMenores, edadesMenores, grupo: vuelos.slice(0, FILAS_VUELO) })

  return { doc, bebas }
}

// Grupos siguientes (mas de 4 vuelos en la misma propuesta) — caso raro, pero
// se soporta con el mismo patron de agregar-pagina que el resto de la app.
export async function agregarPaginaAereosGrupo(doc, plantillaDoc, bebas, { clienteNombre, cantidadAdultos, cantidadMenores, edadesMenores, vuelos }) {
  const [pagina] = await doc.copyPages(plantillaDoc, [0])
  doc.addPage(pagina)
  await dibujarPaginaAereosGrupo(pagina, bebas, doc, { clienteNombre, cantidadAdultos, cantidadMenores, edadesMenores, grupo: vuelos.slice(0, FILAS_VUELO) })
}
