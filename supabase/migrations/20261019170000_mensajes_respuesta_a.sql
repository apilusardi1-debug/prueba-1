-- "Responder" un mensaje puntual, como en WhatsApp (pedido de Abril, 2026-10-19): el mensaje
-- guarda el wa_message_id del mensaje que cita. Lo llenan send-whatsapp (respuestas desde el
-- CRM, que además van a Meta con context.message_id) y webhook-whatsapp (cuando el cliente o
-- el celular de la agencia responden citando). El CRM busca el citado por wa_message_id.
alter table mensajes add column if not exists respuesta_a_wamid text;
