-- Lista de adicionales/opcionales que se pueden contratar durante el paseo,
-- fija por excursion, usada en la plantilla de WhatsApp al cliente.
alter table excursiones add column if not exists opcionales text[] default '{}';
