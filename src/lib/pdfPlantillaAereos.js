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
// DD/MM/AAAA — usada en el encabezado de cada vuelo de la grilla compacta
// ("VUELO 1: IDA 6/01/2026"), mas corta que fechaLarga para que entre en una
// sola linea junto con "VUELO N:".
function fechaCorta(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Path SVG de un rectangulo con esquinas redondeadas, para las cajas de cada
// tramo (ida/vuelta) de la grilla de vuelos — pdf-lib no trae un
// drawRoundedRectangle nativo. `x,y` en drawSvgPath es la esquina
// SUPERIOR IZQUIERDA del path (probado: el alto crece hacia abajo desde ahi).
function pathRectRedondeado(ancho, alto, radio) {
  const r = Math.min(radio, ancho / 2, alto / 2)
  return `M ${r} 0 L ${ancho - r} 0 Q ${ancho} 0 ${ancho} ${r} L ${ancho} ${alto - r} Q ${ancho} ${alto} ${ancho - r} ${alto} L ${r} ${alto} Q 0 ${alto} 0 ${alto - r} L 0 ${r} Q 0 0 ${r} 0 Z`
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
// Mismo limite que "zonaBottom" en la pagina de un solo vuelo (arriba del
// banner "SI TE INTERESA VER LAS ACTIVIDADES..." con la foto, fijo en la
// plantilla) — antes esta grilla usaba 50, que tapaba ese banner con el
// tapar() de mas abajo y en su lugar dibujaba un cartelito chico por vuelo.
// Ahora se deja intacto (no se tapa) y se agrega UN solo link clickeable
// encima, una vez por hoja en vez de un cartel repetido por vuelo.
const ZONA_GRUPO_BOTTOM = 195
const FILAS_VUELO = 4 // tope de vuelos por hoja (no la cantidad real de filas dibujadas, ver mas abajo)
const ALTO_FILA_BASE = (ZONA_GRUPO_TOP - ZONA_GRUPO_BOTTOM) / FILAS_VUELO
const COL_IZQ_X = 44
const COL_DER_X = 320
const ANCHO_COL_VUELO = 245

// Antes la zona se dividia siempre en 4 filas fijas aunque hubiera menos
// vuelos cargados — con 2 vuelos, por ejemplo, quedaban 2 filas enteras en
// blanco (mitad de hoja vacia). Ahora la fila se calcula sobre la cantidad
// REAL de vuelos de esta hoja (grupo.length, hasta 4), asi siempre ocupan
// toda la zona disponible. La escala resultante (>1 con menos de 4 vuelos)
// agranda el texto de dibujarVueloCompacto en la misma proporcion, tapada en
// 2x para que una hoja con 1 solo vuelo residual (ej. un grupo sobrante de 5)
// no quede con letras desproporcionadas.
function crearSlotVuelo(fila, totalEnHoja) {
  const altoFila = (ZONA_GRUPO_TOP - ZONA_GRUPO_BOTTOM) / totalEnHoja
  const top = ZONA_GRUPO_TOP - fila * altoFila
  const escala = Math.min(ALTO_FILA_BASE > 0 ? altoFila / ALTO_FILA_BASE : 1, 2)
  return { top, bottom: top - altoFila, escala }
}

// Tono mas suave que NAVY_TXT para los datos secundarios (sale/llega, escala)
// — asi el titulo IDA/VUELTA con la fecha (el dato que mas importa) queda
// como lo unico "fuerte" de cada columna en vez de que todo pese lo mismo.
const NAVY_SUAVE = rgb(0x3a / 255, 0x55 / 255, 0x64 / 255)

// Una tarjeta de vuelo dentro de su franja: encabezado "VUELO N: IDA
// fecha"/"VUELTA fecha" y, debajo, una caja con borde redondeado por tramo
// (mismo trazo que el resto de "carteles" de la app) con el origen/destino
// unidos por una flecha y la escala centrada abajo si la hay. Equipaje y
// traslados quedan como una sola linea centrada por tarjeta, sin iconos —
// diseño pedido explicitamente para que la grilla se lea como una ficha
// prolija en vez de una lista de texto suelto.
function dibujarVueloCompacto(page, bebas, slot, vuelo, numero) {
  // Con menos de 4 vuelos en la hoja, slot.escala > 1 (ver crearSlotVuelo) —
  // agranda tamaños de letra y espaciados en la misma proporcion para
  // aprovechar el alto real de la franja en vez de dejarlo vacio.
  const esc = slot.escala || 1
  function escribir(texto, x, y, size, color = NAVY_TXT) {
    page.drawText(texto, { x, y, size, font: bebas, color })
  }
  function centrado(texto, xCentro, y, size, color = NAVY_TXT) {
    escribir(texto, xCentro - bebas.widthOfTextAtSize(texto, size) / 2, y, size, color)
  }
  function medirTamanoAjustado(texto, anchoMax, size, tamanoMin = 6.5) {
    let tamano = size * esc
    while (tamano > tamanoMin && bebas.widthOfTextAtSize(texto, tamano) > anchoMax) tamano -= 0.5
    return tamano
  }
  // Flecha horizontal simple (linea + punta) entre el origen y el destino de
  // un tramo, dentro de su caja.
  function dibujarFlecha(x1, x2, y, color) {
    const grosor = Math.max(0.8, 1 * esc)
    const punta = 4 * esc
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: grosor, color })
    page.drawLine({ start: { x: x2, y }, end: { x: x2 - punta, y: y + punta * 0.65 }, thickness: grosor, color })
    page.drawLine({ start: { x: x2, y }, end: { x: x2 - punta, y: y - punta * 0.65 }, thickness: grosor, color })
  }

  // Gap inicial: la fila 0 arranca justo debajo del titulo fijo "AÉREOS:"
  // (con su propio icono de avion, el unico de la hoja).
  let y = slot.top - 14 * esc
  const tamanoTitulo = 13 * esc
  escribir(`VUELO ${numero}: IDA ${fechaCorta(vuelo.ida_fecha)}`, COL_IZQ_X, y, tamanoTitulo, NAVY_TXT)
  escribir(`VUELTA ${fechaCorta(vuelo.vuelta_fecha)}`, COL_DER_X, y, tamanoTitulo, NAVY_TXT)
  y -= 8 * esc

  // Caja por tramo (ida/vuelta): codigo+hora de salida — flecha — codigo+hora
  // de llegada, con la ciudad de cada uno chica debajo, y la escala (si hay)
  // centrada mas abajo. Devuelve el alto que ocupo, asi ida y vuelta pueden
  // quedar con el mismo alto (el mayor de los dos) aunque solo una tenga escala.
  function altoCaja(hayEscala) {
    const sinEscala = 13 * esc + 9 * esc + 9 * esc // padding sup + fila principal + fila ciudad
    return hayEscala ? sinEscala + 8 * esc + 8.5 * esc + 8.5 * esc : sinEscala // + escala (2 lineas) + gap
  }
  function dibujarCaja(x, yTop, alto, { codigoSale, ciudadSale, horaSale, codigoLlega, ciudadLlega, horaLlega, escalaCiudad, escalaCodigo, escalaLlega, escalaSale }) {
    page.drawSvgPath(pathRectRedondeado(ANCHO_COL_VUELO, alto, 6 * esc), { x, y: yTop, borderColor: NAVY_TXT, borderWidth: Math.max(0.75, 1 * esc) })

    const padX = 9 * esc
    let cy = yTop - 13 * esc
    const tamanoCiudad = 6.5 * esc

    const textoIzq = `${codigoSale || '—'}  ${horaSale || '--:--'} HS`
    const textoDer = `${codigoLlega || '—'}  ${horaLlega || '--:--'} HS`
    // Codigo+hora se achica hasta que entren los dos lados MAS la flecha entre
    // medio — a escala 2 (pocos vuelos en la hoja) el tamaño de base sin
    // ajustar no entraba en el ancho fijo de la caja y la flecha terminaba
    // superpuesta con el texto.
    const anchoFlecha = 24 * esc
    const anchoDisponible = ANCHO_COL_VUELO - padX * 2 - anchoFlecha
    let tamanoCodigo = 12 * esc
    while (tamanoCodigo > 7 && (bebas.widthOfTextAtSize(textoIzq, tamanoCodigo) + bebas.widthOfTextAtSize(textoDer, tamanoCodigo)) > anchoDisponible) tamanoCodigo -= 0.5
    const anchoIzq = bebas.widthOfTextAtSize(textoIzq, tamanoCodigo)
    const anchoDer = bebas.widthOfTextAtSize(textoDer, tamanoCodigo)
    escribir(textoIzq, x + padX, cy, tamanoCodigo, NAVY_TXT)
    escribir(textoDer, x + ANCHO_COL_VUELO - padX - anchoDer, cy, tamanoCodigo, NAVY_TXT)
    dibujarFlecha(x + padX + anchoIzq + 6 * esc, x + ANCHO_COL_VUELO - padX - anchoDer - 6 * esc, cy + tamanoCodigo * 0.32, NAVY_TXT)
    cy -= 9 * esc

    if (ciudadSale) escribir(`(${ciudadSale.toUpperCase()})`, x + padX, cy, tamanoCiudad, NAVY_SUAVE)
    if (ciudadLlega) {
      const anchoCiudadDer = bebas.widthOfTextAtSize(`(${ciudadLlega.toUpperCase()})`, tamanoCiudad)
      escribir(`(${ciudadLlega.toUpperCase()})`, x + ANCHO_COL_VUELO - padX - anchoCiudadDer, cy, tamanoCiudad, NAVY_SUAVE)
    }
    cy -= 9 * esc

    if (escalaCiudad || escalaCodigo) {
      cy -= 8 * esc
      const xCentro = x + ANCHO_COL_VUELO / 2
      const codigo = escalaCodigo?.toUpperCase()
      centrado(`ESCALA ${escalaCiudad?.toUpperCase() || ''}${codigo ? ` (${codigo})` : ''}`, xCentro, cy, 7.5 * esc, NAVY_SUAVE)
      cy -= 8.5 * esc
      if (escalaLlega || escalaSale) {
        centrado(`${escalaLlega || '--:--'} - ${escalaSale || '--:--'}`, xCentro, cy, 7.5 * esc, NAVY_SUAVE)
      }
    }
  }

  const hayEscalaIda = vuelo.ida_escala_ciudad || vuelo.ida_escala_codigo
  const hayEscalaVuelta = vuelo.vuelta_escala_ciudad || vuelo.vuelta_escala_codigo
  const altoCajas = Math.max(altoCaja(hayEscalaIda), altoCaja(hayEscalaVuelta))

  dibujarCaja(COL_IZQ_X, y, altoCajas, {
    codigoSale: vuelo.origen_codigo, ciudadSale: vuelo.origen_ciudad, horaSale: vuelo.ida_sale,
    codigoLlega: vuelo.destino_codigo, ciudadLlega: vuelo.destino_ciudad, horaLlega: vuelo.ida_llega,
    escalaCiudad: vuelo.ida_escala_ciudad, escalaCodigo: vuelo.ida_escala_codigo, escalaLlega: vuelo.ida_escala_llega, escalaSale: vuelo.ida_escala_sale,
  })
  dibujarCaja(COL_DER_X, y, altoCajas, {
    codigoSale: vuelo.destino_codigo, ciudadSale: vuelo.destino_ciudad, horaSale: vuelo.vuelta_sale,
    codigoLlega: vuelo.origen_codigo, ciudadLlega: vuelo.origen_ciudad, horaLlega: vuelo.vuelta_llega,
    escalaCiudad: vuelo.vuelta_escala_ciudad, escalaCodigo: vuelo.vuelta_escala_codigo, escalaLlega: vuelo.vuelta_escala_llega, escalaSale: vuelo.vuelta_escala_sale,
  })
  y -= altoCajas + 10 * esc

  // Equipaje y traslados: una sola linea centrada por dato (no una por
  // columna), sin icono — el detalle vive en la caja de arriba.
  const equipajeSeleccionado = ['mochila', 'carryOn', 'valija23', 'extra']
    .filter(k => (vuelo.equipaje?.[k] || 0) > 0)
    .map(k => {
      const cantidad = vuelo.equipaje?.[k] || 0
      const extra = k === 'extra' && vuelo.equipaje?.extraDescripcion?.trim()
      return `${cantidad} ${EQUIPAJE_LABELS[k]}${extra ? `: ${vuelo.equipaje.extraDescripcion.toUpperCase()}` : ''}`
    })
  const xCentroHoja = (COL_IZQ_X + COL_DER_X + ANCHO_COL_VUELO) / 2
  if (equipajeSeleccionado.length) {
    const texto = `EQUIPAJE INCLUIDO: ${equipajeSeleccionado.join(' + ')}`
    centrado(texto, xCentroHoja, y, medirTamanoAjustado(texto, 515, 9.5), NAVY_TXT)
    y -= 12 * esc
  }
  if (vuelo.traslado_ida || vuelo.traslado_vuelta) {
    const texto = vuelo.traslado_ida && vuelo.traslado_vuelta
      ? 'TRASLADOS PRIVADOS INCLUIDOS: AEROPUERTO / HOTEL (IN - OUT)'
      : vuelo.traslado_ida
        ? 'TRASLADO PRIVADO INCLUIDO: AEROPUERTO / HOTEL (IN)'
        : 'TRASLADO PRIVADO INCLUIDO: HOTEL / AEROPUERTO (OUT)'
    centrado(texto, xCentroHoja, y, medirTamanoAjustado(texto, 515, 9.5), NAVY_TXT)
    y -= 12 * esc
  }

  // El cartel de actividades (con foto, "SI TE INTERESA VER LAS
  // ACTIVIDADES...") no se repite por vuelo — queda uno solo, fijo en la
  // plantilla al pie de la hoja, con su link agregado en
  // dibujarPaginaAereosGrupo (ver agregarLinkBanner mas abajo).

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
  const textoCotiz = `COTIZACIÓN PERSONALIZADA PARA: ${textoPasajeros(cantidadAdultos, cantidadMenores, edadesMenores)}`
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
  // el encabezado y el resto. El icono de la plantilla es un vector fijo que
  // no se puede reubicar sin el asset original — pero SI se puede recrear: se
  // recorto como PNG aparte (public/icono-avion.png, mismo trazo) y se
  // redibuja al lado del titulo en su nueva posicion.
  page.drawRectangle({ x: 17, y: 598, width: 300, height: 34, color: CREMA_BG })
  let iconoAvionHeader = null
  try {
    const avionHeaderBytes = await fetch('/icono-avion.png').then(r => r.arrayBuffer())
    iconoAvionHeader = await doc.embedPng(avionHeaderBytes)
  } catch (_) { /* si falla, el titulo queda sin icono en vez de romper el PDF */ }
  const tituloY = LIMITE_NUEVO - 51.5
  let tituloX = 63
  if (iconoAvionHeader) {
    const alto = 26
    const ancho = alto * (iconoAvionHeader.width / iconoAvionHeader.height)
    page.drawImage(iconoAvionHeader, { x: 17, y: tituloY - 5, width: ancho, height: alto })
    tituloX = 17 + ancho + 10
  }
  escribir('AÉREOS:', tituloX, tituloY, 30, NAVY_TXT)

  // Limpia de una sola vez toda la zona dinamica (incluido el banner fijo de
  // la plantilla de un solo vuelo, que acá no aplica) antes de dibujar las
  // filas — de borde a borde por la misma razon que el punto 2: el pie de
  // pagina fijo tambien es de borde a borde.
  page.drawRectangle({ x: -5, y: ZONA_GRUPO_BOTTOM, width: PAGINA_ANCHO + 10, height: ZONA_GRUPO_TOP - ZONA_GRUPO_BOTTOM, color: CREMA_BG })

  const totalEnHoja = Math.min(grupo.length, FILAS_VUELO)
  for (let i = 0; i < totalEnHoja; i++) {
    dibujarVueloCompacto(page, bebas, crearSlotVuelo(i, totalEnHoja), grupo[i], i + 1)
  }

  // Cartel de actividades: uno solo por hoja (no uno por vuelo), fijo en la
  // plantilla con su foto — se le agrega el link del primer vuelo del grupo
  // que tenga uno cargado, mismo criterio que la pagina de un solo vuelo.
  const vueloConBanner = grupo.slice(0, totalEnHoja).find(v => v.banner_link)
  if (vueloConBanner) {
    agregarLinkBanner(page, doc, vueloConBanner.banner_link)
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
