// Texto de las plantillas de WhatsApp aprobadas en Meta. `send-whatsapp` lo usa para
// reconstruir un mensaje legible al guardarlo en conversaciones/mensajes (el envío real
// va estructurado, como exige la Cloud API) y el panel admin (Agenda > Gestionar) lo usa
// para la vista previa de "así le llega al cliente" — el mismo texto en los dos lugares,
// para que no se desincronicen.
export const TEMPLATE_BODIES: Record<string, string> = {
  aviso_guia: 'Hola {{1}} 👋\n\n🗺 *{{2}}*\n📅 {{3}}\n🕐 Salida: {{4}} — Regreso: {{5}}\n\n*Pasajeros de la operación:*\n{{6}}\n\n¡Muchas gracias!',
  aviso_chofer: 'Hola {{1}} 👋\n\nTe confirmamos los datos de tu próxima excursión:\n\n🗺 *{{2}}*\n📅 {{3}}\n🕐 Salida: {{4}}\n\n*Tus pasajeros a cargo:*\n{{5}}\n\nCualquier consulta sobre la operación, podés contactar a tu guía *{{6}}* al 📱 {{7}}\n\n¡Muchas gracias por tu trabajo!',
  aviso_cliente: '👋 {{1}}! Te escribimos de Dream Tours con la información de tu excursión de mañana a *{{2}}*\n\n🧭 Guía: *{{3}}*\n🚗 Chofer: *{{4}}*\n🚘 Auto: {{5}}\n🔖 Patente: {{6}}\n🕐 *Horario de salida*: {{7}}\n🕐 *Horario de regreso*: {{8}}\n🏨 El chofer pasará a buscarlos por *{{9}}*\n\nAnte cualquier duda o consulta, podés escribirle directamente a tu guía al 📱 *{{10}}* — ese día los va a estar esperando en el parador para ingresar todos juntos.\n\n¡Que disfruten el paseo! Acá te dejamos el menú y las actividades opcionales: {{11}} 🎉',
  // Aviso al cliente al cerrar una operación (2026-10-29): sale por el número del CRM, no por el operativo.
  // Se manda el día antes del paseo. {{1}} cliente, {{2}} paseo, {{3}} chofer, {{4}} hora de salida (24 hs),
  // {{5}} hospedaje, {{6}} guía, {{7}} link del catálogo de opcionales, {{8}} WhatsApp del guía (+55...).
  aviso_excursion_cliente: '¡Hola, {{1}}! ¿Cómo estás? 🤗\n\n¡Tu excursión de mañana a {{2}} está confirmada!\n\n🚐 Tu chofer, {{3}}, los pasará a buscar a las {{4}} hs por la puerta de {{5}}.\n\n🙋🏻‍♂️ Tu guía durante el paseo será *{{6}}*.\n\n🌴 Te compartimos el catálogo de actividades opcionales que pueden contratar durante la excursión: {{7}}\n\n📲 Para cualquier duda o consulta sobre el paseo, pueden comunicarse directamente con su guía, al {{8}}. Estará a disposición para lo que necesiten.\n\n¡Que disfruten mucho del paseo y, una vez más, gracias por elegirnos! 💫',
}

export function renderTemplate(name: string, params: string[]): string {
  const body = TEMPLATE_BODIES[name]
  if (!body) return `[Plantilla: ${name}] ${params.join(' · ')}`
  return params.reduce((text: string, val, i) => text.replaceAll(`{{${i + 1}}}`, String(val ?? '')), body)
}

// Datos con los que está aprobada en Meta (WhatsApp Manager, cuenta Dream Tours)
export const PLANTILLA_AVISO_EXCURSION = { name: 'aviso_excursion_cliente', language: 'es_AR', category: 'UTILITY' }
