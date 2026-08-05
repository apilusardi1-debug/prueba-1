-- Hospedajes deja de ser un array hardcodeado en Hospedajes.jsx y pasa a
-- tabla real, para poder cargar hoteles reales (con fotos, amenities, etc.)
-- y más adelante sincronizarlo con el Generador de propuesta.
create table if not exists hospedajes (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  tipo         text default 'Hotel', -- Resort / Hotel / Pousada / Departamento
  destino      text,                 -- ej: "Porto de Galinhas, PE"
  ubicacion    text,                 -- ej: "Porto de Galinhas" (usado para filtrar)
  direccion    text,
  descripcion  text,
  imagen       text,                 -- foto principal
  galeria      jsonb not null default '[]'::jsonb,   -- fotos adicionales
  amenities    jsonb not null default '[]'::jsonb,   -- ["Piscina", "Wifi Gratuito", ...]
  estrellas    int default 0,
  capacidad    int default 0,
  precio_min   numeric,
  contacto     text,
  whatsapp     text,
  activa       boolean not null default true,
  created_at   timestamp with time zone default now()
);

create index if not exists idx_hospedajes_activa on hospedajes (activa);
