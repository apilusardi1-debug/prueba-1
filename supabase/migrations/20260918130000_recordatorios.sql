-- Recordatorios de seguimiento por lead (CRM). Una tabla nueva necesita su
-- propio RLS activado + la política permisiva temporal, igual que el resto
-- de las tablas del proyecto (si no, queda bloqueada para el ANON_KEY y la
-- función ni siquiera puede leerla).
create table if not exists recordatorios (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid references leads(id) on delete cascade,
  fecha        date not null,
  nota         text not null,
  completado   boolean not null default false,
  creado_por   text,
  created_at   timestamptz default now()
);

create index if not exists idx_recordatorios_lead on recordatorios(lead_id);

alter table recordatorios enable row level security;

do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'recordatorios' loop
    execute format('drop policy %I on recordatorios;', pol.policyname);
  end loop;
  execute 'create policy "acceso_total_temporal" on recordatorios for all using (true) with check (true);';
end $$;
