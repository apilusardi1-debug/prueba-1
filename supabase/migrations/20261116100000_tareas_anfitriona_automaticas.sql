-- Tareas de Anfitriona que dependen de un dato: se completan solas. Antes el sistema las
-- creaba solo pero nunca las cerraba: había que tildarlas a mano, y si alguien cargaba el dato
-- y no tildaba la tarea, quedaba vencida para siempre (62 vencidas al 2026-11-16, 41 de ellas
-- "Completar la fecha de check-in del vuelo" con las fechas ya cargadas).
--
-- Reglas (pedido de Cristian, 2026-11-16):
--   1. "Completar la fecha de check-in del vuelo": se completa cuando el lead tiene la fecha del
--      vuelo de ida y la de vuelta. Si además tiene un vuelo interno (Recife - Fernando de
--      Noronha), también tienen que estar las dos fechas del vuelo interno. Sin vuelo interno no
--      hace falta nada más.
--   2. "Pedir el pago del saldo pendiente": se completa cuando el saldo del paquete de la ficha
--      quedó pagado por completo.
--   3. "Cobrar el saldo del hospedaje ...": se completa cuando el saldo de hospedaje de la ficha
--      quedó pagado por completo.
-- Las demás ("Check in de vuelos + enviar checklist", "Check in de vuelos" y las que se agregan a
-- mano) siguen siendo a mano: son acciones de una persona y no dejan un dato que se pueda mirar.
--
-- La tarea se marca como hecha (no se borra). Si el dato ya estaba cargado cuando se crea la tarea,
-- se completa en el momento. Una tarea completada no se vuelve a abrir si después cambia el dato.
-- Se corre a mano en el SQL Editor de Supabase. Al final completa las que ya cumplen la regla.

create or replace function completar_tareas_automaticas_lead(p_lead uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  l leads%rowtype;
begin
  select * into l from leads where id = p_lead;
  if not found then
    return;
  end if;

  -- 1) Fechas de vuelo
  if l.fecha_vuelo_ida is not null and l.fecha_vuelo_vuelta is not null
     and (coalesce(l.vuelo_interno, 'no_hay') <> 'recife_noronha'
          or (l.fecha_vuelo_interno_ida is not null and l.fecha_vuelo_interno_vuelta is not null)) then
    update recordatorios set completado = true
     where lead_id = p_lead and not completado
       and nota = 'Completar la fecha de check-in del vuelo';
  end if;

  -- 2) Saldo del paquete pagado
  if exists (select 1 from saldos where lead_id = p_lead and concepto = 'paquetes' and monto > 0)
     and not exists (select 1 from saldos where lead_id = p_lead and concepto = 'paquetes' and monto > pagado) then
    update recordatorios set completado = true
     where lead_id = p_lead and not completado
       and nota = 'Pedir el pago del saldo pendiente';
  end if;

  -- 3) Saldo de hospedaje pagado
  if exists (select 1 from saldos where lead_id = p_lead and concepto = 'hospedaje' and monto > 0)
     and not exists (select 1 from saldos where lead_id = p_lead and concepto = 'hospedaje' and monto > pagado) then
    update recordatorios set completado = true
     where lead_id = p_lead and not completado
       and nota like 'Cobrar el saldo del hospedaje%';
  end if;
end $$;

-- Al cargar o cambiar las fechas de vuelo (o agregar / quitar el vuelo interno)
create or replace function trg_tareas_auto_desde_lead() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform completar_tareas_automaticas_lead(new.id);
  return new;
end $$;

drop trigger if exists trg_leads_tareas_automaticas on leads;
create trigger trg_leads_tareas_automaticas
  after update of fecha_vuelo_ida, fecha_vuelo_vuelta, vuelo_interno, fecha_vuelo_interno_ida, fecha_vuelo_interno_vuelta on leads
  for each row execute function trg_tareas_auto_desde_lead();

-- Al registrar un pago o cambiar el monto de un saldo de la ficha
create or replace function trg_tareas_auto_desde_saldo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.lead_id is not null then
    perform completar_tareas_automaticas_lead(new.lead_id);
  end if;
  return new;
end $$;

drop trigger if exists trg_saldos_tareas_automaticas on saldos;
create trigger trg_saldos_tareas_automaticas
  after insert or update of monto, pagado on saldos
  for each row execute function trg_tareas_auto_desde_saldo();

-- Al crearse una de estas tareas con el dato ya cargado, se completa en el momento
create or replace function trg_tareas_auto_desde_recordatorio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.lead_id is not null then
    perform completar_tareas_automaticas_lead(new.lead_id);
  end if;
  return new;
end $$;

drop trigger if exists trg_recordatorios_tareas_automaticas on recordatorios;
create trigger trg_recordatorios_tareas_automaticas
  after insert on recordatorios
  for each row
  when (new.nota = 'Completar la fecha de check-in del vuelo'
        or new.nota = 'Pedir el pago del saldo pendiente'
        or new.nota like 'Cobrar el saldo del hospedaje%')
  execute function trg_tareas_auto_desde_recordatorio();

-- Las que hoy están pendientes y ya cumplen la regla se completan ahora
do $$
declare
  r record;
begin
  for r in select distinct lead_id from recordatorios
            where not completado and lead_id is not null
              and (nota = 'Completar la fecha de check-in del vuelo'
                   or nota = 'Pedir el pago del saldo pendiente'
                   or nota like 'Cobrar el saldo del hospedaje%') loop
    perform completar_tareas_automaticas_lead(r.lead_id);
  end loop;
end $$;
