-- Anfitriona: hospedajes de cada lead (uno por hotel o departamento, con proveedor, contacto y
-- PIX) y saldos cargados a mano por concepto. Cada hospedaje con fecha de check-in crea la alarma
-- "cobrar el saldo" 47 días antes, usando recordatorio_automatico (migración 20261005100000).

create table if not exists anfitriona_hospedajes (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null references leads(id) on delete cascade,
  nombre         text not null,
  proveedor      text,
  contacto       text,
  pix            text,
  fecha_checkin  date,
  fecha_checkout date,
  created_at     timestamptz not null default now()
);

create index if not exists idx_anfitriona_hospedajes_lead on anfitriona_hospedajes (lead_id);

create table if not exists anfitriona_saldos (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  concepto    text not null check (concepto in ('hospedaje', 'traslados', 'restaurante', 'otros')),
  descripcion text,
  monto       numeric(12, 2) not null default 0 check (monto >= 0),
  pagado      numeric(12, 2) not null default 0 check (pagado >= 0),
  created_at  timestamptz not null default now()
);

create index if not exists idx_anfitriona_saldos_lead on anfitriona_saldos (lead_id);

create or replace function anfitriona_hospedaje_cobro() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_embudo text;
begin
  if new.fecha_checkin is null then
    return new;
  end if;

  select e.embudo into v_embudo
    from leads l join embudo_etapas e on e.clave = l.estado
   where l.id = new.lead_id;
  if v_embudo is distinct from 'anfitriona' then
    return new;
  end if;

  perform recordatorio_automatico(new.lead_id, 'Cobrar el saldo del hospedaje ' || new.nombre, new.fecha_checkin - 47);
  return new;
end $$;

drop trigger if exists trg_anfitriona_hospedaje_cobro on anfitriona_hospedajes;
create trigger trg_anfitriona_hospedaje_cobro
  after insert or update of fecha_checkin, nombre on anfitriona_hospedajes
  for each row execute function anfitriona_hospedaje_cobro();

do $$
declare
  tabla text;
  pol record;
begin
  foreach tabla in array array['anfitriona_hospedajes', 'anfitriona_saldos']
  loop
    execute format('alter table %I enable row level security;', tabla);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = tabla loop
      execute format('drop policy %I on %I;', pol.policyname, tabla);
    end loop;
    execute format('create policy "acceso_total_temporal" on %I for all using (true) with check (true);', tabla);
  end loop;
end $$;
