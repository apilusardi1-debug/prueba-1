-- Valor del seguro de viaje (cuando seguro_viaje es true) — decision que se
-- toma al cerrar, mismo criterio que seguro_viaje.
alter table propuestas add column if not exists seguro_viaje_valor numeric;
