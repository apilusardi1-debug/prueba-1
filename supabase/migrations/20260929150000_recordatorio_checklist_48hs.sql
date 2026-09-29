-- Ademas del recordatorio de los 45 dias para pedir el saldo pendiente, al
-- cargar la fecha de check-in de un lead de Anfitriona se crea otro para 48
-- horas antes (2 dias, porque "recordatorios.fecha" es date sin hora) para
-- mandarle el checklist. Mismo trigger, mismo disparador, misma logica de
-- "no tocar si ya esta completado".
create or replace function leads_recordatorio_saldo_pendiente() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_nota_saldo constant text := 'Pedir el pago del saldo pendiente';
  v_nota_checklist constant text := 'Enviar el checklist antes del check-in';
  v_embudo text;
begin
  if new.fecha_checkin is null or new.fecha_checkin is not distinct from old.fecha_checkin then
    return new;
  end if;
  select embudo into v_embudo from embudo_etapas where clave = new.estado;
  if v_embudo is distinct from 'anfitriona' then
    return new;
  end if;

  update recordatorios
     set fecha = new.fecha_checkin - 45
   where lead_id = new.id and nota = v_nota_saldo and not completado;
  insert into recordatorios (lead_id, fecha, nota, creado_por)
  select new.id, new.fecha_checkin - 45, v_nota_saldo, 'Automatización'
   where not exists (select 1 from recordatorios where lead_id = new.id and nota = v_nota_saldo);

  update recordatorios
     set fecha = new.fecha_checkin - 2
   where lead_id = new.id and nota = v_nota_checklist and not completado;
  insert into recordatorios (lead_id, fecha, nota, creado_por)
  select new.id, new.fecha_checkin - 2, v_nota_checklist, 'Automatización'
   where not exists (select 1 from recordatorios where lead_id = new.id and nota = v_nota_checklist);

  return new;
end $$;
