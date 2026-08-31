alter table propuestas add column if not exists tipo_propuesta text;
alter table propuestas add column if not exists destinos_detalle jsonb;
