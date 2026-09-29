-- Embudo de Anfitriona: fecha de check-in del vuelo (se carga a mano, en la
-- ficha del lead) y recordatorio automatico para pedir el saldo pendiente 45
-- dias antes de esa fecha. El otro pedido de Cristian ("recordatorio para
-- completar la fecha de check-in al entrar a Anfitriona") no necesita codigo
-- nuevo: ya se puede armar como una automatizacion mas desde el panel
-- Automatizar (etapa "Anfitriona asignada", tipo Recordatorio, 0 dias,
-- "Completar la fecha de check-in del vuelo") — se deja tambien como sugerida
-- lista para activar en un click, ver AutomatizacionesEmbudo.jsx.

alter table leads add column if not exists fecha_checkin date;

-- Si ya existe un recordatorio de saldo pendiente sin completar para este
-- lead, se actualiza la fecha (por si el check-in se corrige); si no existe,
-- se crea. Uno ya completado no se vuelve a tocar (el equipo ya lo hizo).
create or replace function leads_recordatorio_saldo_pendiente() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_nota constant text := 'Pedir el pago del saldo pendiente';
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
   where lead_id = new.id and nota = v_nota and not completado;

  insert into recordatorios (lead_id, fecha, nota, creado_por)
  select new.id, new.fecha_checkin - 45, v_nota, 'Automatización'
   where not exists (select 1 from recordatorios where lead_id = new.id and nota = v_nota);

  return new;
end $$;

drop trigger if exists trg_leads_recordatorio_saldo_pendiente on leads;
create trigger trg_leads_recordatorio_saldo_pendiente after update of fecha_checkin on leads
  for each row execute function leads_recordatorio_saldo_pendiente();
