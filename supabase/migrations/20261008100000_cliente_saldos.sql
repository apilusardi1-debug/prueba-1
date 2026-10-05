-- Saldos del cliente cargados a mano en su perfil. Después se completan desde el generador de propuestas.

create table if not exists cliente_saldos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references clientes(id) on delete cascade,
  concepto    text not null check (concepto in ('paquetes', 'paseos', 'traslados', 'hospedaje', 'restaurante', 'otros')),
  descripcion text,
  monto       numeric(12, 2) not null default 0 check (monto >= 0),
  pagado      numeric(12, 2) not null default 0 check (pagado >= 0),
  created_at  timestamptz not null default now()
);

create index if not exists idx_cliente_saldos_cliente on cliente_saldos (cliente_id);

alter table cliente_saldos enable row level security;

do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'cliente_saldos' loop
    execute format('drop policy %I on cliente_saldos;', pol.policyname);
  end loop;
end $$;

create policy "acceso_total_temporal" on cliente_saldos for all using (true) with check (true);
