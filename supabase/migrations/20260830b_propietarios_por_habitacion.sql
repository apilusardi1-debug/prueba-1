-- Complejos con departamentos de distintos dueños (ej: Cupe Beach Living) necesitan
-- atar el propietario a un TIPO DE HABITACIÓN puntual, no solo al hospedaje completo.
alter table hospedajes_propietarios
  alter column hospedaje_id drop not null,
  add column if not exists habitacion_id uuid references hospedaje_habitaciones(id) on delete cascade;

alter table hospedajes_propietarios
  drop constraint if exists hospedajes_propietarios_hospedaje_id_key;

create unique index if not exists hospedajes_propietarios_hospedaje_id_key
  on hospedajes_propietarios (hospedaje_id) where hospedaje_id is not null;

create unique index if not exists hospedajes_propietarios_habitacion_id_key
  on hospedajes_propietarios (habitacion_id) where habitacion_id is not null;

alter table hospedajes_propietarios
  add constraint hospedajes_propietarios_un_solo_dueno
  check ((hospedaje_id is not null)::int + (habitacion_id is not null)::int = 1);

-- Video por tipo de habitación (antes solo existía a nivel hospedaje completo).
alter table hospedaje_habitaciones add column if not exists video text;
