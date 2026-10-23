-- Las alarmas de Anfitriona (pedir el saldo 45 días antes del vuelo de ida, check in 48 hs
-- antes de cada vuelo, cobrar el hospedaje 47 días antes del check-in) solo se creaban si las
-- fechas se cargaban CUANDO el lead ya estaba en el Embudo de anfitriona
-- (trg_leads_recordatorios_vuelos y trg_anfitriona_hospedaje_cobro miran la etapa en ese
-- momento). Si el equipo cargaba vuelos y hospedaje con el lead todavía en Paquetes y después lo
-- pasaba a Anfitriona, no se creaba ninguna; y volver a apretar "Guardar vuelos" no las creaba
-- porque las fechas no cambiaban. Lo avisó la dueña el 2026-10-22.
--
-- Arreglo: al ENTRAR a una etapa de Anfitriona (venga de otro embudo o se cree ahí) se crean
-- las alarmas con las fechas que el lead ya tiene. Como en la planilla de paquetes, solo las de
-- fecha futura. Al final se completan las que les faltan a los leads que ya están en Anfitriona.

create or replace function lead_alarmas_anfitriona(p_lead uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  l record;
  h record;
begin
  select * into l from leads where id = p_lead;

  if l.fecha_vuelo_ida is not null then
    if l.fecha_vuelo_ida - 45 >= current_date then
      perform recordatorio_automatico(p_lead, 'Pedir el pago del saldo pendiente', l.fecha_vuelo_ida - 45);
    end if;
    if l.fecha_vuelo_ida - 2 >= current_date then
      perform recordatorio_automatico(p_lead, 'Check in de vuelos + enviar checklist', l.fecha_vuelo_ida - 2);
    end if;
  end if;

  if l.fecha_vuelo_vuelta is not null and l.fecha_vuelo_vuelta - 2 >= current_date then
    perform recordatorio_automatico(p_lead, 'Check in de vuelos', l.fecha_vuelo_vuelta - 2);
  end if;

  for h in select nombre, fecha_checkin from anfitriona_hospedajes
            where lead_id = p_lead and fecha_checkin - 47 >= current_date loop
    perform recordatorio_automatico(p_lead, 'Cobrar el saldo del hospedaje ' || h.nombre, h.fecha_checkin - 47);
  end loop;
end $$;

create or replace function leads_alarmas_al_entrar_anfitriona() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select embudo from embudo_etapas where clave = new.estado) is distinct from 'anfitriona' then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and (select embudo from embudo_etapas where clave = old.estado) is not distinct from 'anfitriona' then
    return new; -- se movió dentro de Anfitriona: las alarmas ya se crearon al entrar
  end if;
  perform lead_alarmas_anfitriona(new.id);
  return new;
end $$;

drop trigger if exists trg_leads_alarmas_al_entrar_anfitriona on leads;
create trigger trg_leads_alarmas_al_entrar_anfitriona after insert or update of estado on leads
  for each row execute function leads_alarmas_al_entrar_anfitriona();

-- Leads que ya están en Anfitriona: solo se agregan las alarmas que no tienen (ni pendientes
-- ni hechas), así no se mueve ninguna que el equipo haya cambiado de fecha a mano.
do $$
declare
  l record;
  h record;
  v_alarmas jsonb;
  a jsonb;
begin
  for l in select le.* from leads le join embudo_etapas e on e.clave = le.estado
            where e.embudo = 'anfitriona' loop
    v_alarmas := '[]'::jsonb;
    if l.fecha_vuelo_ida is not null then
      v_alarmas := v_alarmas
        || jsonb_build_object('nota', 'Pedir el pago del saldo pendiente', 'fecha', l.fecha_vuelo_ida - 45)
        || jsonb_build_object('nota', 'Check in de vuelos + enviar checklist', 'fecha', l.fecha_vuelo_ida - 2);
    end if;
    if l.fecha_vuelo_vuelta is not null then
      v_alarmas := v_alarmas || jsonb_build_object('nota', 'Check in de vuelos', 'fecha', l.fecha_vuelo_vuelta - 2);
    end if;
    for h in select nombre, fecha_checkin from anfitriona_hospedajes
              where lead_id = l.id and fecha_checkin is not null loop
      v_alarmas := v_alarmas || jsonb_build_object('nota', 'Cobrar el saldo del hospedaje ' || h.nombre, 'fecha', h.fecha_checkin - 47);
    end loop;

    for a in select * from jsonb_array_elements(v_alarmas) loop
      if (a->>'fecha')::date >= current_date
         and not exists (select 1 from recordatorios where lead_id = l.id and nota = a->>'nota') then
        insert into recordatorios (lead_id, fecha, nota, creado_por)
        values (l.id, (a->>'fecha')::date, a->>'nota', 'Automatización');
      end if;
    end loop;
  end loop;
end $$;
