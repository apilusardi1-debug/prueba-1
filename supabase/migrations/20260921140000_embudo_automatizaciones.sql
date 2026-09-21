-- Automatizaciones del embudo de ventas: acciones que el sistema hace solo
-- cuando un lead entra a una etapa (como el "Automatiza" del Funil de Kommo).
-- Viven en la base, no en la pantalla, para que se cumplan siempre: da igual si
-- el lead llega a la etapa arrastrandolo, desde su ficha o porque el asistente
-- de WhatsApp lo creo.
--
-- Acciones disponibles:
--   recordatorio = crea un recordatorio de seguimiento para dentro de N dias
--   asignar      = deja a una persona como responsable del lead
-- Ninguna manda mensajes, asi que no cuestan nada en Meta.

alter table leads add column if not exists responsable_id uuid references usuarios_admin(id) on delete set null;

create table if not exists embudo_automatizaciones (
  id          uuid primary key default gen_random_uuid(),
  etapa_clave text not null references embudo_etapas(clave) on delete cascade,
  tipo        text not null check (tipo in ('recordatorio', 'asignar')),
  dias        integer check (dias between 0 and 365),
  nota        text,
  usuario_id  uuid references usuarios_admin(id) on delete cascade,
  activa      boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint automatizacion_completa check (
    (tipo = 'recordatorio' and dias is not null and length(trim(coalesce(nota, ''))) > 0)
    or (tipo = 'asignar' and usuario_id is not null)
  )
);

create index if not exists idx_automatizaciones_etapa on embudo_automatizaciones (etapa_clave) where activa;

alter table embudo_automatizaciones enable row level security;
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'embudo_automatizaciones' loop
    execute format('drop policy %I on embudo_automatizaciones;', pol.policyname);
  end loop;
  execute 'create policy "acceso_total_temporal" on embudo_automatizaciones for all using (true) with check (true);';
end $$;

-- Cada vez que un lead entra a una etapa (alta o cambio de etapa) se cumplen las
-- automatizaciones activas de esa etapa. Volver a entrar a la misma etapa no
-- duplica un recordatorio que sigue pendiente. La fecha se calcula en la hora
-- de Bahia, que es la del negocio.
create or replace function leads_ejecutar_automatizaciones() returns trigger
language plpgsql security definer set search_path = public as $$
declare a record;
begin
  for a in
    select * from embudo_automatizaciones where activa and etapa_clave = new.estado order by created_at
  loop
    if a.tipo = 'recordatorio' then
      insert into recordatorios (lead_id, fecha, nota, creado_por)
      select new.id, (now() at time zone 'America/Bahia')::date + a.dias, trim(a.nota), 'Automatización'
       where not exists (
         select 1 from recordatorios r
          where r.lead_id = new.id and r.nota = trim(a.nota) and not r.completado
       );
    elsif a.tipo = 'asignar' then
      update leads set responsable_id = a.usuario_id
       where id = new.id and responsable_id is distinct from a.usuario_id;
    end if;
  end loop;
  return null;
end $$;

drop trigger if exists trg_leads_automatizaciones_alta on leads;
create trigger trg_leads_automatizaciones_alta after insert on leads
  for each row execute function leads_ejecutar_automatizaciones();

drop trigger if exists trg_leads_automatizaciones_etapa on leads;
create trigger trg_leads_automatizaciones_etapa after update of estado on leads
  for each row when (old.estado is distinct from new.estado)
  execute function leads_ejecutar_automatizaciones();
