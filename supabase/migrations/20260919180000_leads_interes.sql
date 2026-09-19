-- Interes del lead (reemplaza en la pantalla al campo "Excursion de interes"):
-- tipo de servicio y destino, detectados por palabras clave del mensaje.
-- excursion_id y excursion_interes se conservan: los leads viejos los siguen mostrando.
alter table leads
  add column if not exists interes_tipo    text,
  add column if not exists interes_destino text;
