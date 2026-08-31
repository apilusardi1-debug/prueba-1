-- Datos del dueño (para hospedajes cargados directo, sin intermediario tipo
-- Niara/La Playa). Va en tabla separada de `hospedajes` a propósito: el sitio
-- público lee `hospedajes` con `select('*')`, así que si esto viviera como
-- columna ahí se filtraría nombre/contacto del dueño al público. Esta tabla
-- nunca es consultada desde src/pages/public/*.
create table if not exists hospedajes_propietarios (
  id             uuid primary key default gen_random_uuid(),
  hospedaje_id   uuid not null unique references hospedajes(id) on delete cascade,
  nombre_dueno   text,
  contacto_dueno text,
  created_at     timestamp with time zone default now()
);

alter table hospedajes_propietarios enable row level security;
create policy "acceso_total_temporal" on hospedajes_propietarios for all using (true) with check (true);

-- Video de recorrido del hospedaje (público, se muestra en la ficha junto a
-- las fotos). Se sube a Supabase Storage, no se guarda el link de Drive.
alter table hospedajes add column if not exists video text;
