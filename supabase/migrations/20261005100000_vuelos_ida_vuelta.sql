-- Anfitriona: fechas de vuelo de ida y de vuelta, y vuelo interno (Recife -
-- Fernando de Noronha, o NO HAY). Reemplaza la fecha unica de check-in.
--
-- Alarmas (por dia, dentro de Anfitriona):
--   - 45 dias antes del vuelo de ida: pedir el pago del saldo pendiente.
--   - 48 hs (2 dias) antes del vuelo de ida: check in de vuelos + enviar checklist
--     (es una sola alarma, las dos tareas se juntan).
--   - 48 hs antes del vuelo de vuelta: check in de vuelos.

do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'leads' and column_name = 'fecha_checkin')
     and not exists (select 1 from information_schema.columns where table_name = 'leads' and column_name = 'fecha_vuelo_ida') then
    alter table leads rename column fecha_checkin to fecha_vuelo_ida;
  end if;
end $$;

alter table leads add column if not exists fecha_vuelo_ida date;
alter table leads add column if not exists fecha_vuelo_vuelta date;
alter table leads add column if not exists vuelo_interno text;
alter table leads add column if not exists fecha_vuelo_interno_ida date;
alter table leads add column if not exists fecha_vuelo_interno_vuelta date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_vuelo_interno_valido') then
    alter table leads add constraint leads_vuelo_interno_valido check (vuelo_interno in ('recife_noronha', 'no_hay'));
  end if;
end $$;

-- Lo que bloquea avanzar de etapa dentro de Anfitriona ahora es la fecha de ida.
create or replace function leads_bloquear_avance_anfitriona_sin_checkin() returns trigger
language plpgsql as $$
declare
  v_embudo_actual text;
begin
  if new.estado is distinct from old.estado then
    select embudo into v_embudo_actual from embudo_etapas where clave = old.estado;
    if v_embudo_actual = 'anfitriona' and new.estado <> 'anfitriona_perdido' and new.fecha_vuelo_ida is null then
      raise exception 'Cargá la fecha del vuelo de ida antes de mover este lead a otra etapa de Anfitriona.';
    end if;
  end if;
  return new;
end $$;

-- Reemplaza el recordatorio de saldo / checklist de la version anterior.
drop trigger if exists trg_leads_recordatorio_saldo_pendiente on leads;
drop function if exists leads_recordatorio_saldo_pendiente();

-- Crea o mueve un recordatorio automatico de un lead. Si ya existe uno pendiente
-- con esa nota, se mueve a la fecha nueva; los completados no se tocan.
create or replace function recordatorio_automatico(p_lead uuid, p_nota text, p_fecha date) returns void
language plpgsql security definer set search_path = public as $$
begin
  update recordatorios
     set fecha = p_fecha
   where lead_id = p_lead and nota = p_nota and not completado;
  insert into recordatorios (lead_id, fecha, nota, creado_por)
  select p_lead, p_fecha, p_nota, 'Automatización'
   where not exists (select 1 from recordatorios where lead_id = p_lead and nota = p_nota);
end $$;

create or replace function leads_recordatorios_vuelos() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_embudo text;
begin
  select embudo into v_embudo from embudo_etapas where clave = new.estado;
  if v_embudo is distinct from 'anfitriona' then
    return new;
  end if;

  if new.fecha_vuelo_ida is not null and new.fecha_vuelo_ida is distinct from old.fecha_vuelo_ida then
    perform recordatorio_automatico(new.id, 'Pedir el pago del saldo pendiente', new.fecha_vuelo_ida - 45);
    perform recordatorio_automatico(new.id, 'Check in de vuelos + enviar checklist', new.fecha_vuelo_ida - 2);
  end if;

  if new.fecha_vuelo_vuelta is not null and new.fecha_vuelo_vuelta is distinct from old.fecha_vuelo_vuelta then
    perform recordatorio_automatico(new.id, 'Check in de vuelos', new.fecha_vuelo_vuelta - 2);
  end if;

  return new;
end $$;

drop trigger if exists trg_leads_recordatorios_vuelos on leads;
create trigger trg_leads_recordatorios_vuelos after update of fecha_vuelo_ida, fecha_vuelo_vuelta on leads
  for each row when (old.fecha_vuelo_ida is distinct from new.fecha_vuelo_ida or old.fecha_vuelo_vuelta is distinct from new.fecha_vuelo_vuelta)
  execute function leads_recordatorios_vuelos();
