-- Cambio de etapa automatico en el embudo de Paquetes segun lo que pasa con la
-- propuesta del cliente (Cristian pidio, 2026-09-26): en vez de mover el lead a
-- mano, se mueve solo cuando pasa algo que el equipo ya hace de todos modos:
--   - se genera/envia una propuesta      -> "Propuesta enviada / Negociação"
--   - el cliente confirma su eleccion
--     (la propuesta pasa a "archivada")  -> "Activación de AstroPay y formas de pago"
--   - se marca la propuesta "Confirmada"
--     (pasa a "cerrada")                 -> "Ya pagó, reserva confirmada"
-- El pago por Mercado Pago sigue siendo manual (no se generan pagos MP desde la
-- plataforma), asi que no hay automatizacion para eso. "Rechazada" tampoco mueve
-- nada: perder una propuesta no siempre significa perder al lead.
--
-- El cruce es por whatsapp (mismo campo que ya usan leadsApi.getByWhatsapp y
-- propuestasApi.getByWhatsapp) asi que los dos numeros tienen que estar guardados
-- en el mismo formato para que la propuesta encuentre a su lead.
--
-- Solo se avanza: si el lead ya esta mas adelante (etapa "ganada"/"perdida", o
-- una etapa "abierta" mas tardia) no se lo toca. Volver una propuesta a
-- "enviada" tampoco hace retroceder al lead.

create index if not exists idx_leads_whatsapp on leads (whatsapp);

create or replace function propuestas_mover_lead() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_clave_destino text;
  v_orden_destino integer;
begin
  v_clave_destino := case new.estado
    when 'enviada'   then 'propuesta_enviada'
    when 'archivada' then 'activacion_pago'
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

drop trigger if exists trg_propuestas_mover_lead on propuestas;
create trigger trg_propuestas_mover_lead after insert or update of estado on propuestas
  for each row execute function propuestas_mover_lead();
