-- Lista editable de "conceptos" para el campo del mismo nombre en
-- Finanzas (antes era texto libre, ahora un desplegable fijo,
-- administrable desde Configuración).
create table if not exists conceptos_movimiento (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  activo     boolean not null default true,
  created_at timestamptz default now()
);

insert into conceptos_movimiento (nombre) values
  ('Seña'), ('Excursiones'), ('Paquetes'), ('Transfer'), ('Pago total')
on conflict (nombre) do nothing;
