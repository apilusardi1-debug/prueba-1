import { leadsApi, clientesApi } from './supabase.js'

// Ruta del chat de una persona en el CRM (/admin/crm/whatsapp?phone=…). Las planillas
// (Reservas, Paquetes > Planilla) tienen el teléfono escrito a mano, a veces distinto del
// que tiene la conversación (con o sin el 9 de los celulares argentinos): si la fila está
// unida a un lead o a un cliente se usa el número de esa ficha, que es el del chat.
export async function rutaChatCrm({ leadId, clienteId, telefono }) {
  let numero = null
  if (leadId) numero = (await leadsApi.getById(leadId))?.data?.whatsapp
  if (!numero && clienteId) numero = (await clientesApi.getById(clienteId))?.data?.whatsapp
  numero = String(numero || telefono || '').replace(/\D/g, '')
  return numero.length >= 10 ? `/admin/crm/whatsapp?phone=${numero}` : null
}
