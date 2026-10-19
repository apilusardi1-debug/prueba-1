-- Una conversación deja de contar como "nueva" (no_leidos = 0) cuando le responde una persona,
-- venga de donde venga la respuesta: el CRM (con cualquier versión de la pantalla abierta), el
-- celular de la agencia o WhatsApp Web (origen = 'celular'). Abrir el chat no la saca (eso ya lo
-- hace la pantalla desde el 2026-10-19). Los mensajes del asistente automático (origen = 'bot')
-- y el historial importado de Kommo (origen = 'kommo') no la sacan. Pedido de Cristian, 2026-10-19.
--
-- Solo toca la columna no_leidos de conversaciones. No cambia mensajes, leads ni el asistente.

create or replace function mensajes_respuesta_saca_no_leidos()
returns trigger language plpgsql as $$
begin
  if new.direccion = 'saliente' and new.origen is distinct from 'bot' and new.origen is distinct from 'kommo' then
    update conversaciones set no_leidos = 0
    where id = new.conversacion_id and no_leidos <> 0;
  end if;
  return new;
end $$;

drop trigger if exists trg_mensajes_respuesta_saca_no_leidos on mensajes;
create trigger trg_mensajes_respuesta_saca_no_leidos
  after insert on mensajes
  for each row execute function mensajes_respuesta_saca_no_leidos();

-- Limpieza de una sola vez: los chats que hoy tienen numerito pero cuyo último mensaje ya es una
-- respuesta de una persona (CRM o celular).
update conversaciones c
set no_leidos = 0
where c.no_leidos > 0
  and exists (
    select 1 from (
      select m.direccion, m.origen
      from mensajes m
      where m.conversacion_id = c.id
      order by m.created_at desc, m.id desc
      limit 1
    ) ultimo
    where ultimo.direccion = 'saliente' and ultimo.origen is distinct from 'bot' and ultimo.origen is distinct from 'kommo'
  );

-- Control: cuántos chats siguen con numerito
select count(*) as chats_con_numerito from conversaciones where no_leidos > 0;
