-- Tag de origen para poder distinguir en el panel admin qué hospedajes
-- vinieron del asistente de importación de Niara vs. el de La Playa
-- (laplayaimoveis.com) vs. carga manual.
alter table hospedajes add column if not exists origen text;

comment on column hospedajes.origen is
  'Fuente de import: "Niara", "La Playa" o null si se cargó manualmente desde el panel admin.';
