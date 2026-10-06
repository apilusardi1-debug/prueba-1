// Textos de los avisos internos de cada operación (chat interno de choferes y guías). Se guardan
// en la base para poder editarlos desde Mensajes; si todavía no están, se usan estos mismos.
// Variables: {excursion} {fecha} {salida} {volta} {pasajeros} {guia} {guia_whatsapp}
export const MENSAJES_OPERACION = {
  operacion_guia: {
    nombre: 'Aviso al guía',
    descripcion: 'Se manda al guía al cerrar la operación, con todos los pasajeros.',
    texto: '🗺 *{excursion}*\n📅 {fecha}\n🕐 SAÍDA: {salida} — Volta: {volta}\n\n*Passageiros da operação:*\n\n{pasajeros}',
    variables: ['excursion', 'fecha', 'salida', 'volta', 'pasajeros'],
  },
  operacion_chofer: {
    nombre: 'Aviso al chofer',
    descripcion: 'Se manda a cada chofer al cerrar la operación, solo con sus pasajeros.',
    texto: '🗺 *{excursion}*\n📅 {fecha}\n🕐 SAÍDA: {salida}\n\n*Seus passageiros:*\n\n{pasajeros}\n\nQualquer dúvida sobre a operação, fale com o guia *{guia}* 📱 +{guia_whatsapp}',
    variables: ['excursion', 'fecha', 'salida', 'pasajeros', 'guia', 'guia_whatsapp'],
  },
}

export function rellenarPlantilla(texto, variables) {
  return texto.replace(/\{(\w+)\}/g, (coincidencia, clave) =>
    Object.prototype.hasOwnProperty.call(variables, clave) ? String(variables[clave] ?? '') : coincidencia,
  )
}
