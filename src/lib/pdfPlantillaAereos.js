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

function formatearNumero(n) {
  return Number(n || 0).toLocaleString('es-AR')
}

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
function fechaLarga(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} de ${MESES_LARGOS[m - 1]}`.toUpperCase()
}
// DD/MM/AAAA — usada en el encabezado de cada vuelo de la grilla compacta
// ("VUELO 1: IDA 6/01/2026"), mas corta que fechaLarga para que entre en una
// sola linea junto con "VUELO N:".
export function fechaCorta(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Path SVG de un rectangulo con esquinas redondeadas, para las cajas de cada
// tramo (ida/vuelta) de la grilla de vuelos — pdf-lib no trae un
// drawRoundedRectangle nativo. `x,y` en drawSvgPath es la esquina
// SUPERIOR IZQUIERDA del path (probado: el alto crece hacia abajo desde ahi).
export function pathRectRedondeado(ancho, alto, radio) {
  const r = Math.min(radio, ancho / 2, alto / 2)
  return `M ${r} 0 L ${ancho - r} 0 Q ${ancho} 0 ${ancho} ${r} L ${ancho} ${alto - r} Q ${ancho} ${alto} ${ancho - r} ${alto} L ${r} ${alto} Q 0 ${alto} 0 ${alto - r} L 0 ${r} Q 0 0 ${r} 0 Z`
}

// Tono mas suave que NAVY_TXT para los datos secundarios de la caja de tramo
// (ciudad, escala) — exportado junto con la caja para que otros PDF que la
// reusen (ej. el de cierre) mantengan el mismo contraste tipografico.
export const NAVY_SUAVE_CAJA = rgb(0x3a / 255, 0x55 / 255, 0x64 / 255)

// Alto que ocupa una caja de tramo (ida o vuelta) — se calcula aparte de
// dibujarCajaTramo porque ida y vuelta suelen dibujarse con el mismo alto
// (el mayor de los dos) aunque solo una tenga escala, asi quedan simetricas.
export function altoCajaTramo(hayEscala, esc = 1) {
  const sinEscala = 13 * esc + 9 * esc + 9 * esc // padding sup + fila principal + fila ciudad
  return hayEscala ? sinEscala + 8 * esc + 8.5 * esc + 8.5 * esc : sinEscala // + escala (2 lineas) + gap
}

// Caja con borde redondeado de un tramo (ida o vuelta): codigo+hora de salida
// — flecha — codigo+hora de llegada, con la ciudad de cada uno chica debajo,
// y la escala (si hay) centrada mas abajo. Mismo diseño reusado en la grilla
// de vuelos (2+ en una hoja) y en el PDF de cierre (un unico vuelo) — antes
// el de cierre traia un diseño viejo (pildoras amarillas de la plantilla
// real) que no combinaba con el de la propuesta inicial.
export function dibujarCajaTramo(page, bebas, { x, yTop, ancho, esc = 1, codigoSale, ciudadSale, horaSale, codigoLlega, ciudadLlega, horaLlega, escalaCiudad, escalaCodigo, escalaLlega, escalaSale, colorPrincipal = NAVY_TXT, colorSuave = NAVY_SUAVE_CAJA }) {
  function escribir(texto, tx, ty, size, color) {
    page.drawText(texto, { x: tx, y: ty, size, font: bebas, color })
  }
  function centrado(texto, xCentro, ty, size, color) {
    escribir(texto, xCentro - bebas.widthOfTextAtSize(texto, size) / 2, ty, size, color)
  }
  function dibujarFlecha(x1, x2, fy, color) {
    const grosor = Math.max(0.8, 1 * esc)
    const punta = 4 * esc
    page.drawLine({ start: { x: x1, y: fy }, end: { x: x2, y: fy }, thickness: grosor, color })
    page.drawLine({ start: { x: x2, y: fy }, end: { x: x2 - punta, y: fy + punta * 0.65 }, thickness: grosor, color })
    page.drawLine({ start: { x: x2, y: fy }, end: { x: x2 - punta, y: fy - punta * 0.65 }, thickness: grosor, color })
  }

  const hayEscala = escalaCiudad || escalaCodigo
  const alto = altoCajaTramo(hayEscala, esc)
  page.drawSvgPath(pathRectRedondeado(ancho, alto, 6 * esc), { x, y: yTop, borderColor: colorPrincipal, borderWidth: Math.max(0.75, 1 * esc) })

  const padX = 9 * esc
  let cy = yTop - 13 * esc
  const tamanoCiudad = 6.5 * esc

  const textoIzq = `${codigoSale || '—'}  ${horaSale || '--:--'} HS`
  const textoDer = `${codigoLlega || '—'}  ${horaLlega || '--:--'} HS`
  // Codigo+hora se achica hasta que entren los dos lados MAS la flecha entre
  // medio — a escala grande el tamaño de base sin ajustar no entraba en el
  // ancho fijo de la caja y la flecha terminaba superpuesta con el texto.
  const anchoFlecha = 24 * esc
  const anchoDisponible = ancho - padX * 2 - anchoFlecha
  let tamanoCodigo = 12 * esc
  while (tamanoCodigo > 7 && (bebas.widthOfTextAtSize(textoIzq, tamanoCodigo) + bebas.widthOfTextAtSize(textoDer, tamanoCodigo)) > anchoDisponible) tamanoCodigo -= 0.5
  const anchoIzq = bebas.widthOfTextAtSize(textoIzq, tamanoCodigo)
  const anchoDer = bebas.widthOfTextAtSize(textoDer, tamanoCodigo)
  escribir(textoIzq, x + padX, cy, tamanoCodigo, colorPrincipal)
  escribir(textoDer, x + ancho - padX - anchoDer, cy, tamanoCodigo, colorPrincipal)
  dibujarFlecha(x + padX + anchoIzq + 6 * esc, x + ancho - padX - anchoDer - 6 * esc, cy + tamanoCodigo * 0.32, colorPrincipal)
  cy -= 9 * esc

  if (ciudadSale) escribir(`(${ciudadSale.toUpperCase()})`, x + padX, cy, tamanoCiudad, colorSuave)
  if (ciudadLlega) {
    const anchoCiudadDer = bebas.widthOfTextAtSize(`(${ciudadLlega.toUpperCase()})`, tamanoCiudad)
    escribir(`(${ciudadLlega.toUpperCase()})`, x + ancho - padX - anchoCiudadDer, cy, tamanoCiudad, colorSuave)
  }
  cy -= 9 * esc

  if (hayEscala) {
    cy -= 8 * esc
    const xCentro = x + ancho / 2
    const codigo = escalaCodigo?.toUpperCase()
    centrado(`ESCALA ${escalaCiudad?.toUpperCase() || ''}${codigo ? ` (${codigo})` : ''}`, xCentro, cy, 7.5 * esc, colorSuave)
    cy -= 8.5 * esc
    if (escalaLlega || escalaSale) {
      centrado(`${escalaLlega || '--:--'} - ${escalaSale || '--:--'}`, xCentro, cy, 7.5 * esc, colorSuave)
    }
  }

  return alto
}

export const EQUIPAJE_LABELS = {
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
async function dibujarPaginaAereos(doc, page, bebas, { clienteNombre, cantidadAdultos, cantidadMenores, edadesMenores, vuelo, destinos, moneda }) {
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

  // Iconos: la plantilla real los trae fijos en su posicion vieja (equipaje,
  // traslados, ida/vuelta) — como el orden cambia y ahora todo el bloque se
  // centra como una unidad (ver mas abajo), ninguno se puede dejar en su
  // posicion original. Se recortaron de la plantilla real como imagen chica y
  // se reubican junto al contenido que corresponde en cada caso.
  const iconAutoBytes = await fetch('/icono-auto.png').then(r => r.arrayBuffer())
  const iconMaletaBytes = await fetch('/icono-maleta.png').then(r => r.arrayBuffer())
  const iconCalendarioBytes = await fetch('/icono-calendario.png').then(r => r.arrayBuffer())
  const iconAuto = await doc.embedPng(iconAutoBytes)
  const iconMaleta = await doc.embedPng(iconMaletaBytes)
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

  // Nombre del cliente y cantidad de pasajeros — la plantilla real trae esto en
  // 2 renglones cada uno (etiqueta arriba, valor abajo: "NOMBRE DEL CLIENTE:" /
  // "BELKIS", "COTIZACIÓN PERSONALIZADA PARA:" / "2 ADULTOS"). Se funden en 1
  // renglon cada uno — mismo criterio que ya usa la pagina de grilla
  // (dibujarPaginaAereosGrupo) para 2+ vuelos, asi ambas quedan con el mismo
  // estilo de encabezado en vez de que solo la de 1 vuelo quede partida en 4
  // renglones. No se toca nada por debajo de y=665: ahi ya empieza la zona
  // crema fija de "AÉREOS:" para abajo.
  const ANCHO_TEXTO_HEADER = 420 // hasta aca como mucho — el logo (swirl) esta mas a la derecha, fijo en la plantilla
  function medirAjustadoHeader(texto, anchoMax, size, minimo = 12) {
    let t = size
    while (t > minimo && bebas.widthOfTextAtSize(texto, t) > anchoMax) t -= 0.5
    return t
  }
  const textoNombreCliente = `NOMBRE DEL CLIENTE: ${clienteNombre.toUpperCase()}`
  const textoCotizacion = `COTIZACIÓN PERSONALIZADA PARA: ${textoPasajeros(cantidadAdultos, cantidadMenores, edadesMenores)}`
  const sizeNombreCliente = medirAjustadoHeader(textoNombreCliente, ANCHO_TEXTO_HEADER, 20)
  const sizeCotizacion = medirAjustadoHeader(textoCotizacion, ANCHO_TEXTO_HEADER, 20)
  // Borra los 4 renglones originales de una sola vez (borde angosto, no de
  // pagina completa: mas a la derecha en esta misma franja vive el logo fijo).
  page.drawRectangle({ x: 17, y: 665, width: ANCHO_TEXTO_HEADER + 20, height: 110, color: NAVY_BG })
  escribir(textoNombreCliente, 31.38, 742.8, sizeNombreCliente, CREMA_TXT)
  escribir(textoCotizacion, 31.36, 693.2, sizeCotizacion, CREMA_TXT)

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

  const GAP_LINEA = 24
  // Fijo, no estirado: separa cada bloque (equipaje/vuelo/traslados/destinos)
  // de forma pareja sin importar cuanto contenido haya. Antes GAP_SECCION se
  // calculaba para que el bloque completo llegara siempre hasta el banner de
  // abajo — con poco contenido (ej. sin escala, sin muchos items de equipaje)
  // esos huecos se estiraban mucho, dejando "EQUIPAJE INCLUIDO:" pegado
  // arriba (fijo) y todo lo demas desparramado con aire de sobra entre medio
  // en vez de leerse como un solo bloque prolijo.
  const GAP_SECCION = 32
  // Limites para centrar el bloque ENTERO (titulo "EQUIPAJE INCLUIDO:" +
  // icono incluidos, ya no quedan fijos) entre "AÉREOS:" arriba y el banner
  // de actividades abajo. Estos dos valores son el caso limite (bloque tan
  // alto que no queda aire para centrar, ej. con escala + varios destinos):
  // arrancaria en ZONA_CENTRO_TOP sin margen. Con menos contenido, el bloque
  // se desliza hacia abajo hasta quedar centrado de verdad.
  const ZONA_CENTRO_TOP = 585
  const ZONA_CENTRO_BOTTOM = 185
  tapar(20, 180, 550, 600 - 180, CREMA_BG)

  // Cuantos renglones tiene cada seccion (para calcular el alto total del
  // bloque y centrarlo — ya no para estirar el aire entre secciones).
  const hayEscalaIda = vuelo.ida_escala_ciudad || vuelo.ida_escala_codigo
  const hayEscalaVuelta = vuelo.vuelta_escala_ciudad || vuelo.vuelta_escala_codigo
  const nEquipaje = equipajeSeleccionado.length
  const nEquipajeTotal = 1 + nEquipaje // titulo "EQUIPAJE INCLUIDO:" (ahora dinamico) + items
  const nVuelo = 3 + (hayEscalaIda || hayEscalaVuelta ? 1 : 0) // titulo + sale + llega [+ escala]
  const hayTraslados = vuelo.traslado_ida || vuelo.traslado_vuelta
  const nTraslados = hayTraslados ? 3 : 0
  // Transfers de una propuesta combinada (traslados por tramo, cargados aparte
  // de los vuelos en la seccion "Transfers" del Generador) — se guardaban en
  // la base pero nunca llegaban al PDF. Titulo + una linea por transfer.
  const destinosValidos = (destinos || []).filter(d => d.salida?.trim() || d.destino?.trim())
  const nDestinos = destinosValidos.length ? 1 + destinosValidos.length : 0

  const secciones = [nEquipajeTotal, nVuelo, nTraslados, nDestinos].filter(n => n > 0)
  const totalLineas = secciones.reduce((a, b) => a + b, 0)
  const totalDrop = (totalLineas - secciones.length) * GAP_LINEA + (secciones.length - 1) * GAP_SECCION
  const margenCentrado = Math.max(0, (ZONA_CENTRO_TOP - ZONA_CENTRO_BOTTOM - totalDrop) / 2)
  const primerBaseline = ZONA_CENTRO_TOP - margenCentrado

  // 1) Equipaje — titulo + icono ahora dinamicos (antes quedaban fijos en su
  // posicion original de la plantilla), arrancan en el primer renglon del
  // bloque ya centrado.
  let y = primerBaseline
  dibujarIcono(iconMaleta, ICON_X_IZQ, y)
  escribir('EQUIPAJE INCLUIDO:', 61.19, y, 25, NAVY_TXT)
  for (const linea of equipajeSeleccionado) {
    y -= GAP_LINEA
    escribir(linea, 61.19, y, 20, NAVY_TXT)
  }
  const finEquipaje = y

  // 2) Vuelo ida/vuelta — mismas columnas X que antes (izquierda/derecha), ahora
  // arrancando debajo del equipaje. Icono calendario en cada columna.
  const yVuelo = finEquipaje - GAP_SECCION
  dibujarIcono(iconCalendarioIda, ICON_X_IZQ, yVuelo)
  dibujarIcono(iconCalendarioVuelta, ICON_X_DER, yVuelo)
  const textoIdaTitulo = `IDA: ${fechaLarga(vuelo.ida_fecha)}`
  escribir(textoIdaTitulo, 61.19, yVuelo, 25, NAVY_TXT)
  escribir(`VUELTA: ${fechaLarga(vuelo.vuelta_fecha)}`, 381.70, yVuelo, 25, NAVY_TXT)
  // Valor de venta del vuelo — al lado de "IDA:", en el aire libre antes de
  // que arranque "VUELTA:". Respeta "Pública" (venta_publica false = uso
  // interno, no se imprime), mismo criterio que en la grilla de 2+ vuelos.
  if (vuelo.venta && vuelo.venta_publica !== false) {
    const anchoIdaTitulo = bebas.widthOfTextAtSize(textoIdaTitulo, 25)
    const xPrecio = 61.19 + anchoIdaTitulo + 14
    const anchoDisponiblePrecio = 381.70 - xPrecio - 10
    const textoPrecio = `${moneda || 'ARS'}$ ${formatearNumero(vuelo.venta)}`
    const tamanoPrecio = medirTamanoAjustado(textoPrecio, anchoDisponiblePrecio, 20)
    escribir(textoPrecio, xPrecio, yVuelo, tamanoPrecio, NAVY_TXT)
  }

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
  if (hayTraslados) {
    const textoTitTraslados = (vuelo.traslado_ida && vuelo.traslado_vuelta) ? 'TRASLADOS PRIVADOS INCLUIDOS:' : 'TRASLADO PRIVADO INCLUIDO:'
    dibujarIcono(iconAuto, ICON_X_IZQ, yTraslados)
    escribir(textoTitTraslados, 61.19, yTraslados, 25, NAVY_TXT)
    // Valor de venta del traslado propio del vuelo (no el de Destinos, que es
    // para combinada) — mismo criterio que el resto de los precios: respeta
    // "Pública", va al lado del titulo.
    if (vuelo.traslado_venta && vuelo.traslado_venta_publica !== false) {
      const anchoTitTraslados = bebas.widthOfTextAtSize(textoTitTraslados, 25)
      escribir(`${moneda || 'ARS'}$ ${formatearNumero(vuelo.traslado_venta)}`, 61.19 + anchoTitTraslados + 14, yTraslados, 25, NAVY_TXT)
    }
    if (vuelo.traslado_ida && vuelo.traslado_vuelta) {
      escribir('AEROPUERTO / HOTEL', 61.19, yTraslados - 24, 20, NAVY_TXT)
      escribir('IN - OUT', 61.19, yTraslados - 48, 20, NAVY_TXT)
    } else if (vuelo.traslado_ida) {
      escribir('AEROPUERTO / HOTEL', 61.19, yTraslados - 24, 20, NAVY_TXT)
      escribir('IN', 61.19, yTraslados - 48, 20, NAVY_TXT)
    } else {
      escribir('HOTEL / AEROPUERTO', 61.19, yTraslados - 24, 20, NAVY_TXT)
      escribir('OUT', 61.19, yTraslados - 48, 20, NAVY_TXT)
    }
  }
  const finTraslados = hayTraslados ? yTraslados - 2 * GAP_LINEA : yTraslados

  // 4) Transfers de la propuesta combinada (destinos/traslados por tramo).
  if (destinosValidos.length) {
    const yDestinos = hayTraslados ? finTraslados - GAP_SECCION : yTraslados
    const textoTitTraslados = 'TRASLADOS PRIVADOS:'
    escribir(textoTitTraslados, 61.19, yDestinos, 25, NAVY_TXT)
    // Precio: suma de "Valor de venta" de todos los tramos (Destinos), no uno
    // por tramo — pedido explicito ("TRASLADOS: $X" como un solo total).
    // Respeta la "Pública" de cada tramo (valor_cliente_traslado_publica).
    const totalTraslados = destinosValidos.reduce((suma, d) =>
      suma + (d.valor_cliente_traslado_publica !== false ? (parseFloat(d.valor_cliente_traslado) || 0) : 0), 0)
    if (totalTraslados > 0) {
      const anchoTitTraslados = bebas.widthOfTextAtSize(textoTitTraslados, 25)
      escribir(`${moneda || 'ARS'}$ ${formatearNumero(totalTraslados)}`, 61.19 + anchoTitTraslados + 14, yDestinos, 25, NAVY_TXT)
    }
    destinosValidos.forEach((d, i) => {
      const salida = d.salida?.trim().toUpperCase() || '—'
      const destino = d.destino?.trim().toUpperCase() || '—'
      escribir(`${salida} / ${destino}`, 61.19, yDestinos - (i + 1) * GAP_LINEA, 20, NAVY_TXT)
    })
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
export async function generarPaginaAereosPDF({ clienteNombre, cantidadAdultos, cantidadMenores, edadesMenores, vuelo, destinos, moneda }) {
  const plantillaBytes = await fetch('/plantilla-aereos.pdf').then(r => r.arrayBuffer())
  const doc = await PDFDocument.load(plantillaBytes)
  doc.registerFontkit(fontkit)

  // Nos quedamos solo con la pagina 1 (Aereos); la 2 era el hospedaje de muestra del template.
  while (doc.getPageCount() > 1) doc.removePage(1)
  const page = doc.getPage(0)

  const fontBytes = await fetch('/fonts/BebasNeue-Regular.ttf').then(r => r.arrayBuffer())
  const bebas = await doc.embedFont(fontBytes)

  await dibujarPaginaAereos(doc, page, bebas, { clienteNombre, cantidadAdultos, cantidadMenores, edadesMenores, vuelo, destinos, moneda })

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
function crearSlotVuelo(fila, totalEnHoja, zonaBottom = ZONA_GRUPO_BOTTOM) {
  const altoFila = (ZONA_GRUPO_TOP - zonaBottom) / totalEnHoja
  const top = ZONA_GRUPO_TOP - fila * altoFila
  // Tope en 1.5 (antes 1.75, originalmente 2): con pocos vuelos en la hoja
  // (1-2) la tarjeta seguia quedando grande — segundo pedido de achicarla un
  // poco mas.
  const escala = Math.min(ALTO_FILA_BASE > 0 ? altoFila / ALTO_FILA_BASE : 1, 1.5)
  return { top, bottom: top - altoFila, escala }
}

// Una tarjeta de vuelo dentro de su franja: encabezado "VUELO N: IDA
// fecha"/"VUELTA fecha" y, debajo, una caja con borde redondeado por tramo
// (mismo trazo que el resto de "carteles" de la app) con el origen/destino
// unidos por una flecha y la escala centrada abajo si la hay. Equipaje y
// traslados quedan como una sola linea centrada por tarjeta, sin iconos —
// diseño pedido explicitamente para que la grilla se lea como una ficha
// prolija en vez de una lista de texto suelto.
function dibujarVueloCompacto(page, bebas, slot, vuelo, numero, moneda) {
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

  // Gap inicial: la fila 0 arranca justo debajo del titulo fijo "AÉREOS:"
  // (con su propio icono de avion, el unico de la hoja).
  let y = slot.top - 14 * esc
  const tamanoTitulo = 13 * esc
  const textoTituloIda = `VUELO ${numero}: IDA ${fechaCorta(vuelo.ida_fecha)}`
  const textoTituloVuelta = `VUELTA ${fechaCorta(vuelo.vuelta_fecha)}`
  escribir(textoTituloIda, COL_IZQ_X, y, tamanoTitulo, NAVY_TXT)
  escribir(textoTituloVuelta, COL_DER_X, y, tamanoTitulo, NAVY_TXT)
  // Valor de venta del vuelo — pildora navy con texto blanco (mismo trazo que
  // el resto de los carteles de la app), alineada al borde derecho de la
  // columna de VUELTA (el mismo borde que la caja de abajo), no pegada al
  // texto "VUELTA fecha".
  if (vuelo.venta && vuelo.venta_publica !== false) {
    const anchoTituloVuelta = bebas.widthOfTextAtSize(textoTituloVuelta, tamanoTitulo)
    const xLimiteIzq = COL_DER_X + anchoTituloVuelta + 10 * esc
    const xRightPill = COL_DER_X + ANCHO_COL_VUELO
    const anchoDisponiblePrecio = xRightPill - xLimiteIzq - 16 * esc // menos el padding horizontal de la pildora
    if (anchoDisponiblePrecio > 20) {
      const textoPrecio = `${moneda || 'ARS'}$ ${formatearNumero(vuelo.venta)}`
      const tamanoPrecio = medirTamanoAjustado(textoPrecio, anchoDisponiblePrecio, 13)
      const anchoTexto = bebas.widthOfTextAtSize(textoPrecio, tamanoPrecio)
      const padX = 8 * esc
      const padY = 4 * esc
      const anchoPill = anchoTexto + padX * 2
      const altoPill = tamanoPrecio + padY * 2
      const xPill = xRightPill - anchoPill
      const yTopPill = y + tamanoPrecio * 0.78 + padY
      page.drawSvgPath(pathRectRedondeado(anchoPill, altoPill, 4 * esc), { x: xPill, y: yTopPill, color: NAVY_BG })
      escribir(textoPrecio, xPill + padX, y, tamanoPrecio, rgb(1, 1, 1))
    }
  }
  y -= 8 * esc

  // Caja por tramo (ida/vuelta) con borde redondeado, flecha y escala — ver
  // dibujarCajaTramo/altoCajaTramo mas arriba (compartidas con el PDF de
  // cierre, mismo diseño en los dos lugares).
  const hayEscalaIda = vuelo.ida_escala_ciudad || vuelo.ida_escala_codigo
  const hayEscalaVuelta = vuelo.vuelta_escala_ciudad || vuelo.vuelta_escala_codigo
  const altoCajas = Math.max(altoCajaTramo(hayEscalaIda, esc), altoCajaTramo(hayEscalaVuelta, esc))

  dibujarCajaTramo(page, bebas, {
    x: COL_IZQ_X, yTop: y, ancho: ANCHO_COL_VUELO, esc,
    codigoSale: vuelo.origen_codigo, ciudadSale: vuelo.origen_ciudad, horaSale: vuelo.ida_sale,
    codigoLlega: vuelo.destino_codigo, ciudadLlega: vuelo.destino_ciudad, horaLlega: vuelo.ida_llega,
    escalaCiudad: vuelo.ida_escala_ciudad, escalaCodigo: vuelo.ida_escala_codigo, escalaLlega: vuelo.ida_escala_llega, escalaSale: vuelo.ida_escala_sale,
  })
  dibujarCajaTramo(page, bebas, {
    x: COL_DER_X, yTop: y, ancho: ANCHO_COL_VUELO, esc,
    codigoSale: vuelo.destino_codigo, ciudadSale: vuelo.destino_ciudad, horaSale: vuelo.vuelta_sale,
    codigoLlega: vuelo.origen_codigo, ciudadLlega: vuelo.origen_ciudad, horaLlega: vuelo.vuelta_llega,
    escalaCiudad: vuelo.vuelta_escala_ciudad, escalaCodigo: vuelo.vuelta_escala_codigo, escalaLlega: vuelo.vuelta_escala_llega, escalaSale: vuelo.vuelta_escala_sale,
  })
  y -= altoCajas + 10 * esc

  // Equipaje y traslados: una sola linea centrada por dato (no una por
  // columna), sin icono — el detalle vive en la caja de arriba. El bloque
  // (1 o 2 lineas) se centra VERTICAL y horizontalmente en el espacio libre
  // entre el piso de las cajas y el separador de abajo — antes quedaba
  // pegado arriba (10pt fijos bajo la caja), con todo el aire libre
  // amontonado abajo cuando el vuelo no tenia traslado propio cargado.
  const equipajeSeleccionado = ['mochila', 'carryOn', 'valija23', 'extra']
    .filter(k => (vuelo.equipaje?.[k] || 0) > 0)
    .map(k => {
      const cantidad = vuelo.equipaje?.[k] || 0
      const extra = k === 'extra' && vuelo.equipaje?.extraDescripcion?.trim()
      return `${cantidad} ${EQUIPAJE_LABELS[k]}${extra ? `: ${vuelo.equipaje.extraDescripcion.toUpperCase()}` : ''}`
    })
  const xCentroHoja = (COL_IZQ_X + COL_DER_X + ANCHO_COL_VUELO) / 2
  const lineasInfo = []
  if (equipajeSeleccionado.length) lineasInfo.push(`EQUIPAJE INCLUIDO: ${equipajeSeleccionado.join(' + ')}`)
  if (vuelo.traslado_ida || vuelo.traslado_vuelta) {
    const textoTraslado = vuelo.traslado_ida && vuelo.traslado_vuelta
      ? 'TRASLADOS PRIVADOS INCLUIDOS: AEROPUERTO / HOTEL (IN - OUT)'
      : vuelo.traslado_ida
        ? 'TRASLADO PRIVADO INCLUIDO: AEROPUERTO / HOTEL (IN)'
        : 'TRASLADO PRIVADO INCLUIDO: HOTEL / AEROPUERTO (OUT)'
    // Precio del traslado propio del vuelo (no el de Destinos, que es para
    // combinada) — mismo criterio que el resto: respeta "Pública".
    const precioTraslado = (vuelo.traslado_venta && vuelo.traslado_venta_publica !== false)
      ? ` — ${moneda || 'ARS'}$ ${formatearNumero(vuelo.traslado_venta)}`
      : ''
    lineasInfo.push(textoTraslado + precioTraslado)
  }
  if (lineasInfo.length) {
    const bottomBoundary = slot.bottom + 8 * esc
    const gapLinea = 12 * esc
    const centroY = (y + bottomBoundary) / 2
    const tamanoRef = medirTamanoAjustado(lineasInfo[0], 515, 9.5)
    let yLinea = centroY + (lineasInfo.length - 1) * gapLinea / 2 - tamanoRef * 0.36
    for (const texto of lineasInfo) {
      centrado(texto, xCentroHoja, yLinea, medirTamanoAjustado(texto, 515, 9.5), NAVY_TXT)
      yLinea -= gapLinea
    }
  }

  // El cartel de actividades (con foto, "SI TE INTERESA VER LAS
  // ACTIVIDADES...") no se repite por vuelo — queda uno solo, fijo en la
  // plantilla al pie de la hoja, con su link agregado en
  // dibujarPaginaAereosGrupo (ver agregarLinkBanner mas abajo).

  // Separador fino entre vuelos, apoyado en el piso de la franja.
  page.drawLine({ start: { x: 30, y: slot.bottom + 8 }, end: { x: 565, y: slot.bottom + 8 }, thickness: 0.5, color: rgb(0.85, 0.83, 0.78) })
}

async function dibujarPaginaAereosGrupo(page, bebas, doc, { clienteNombre, cantidadAdultos, cantidadMenores, edadesMenores, grupo, destinos, moneda }) {
  function escribir(texto, x, y, size, color) {
    page.drawText(texto, { x, y, size, font: bebas, color })
  }

  // Transfers/traslados privados de una propuesta combinada: se cargan por
  // tramo (salida/destino) en la seccion "Transfers" del Generador, aparte de
  // los vuelos — antes se guardaban en la base pero nunca llegaban al PDF. Se
  // listan una sola vez, en la primera hoja de Aereos, reservando el espacio
  // extra que haga falta ARRIBA del banner de actividades (que es fijo).
  const destinosValidos = (destinos || []).filter(d => d.salida?.trim() || d.destino?.trim())
  // Texto de este bloque a 1.5x el tamaño original (pedido explicito: primero
  // se probo a 3x, despues se pidio la mitad de eso). SCALE_DESTINOS es el
  // unico numero que hay que tocar si se vuelve a pedir otro tamaño — tamaños,
  // espaciado y el aire extra antes del titulo escalan todos juntos en
  // proporcion, para que la grilla de vuelos de arriba se achique lo
  // necesario y el titulo no quede pisando el separador de la ultima fila.
  const SCALE_DESTINOS = 1.5
  const TITULO_DESTINOS_SIZE = 11 * SCALE_DESTINOS
  const LINEA_DESTINO_SIZE = 9 * SCALE_DESTINOS
  const ALTO_TITULO_DESTINOS = destinosValidos.length ? 16 * SCALE_DESTINOS : 0
  const ALTO_LINEA_DESTINO = 13 * SCALE_DESTINOS
  // Aire extra antes del titulo (mas alla del "-6" original) para que su techo
  // no cruce el separador de la ultima fila de vuelos, que crece con el cap
  // height del titulo a este tamaño nuevo — mismo aire se descuenta de la
  // grilla de arriba via alturaDestinos, para no comerse el margen de abajo.
  const GAP_EXTRA_TITULO = 7.92 * SCALE_DESTINOS - 1.92
  const alturaDestinos = destinosValidos.length ? ALTO_TITULO_DESTINOS + destinosValidos.length * ALTO_LINEA_DESTINO + GAP_EXTRA_TITULO : 0

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
  const zonaBottomEfectivo = ZONA_GRUPO_BOTTOM + alturaDestinos
  page.drawRectangle({ x: -5, y: ZONA_GRUPO_BOTTOM, width: PAGINA_ANCHO + 10, height: ZONA_GRUPO_TOP - ZONA_GRUPO_BOTTOM, color: CREMA_BG })

  const totalEnHoja = Math.min(grupo.length, FILAS_VUELO)
  for (let i = 0; i < totalEnHoja; i++) {
    dibujarVueloCompacto(page, bebas, crearSlotVuelo(i, totalEnHoja, zonaBottomEfectivo), grupo[i], i + 1, moneda)
  }

  // Lista de transfers, en la franja reservada arriba del banner.
  if (destinosValidos.length) {
    let yDest = zonaBottomEfectivo - 6 - GAP_EXTRA_TITULO
    const textoTitTraslados = 'TRASLADOS PRIVADOS:'
    escribir(textoTitTraslados, COL_IZQ_X, yDest, TITULO_DESTINOS_SIZE, NAVY_TXT)
    // Precio: suma de "Valor de venta" de todos los tramos (Destinos), no uno
    // por tramo — pedido explicito ("TRASLADOS: $X" como un solo total).
    // Respeta la "Pública" de cada tramo (valor_cliente_traslado_publica).
    const totalTraslados = destinosValidos.reduce((suma, d) =>
      suma + (d.valor_cliente_traslado_publica !== false ? (parseFloat(d.valor_cliente_traslado) || 0) : 0), 0)
    if (totalTraslados > 0) {
      const anchoTitTraslados = bebas.widthOfTextAtSize(textoTitTraslados, TITULO_DESTINOS_SIZE)
      escribir(`${moneda || 'ARS'}$ ${formatearNumero(totalTraslados)}`, COL_IZQ_X + anchoTitTraslados + 10, yDest, TITULO_DESTINOS_SIZE, NAVY_TXT)
    }
    yDest -= ALTO_TITULO_DESTINOS
    for (const d of destinosValidos) {
      const salida = d.salida?.trim().toUpperCase() || '—'
      const destino = d.destino?.trim().toUpperCase() || '—'
      escribir(`- ${salida} / ${destino}`, COL_IZQ_X, yDest, LINEA_DESTINO_SIZE, NAVY_TXT)
      yDest -= ALTO_LINEA_DESTINO
    }
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
export async function generarPaginaAereosGrupoPDF({ clienteNombre, cantidadAdultos, cantidadMenores, edadesMenores, vuelos, destinos, moneda }) {
  const plantillaBytes = await fetch('/plantilla-aereos.pdf').then(r => r.arrayBuffer())
  const doc = await PDFDocument.load(plantillaBytes)
  doc.registerFontkit(fontkit)
  while (doc.getPageCount() > 1) doc.removePage(1)
  const page = doc.getPage(0)

  const fontBytes = await fetch('/fonts/BebasNeue-Regular.ttf').then(r => r.arrayBuffer())
  const bebas = await doc.embedFont(fontBytes)

  // Los transfers (destinos) son un dato de la propuesta entera, no de esta
  // hoja en particular — van solo en la primera (esta), no se repiten si hay
  // mas de 4 vuelos y se agregan paginas siguientes con agregarPaginaAereosGrupo.
  await dibujarPaginaAereosGrupo(page, bebas, doc, { clienteNombre, cantidadAdultos, cantidadMenores, edadesMenores, grupo: vuelos.slice(0, FILAS_VUELO), destinos, moneda })

  return { doc, bebas }
}

// Grupos siguientes (mas de 4 vuelos en la misma propuesta) — caso raro, pero
// se soporta con el mismo patron de agregar-pagina que el resto de la app.
export async function agregarPaginaAereosGrupo(doc, plantillaDoc, bebas, { clienteNombre, cantidadAdultos, cantidadMenores, edadesMenores, vuelos, moneda }) {
  const [pagina] = await doc.copyPages(plantillaDoc, [0])
  doc.addPage(pagina)
  await dibujarPaginaAereosGrupo(pagina, bebas, doc, { clienteNombre, cantidadAdultos, cantidadMenores, edadesMenores, grupo: vuelos.slice(0, FILAS_VUELO), moneda })
}
