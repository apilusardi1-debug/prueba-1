-- Fecha del último mensaje que mandó el contacto (pedido de Abril, 2026-10-19): el filtro de
-- fechas de la lista del CRM pasa a mostrar los contactos que escribieron entre esas fechas
-- (antes era la fecha de su primer mensaje, primer_mensaje_at, que se mantiene).
-- No alcanza con ultimo_mensaje_at: cambia también con nuestras respuestas y las del asistente.
--
-- Solo agrega una columna y un trigger en mensajes que la mantiene al día: no cambia el
-- webhook, ni el orden de la lista, ni ningún otro dato.

alter table conversaciones add column if not exists ultimo_entrante_at timestamptz;

-- Las que ya existen, de una pasada
update conversaciones c
set ultimo_entrante_at = x.ultimo
from (
  select conversacion_id, max(created_at) as ultimo
  from mensajes
  where direccion = 'entrante'
  group by conversacion_id
) x
where x.conversacion_id = c.id;

-- Las nuevas: cada mensaje entrante la actualiza
create or replace function mensajes_ultimo_entrante()
returns trigger language plpgsql as $$
begin
  if new.direccion = 'entrante' then
    update conversaciones set ultimo_entrante_at = new.created_at
    where id = new.conversacion_id
      and (ultimo_entrante_at is null or ultimo_entrante_at < new.created_at);
  end if;
  return new;
end $$;

drop trigger if exists trg_mensajes_ultimo_entrante on mensajes;
create trigger trg_mensajes_ultimo_entrante
  after insert on mensajes
  for each row execute function mensajes_ultimo_entrante();
