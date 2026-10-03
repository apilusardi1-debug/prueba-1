-- Nueva etapa "Envío de detalle" en el embudo de Paquetes, entre "Propuesta
-- enviada / Negociação" y "Ya pagó, reserva confirmada" (pedido de Cristian,
-- 2026-10-01): ahí se le manda al cliente el detalle de lo que eligió de la
-- propuesta y cuánto paga por cada servicio (el PDF "Detalle final" que arma
-- PropuestasLista.jsx al confirmar la selección del cliente).
--
-- Dos disparadores automáticos para esta etapa, mismo patrón que ya usa
-- "Propuesta enviada" (un documento con el nombre correcto enviado por el CRM
-- Y el cambio de estado de la propuesta en la base — lo que pase primero):
--   1. supabase/functions/send-whatsapp: un documento "Detalle final..."
--      mandado por el chat del CRM (antes mandaba a "PDF de servicios
--      enviado" — se corrige en el código de la función, no acá).
--   2. Trigger de "propuestas": cuando una propuesta pasa a "archivada" (el
--      cliente ya eligió y se le mandó su detalle, esperando que pague la
--      seña) — mismo trigger que ya movía "enviada"→propuesta_enviada y
--      "cerrada"→reservado.
--
-- Lo que ya funciona y no se toca: la etiqueta "Pago" en el chat y la
-- propuesta pasando a "cerrada" siguen mandando directo a "reservado" (el
-- trigger solo exige que la etapa actual tenga orden menor, así que avanza
-- igual sin importar si el lead está en "Propuesta enviada" o ya en "Envío
-- de detalle").

do $$
declare v_orden_destino integer;
begin
  select orden into v_orden_destino from embudo_etapas where clave = 'propuesta_enviada';

  if v_orden_destino is not null and not exists (select 1 from embudo_etapas where clave = 'envio_detalle') then
    update embudo_etapas
       set orden = orden + 1
     where embudo = 'paquetes' and orden > v_orden_destino;

    insert into embudo_etapas (clave, nombre, orden, color, tipo, embudo)
    values ('envio_detalle', 'Envío de detalle', v_orden_destino + 1, '#f2b84b', 'abierta', 'paquetes');
  end if;
end $$;

-- "archivada" ahora también mueve el lead — a la nueva etapa.
create or replace function propuestas_mover_lead() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_clave_destino text;
  v_orden_destino integer;
begin
  v_clave_destino := case new.estado
    when 'enviada'   then 'propuesta_enviada'
    when 'archivada' then 'envio_detalle'
    when 'cerrada'   then 'reservado'
    else null
  end;

  if v_clave_destino is null or new.cliente_whatsapp is null then
    return new;
  end if;

  select orden into v_orden_destino from embudo_etapas where clave = v_clave_destino;
  if v_orden_destino is null then
    return new;
  end if;

  update leads l
     set estado = v_clave_destino
    from embudo_etapas e
   where e.clave = l.estado
     and l.whatsapp = new.cliente_whatsapp
     and e.embudo = 'paquetes'
     and e.tipo = 'abierta'
     and e.orden < v_orden_destino;

  return new;
end $$;
