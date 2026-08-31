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
export async function generarPaginaAereosPDF({ clienteNombre, cantidadAdultos, cantidadMenores, edadesMenores, vuelo }) {
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
    escribir(linea, 56.07, y, 20, NAVY_TXT)
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
    escribir('TRASLADOS PRIVADOS INCLUIDOS:', 59.90, yTraslados, 25, NAVY_TXT)
    escribir('AEROPUERTO / HOTEL', 59.90, yTraslados - 24, 20, NAVY_TXT)
    escribir('IN - OUT', 59.90, yTraslados - 48, 20, NAVY_TXT)
  } else if (vuelo.traslado_ida) {
    dibujarIcono(iconAuto, ICON_X_IZQ, yTraslados)
    escribir('TRASLADO PRIVADO INCLUIDO:', 59.90, yTraslados, 25, NAVY_TXT)
    escribir('AEROPUERTO / HOTEL', 59.90, yTraslados - 24, 20, NAVY_TXT)
    escribir('IN', 59.90, yTraslados - 48, 20, NAVY_TXT)
  } else if (vuelo.traslado_vuelta) {
    dibujarIcono(iconAuto, ICON_X_IZQ, yTraslados)
    escribir('TRASLADO PRIVADO INCLUIDO:', 59.90, yTraslados, 25, NAVY_TXT)
    escribir('HOTEL / AEROPUERTO', 59.90, yTraslados - 24, 20, NAVY_TXT)
    escribir('OUT', 59.90, yTraslados - 48, 20, NAVY_TXT)
  }

  // Recuadro "SI TE INTERESA VER LAS ACTIVIDADES..." clickeable, si el vuelo tiene
  // un link de actividades cargado en el formulario.
  if (vuelo.banner_link) {
    agregarLinkBanner(page, doc, vuelo.banner_link)
  }

  return doc
}
