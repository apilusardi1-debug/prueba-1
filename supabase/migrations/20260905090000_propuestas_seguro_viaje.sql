-- Si la propuesta incluye seguro de viaje o no — decision que se toma al
-- cerrar, mismo criterio que traslados_incluidos.
alter table propuestas add column if not exists seguro_viaje boolean default false;
