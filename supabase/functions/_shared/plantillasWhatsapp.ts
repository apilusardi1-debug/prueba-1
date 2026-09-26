// Texto de las plantillas de WhatsApp aprobadas en Meta. `send-whatsapp` lo usa para
// reconstruir un mensaje legible al guardarlo en conversaciones/mensajes (el envío real
// va estructurado, como exige la Cloud API) y el panel admin (Agenda > Gestionar) lo usa
// para la vista previa de "así le llega al cliente" — el mismo texto en los dos lugares,
// para que no se desincronicen.
export const TEMPLATE_BODIES: Record<string, string> = {
  aviso_guia: 'Hola {{1}} 👋\n\n🗺 *{{2}}*\n📅 {{3}}\n🕐 Salida: {{4}} — Regreso: {{5}}\n\n*Pasajeros de la operación:*\n{{6}}\n\n¡Muchas gracias!',
  aviso_chofer: 'Hola {{1}} 👋\n\nTe confirmamos los datos de tu próxima excursión:\n\n🗺 *{{2}}*\n📅 {{3}}\n🕐 Salida: {{4}}\n\n*Tus pasajeros a cargo:*\n{{5}}\n\nCualquier consulta sobre la operación, podés contactar a tu guía *{{6}}* al 📱 {{7}}\n\n¡Muchas gracias por tu trabajo!',
  aviso_cliente: '👋 {{1}}! Te escribimos de Dream Tours con la información de tu excursión de mañana a *{{2}}*\n\n🧭 Guía: *{{3}}*\n🚗 Chofer: *{{4}}*\n🚘 Auto: {{5}}\n🔖 Patente: {{6}}\n🕐 *Horario de salida*: {{7}}\n🕐 *Horario de regreso*: {{8}}\n🏨 El chofer pasará a buscarlos por *{{9}}*\n\nAnte cualquier duda o consulta, podés escribirle directamente a tu guía al 📱 *{{10}}* — ese día los va a estar esperando en el parador para ingresar todos juntos.\n\n¡Que disfruten el paseo! Acá te dejamos el menú y las actividades opcionales: {{11}} 🎉',
}

export function renderTemplate(name: string, params: string[]): string {
  const body = TEMPLATE_BODIES[name]
  if (!body) return `[Plantilla: ${name}] ${params.join(' · ')}`
  return params.reduce((text: string, val, i) => text.replaceAll(`{{${i + 1}}}`, String(val ?? '')), body)
}
