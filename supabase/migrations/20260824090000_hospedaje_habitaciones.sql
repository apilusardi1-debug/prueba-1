-- Tipos de habitación por hospedaje (ej: Estándar, Superior, Familia Superior,
-- Super Lujo Frente al Mar...). Niara ya trae esta lista completa en la ficha
-- de cada hotel (guestRooms), pero el importador la venía descartando y solo
-- guardaba un precio/foto genérico por hospedaje.
create table if not exists hospedaje_habitaciones (
  id            uuid primary key default gen_random_uuid(),
  hospedaje_id  uuid not null references hospedajes(id) on delete cascade,
  nombre        text not null,
  superficie    numeric,                              -- m²
  capacidad     int default 0,                         -- huéspedes máx.
  cantidad      int default 0,                         -- unidades de este tipo
  camas         text,                                  -- ej: "King", "2 Queen"
  vista         text,                                  -- ej: "Vista al Mar"
  descripcion   text,
  imagen        text,
  galeria       jsonb not null default '[]'::jsonb,
  amenities     jsonb not null default '[]'::jsonb,
  created_at    timestamp with time zone default now()
);

create index if not exists idx_hospedaje_habitaciones_hospedaje on hospedaje_habitaciones (hospedaje_id);
