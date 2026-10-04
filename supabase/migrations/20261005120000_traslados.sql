-- Planilla de traslados: uno por fila, con fecha y hora de recogida, lugar de origen y destino,
-- pasajeros, equipaje (cantidad y tipo), vuelo de referencia, chofer asignado y estado.

create table if not exists traslados (
  id                 uuid primary key default gen_random_uuid(),
  fecha              date not null,
  hora               time not null,
  cliente            text,
  vuelo              text,
  origen             text,
  destino            text not null,
  personas           integer not null check (personas > 0),
  equipaje_cantidad  integer not null default 0 check (equipaje_cantidad >= 0),
  equipaje_tipo      text,
  chofer_id          uuid references choferes(id) on delete set null,
  estado             text not null default 'pendiente' check (estado in ('pendiente', 'realizado', 'cancelado')),
  observaciones      text,
  created_at         timestamptz not null default now()
);

create index if not exists idx_traslados_fecha on traslados (fecha, hora);

alter table traslados enable row level security;

do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'traslados' loop
    execute format('drop policy %I on traslados;', pol.policyname);
  end loop;
end $$;

create policy "acceso_total_temporal" on traslados for all using (true) with check (true);
