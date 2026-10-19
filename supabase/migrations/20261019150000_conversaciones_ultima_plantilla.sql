-- Fecha de la última plantilla de Meta mandada desde el CRM (pedido de Abril, 2026-10-19):
-- la lista del CRM filtra los chats que se reabrieron con una plantilla (ventana de 24 hs
-- cerrada) y separa los que contestaron después (ultimo_entrante_at > ultima_plantilla_at)
-- de los que no.
-- Una plantilla es un mensaje saliente del número del CRM que se cobra (cobro marketing,
-- utilidad o autenticación; los mensajes comunes son 'servicio'). No cuenta el historial de
-- Kommo (no guarda ese dato) ni lo que se manda desde el celular (no usa plantillas).
--
-- Solo agrega una columna y un trigger en mensajes: no cambia send-whatsapp ni otros datos.

alter table conversaciones add column if not exists ultima_plantilla_at timestamptz;

update conversaciones c
set ultima_plantilla_at = x.ultima
from (
  select conversacion_id, max(created_at) as ultima
  from mensajes
  where direccion = 'saliente' and numero = 'crm'
    and cobro is not null and cobro <> 'servicio'
    and origen is distinct from 'kommo'
  group by conversacion_id
) x
where x.conversacion_id = c.id;

create or replace function mensajes_ultima_plantilla()
returns trigger language plpgsql as $$
begin
  if new.direccion = 'saliente' and new.numero = 'crm'
     and new.cobro is not null and new.cobro <> 'servicio'
     and new.origen is distinct from 'kommo' then
    update conversaciones set ultima_plantilla_at = new.created_at
    where id = new.conversacion_id
      and (ultima_plantilla_at is null or ultima_plantilla_at < new.created_at);
  end if;
  return new;
end $$;

drop trigger if exists trg_mensajes_ultima_plantilla on mensajes;
create trigger trg_mensajes_ultima_plantilla
  after insert on mensajes
  for each row execute function mensajes_ultima_plantilla();
