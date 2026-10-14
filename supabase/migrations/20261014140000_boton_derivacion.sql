-- Botón con enlace en el último mensaje del asistente para Paquetes ("Gracias por completar
-- el formulario..."), pedido de Cristian 2026-10-14: un solo botón (WhatsApp permite uno
-- por mensaje sin plantilla) que abre el Linktree de la agencia con Instagram y la web.
-- Se editan en Configuración > Asistente. Si quedan vacíos, el mensaje sale sin botón.
alter table bot_config add column if not exists boton_derivacion_texto text;
alter table bot_config add column if not exists boton_derivacion_url text;
