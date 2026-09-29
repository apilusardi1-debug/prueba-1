-- Se elimina la etapa "Activación de AstroPay y formas de pago" del embudo de
-- Paquetes (pedido de Cristian, 2026-09-29, justo despues de probar la etiqueta
-- "Pago" que la migracion anterior mandaba ahi). La etiqueta "Pago" ahora manda
-- directo de "Propuesta enviada / Negociação" a "Ya pagó, reserva confirmada".
--
-- Mismo patron que las fusiones de etapas anteriores (ver
-- 20260926150000_embudo_fusionar_negociacion.sql): los leads que estuvieran ahi
-- pasan a la siguiente etapa que queda (reservado), las automatizaciones se
-- reasignan sin duplicar, y el resto de las etapas corren su orden un lugar.

do $$
declare v_orden_vieja integer;
begin
  select orden into v_orden_vieja from embudo_etapas where clave = 'activacion_pago';

  if v_orden_vieja is not null then
    update leads set estado = 'reservado' where estado = 'activacion_pago';

    update embudo_automatizaciones ea
       set etapa_clave = 'reservado'
     where ea.etapa_clave = 'activacion_pago'
       and not exists (
         select 1 from embudo_automatizaciones ea2
          where ea2.etapa_clave = 'reservado'
            and ea2.tipo = ea.tipo
            and coalesce(ea2.usuario_id::text, '') = coalesce(ea.usuario_id::text, '')
       );
    delete from embudo_automatizaciones where etapa_clave = 'activacion_pago';

    delete from embudo_etapas where clave = 'activacion_pago';

    update embudo_etapas
       set orden = orden - 1
     where embudo = 'paquetes' and orden > v_orden_vieja;
  end if;
end $$;

-- La etiqueta "Pago" del chat ahora manda directo a "reservado" (ya no existe
-- la etapa intermedia).
create or replace function conversaciones_etiqueta_pago() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_orden_destino integer;
begin
  if new.etiqueta is distinct from old.etiqueta and new.etiqueta = 'pago' then
    select orden into v_orden_destino from embudo_etapas where clave = 'reservado';

    if v_orden_destino is not null then
      update leads l
         set estado = 'reservado'
        from embudo_etapas e
       where e.clave = l.estado
         and l.whatsapp = new.whatsapp
         and e.embudo = 'paquetes'
         and e.tipo = 'abierta'
         and e.orden < v_orden_destino;
    end if;
  end if;
  return new;
end $$;

-- La propuesta que pasa a "archivada" (cliente confirmó su elección, esperando
-- pago) ya no tiene a donde mandar al lead — esa etapa intermedia se borró.
-- Se deja de mover el lead en ese paso (que solo se mueva al llegar el pago de
-- verdad, en "cerrada"); "enviada" y "cerrada" siguen igual que antes.
create or replace function propuestas_mover_lead() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_clave_destino text;
  v_orden_destino integer;
begin
  v_clave_destino := case new.estado
    when 'enviada' then 'propuesta_enviada'
    when 'cerrada' then 'reservado'
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
