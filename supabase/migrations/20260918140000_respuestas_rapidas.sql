create table if not exists respuestas_rapidas (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  texto      text not null,
  activo     boolean not null default true,
  created_at timestamptz default now()
);

alter table respuestas_rapidas enable row level security;

do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'respuestas_rapidas' loop
    execute format('drop policy %I on respuestas_rapidas;', pol.policyname);
  end loop;
  execute 'create policy "acceso_total_temporal" on respuestas_rapidas for all using (true) with check (true);';
end $$;
