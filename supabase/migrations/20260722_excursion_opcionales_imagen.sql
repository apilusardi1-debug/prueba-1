-- Imagen unica (flyer/infografia) con el menu y las actividades opcionales de
-- cada excursion, usada como encabezado de imagen en la plantilla de WhatsApp
-- al cliente (aviso_cliente).
alter table excursiones add column if not exists opcionales_imagen text;
