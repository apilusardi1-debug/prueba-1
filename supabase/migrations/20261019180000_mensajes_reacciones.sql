-- Reacciones a mensajes, como en WhatsApp (pedido de Abril, 2026-10-19). WhatsApp permite una
-- reacción por persona por mensaje, así que alcanzan dos columnas en el mensaje reaccionado:
-- la del cliente (la guarda webhook-whatsapp) y la nuestra (send-whatsapp desde el CRM, o
-- webhook-whatsapp si se reaccionó desde el celular de la agencia). Null = sin reacción.
alter table mensajes
  add column if not exists reaccion_cliente text,
  add column if not exists reaccion_nuestra text;
