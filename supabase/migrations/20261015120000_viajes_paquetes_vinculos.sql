-- Planilla de paquetes conectada con el resto del panel (pedido de Abril, 2026-10-15).
-- Cada viaje de viajes_paquetes se une a su lead y a su cliente por el teléfono de
-- "Contacto cliente" y, mientras esté unido:
--   · la ficha del lead tiene la fecha de viaje y de regreso como vuelos de ida y vuelta;
--   · el saldo del viaje es un saldo de la ficha (tabla saldos, concepto "paquetes"),
--     sincronizado en las dos direcciones: cobrarlo en la ficha lo baja en la planilla y
--     al revés;
--   · el hospedaje (con su PIX y su contacto) es un hospedaje de la ficha
--     (anfitriona_hospedajes), también en las dos direcciones;
--   · si el viaje tiene todos los datos (fecha y hora de llegada y de regreso, hospedaje y
--     saldo cargado) y el lead sigue en el embudo de Paquetes, pasa a la primera etapa de
--     Anfitriona, donde se crean sus alarmas (saldo, check-in de vuelos, cobro del hospedaje).
--     Al pasar no se crean alarmas con fecha ya vencida, ni las de cobro si el saldo es 0.
--     Si le falta algo, queda donde está. No se marca ganado_at: no se sabe cuándo se vendió,
--     y marcarlo hoy inflaría los "cerrados" del día en las métricas.
-- Viajes sin lead con ese teléfono quedan sin conectar (se ven "Sin ficha" en la Planilla).

alter table viajes_paquetes add column if not exists lead_id uuid references leads(id) on delete set null;
alter table viajes_paquetes add column if not exists cliente_id uuid references clientes(id) on delete set null;
create index if not exists viajes_paquetes_lead_idx on viajes_paquetes (lead_id);
create index if not exists viajes_paquetes_cliente_idx on viajes_paquetes (cliente_id);

alter table saldos add column if not exists viaje_id uuid references viajes_paquetes(id) on delete cascade;
create unique index if not exists saldos_viaje_key on saldos (viaje_id) where viaje_id is not null;
alter table anfitriona_hospedajes add column if not exists viaje_id uuid references viajes_paquetes(id) on delete cascade;
create unique index if not exists anfitriona_hospedajes_viaje_key on anfitriona_hospedajes (viaje_id) where viaje_id is not null;

-- Números posibles de un "Contacto cliente" escrito a mano: puede tener varios
-- ("Carolina: +54… | Julieta: +34…"); los argentinos aparecen con y sin el 9 del celular.
create or replace function telefonos_contacto(p_texto text) returns text[]
language sql immutable as $$
  select coalesce(array_agg(distinct v), '{}') from (
    select n as v from (select regexp_replace(parte, '\D', '', 'g') as n
                          from regexp_split_to_table(coalesce(p_texto, ''), '[|/]') as parte) x where length(n) >= 10
    union all
    select '54' || substr(n, 4) from (select regexp_replace(parte, '\D', '', 'g') as n
                          from regexp_split_to_table(coalesce(p_texto, ''), '[|/]') as parte) x where n like '549%' and length(n) >= 12
    union all
    select '549' || substr(n, 3) from (select regexp_replace(parte, '\D', '', 'g') as n
                          from regexp_split_to_table(coalesce(p_texto, ''), '[|/]') as parte) x where n like '54%' and n not like '549%' and length(n) >= 11
  ) t
$$;

-- Antes de guardar: si no está unido, busca el lead y el cliente por teléfono
create or replace function viajes_paquetes_vincular() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_tels text[] := telefonos_contacto(new.cliente_contacto);
begin
  if new.lead_id is null and array_length(v_tels, 1) > 0 then
    select id into new.lead_id from leads
     where regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g') = any (v_tels)
     order by created_at desc limit 1;
  end if;
  if new.cliente_id is null and array_length(v_tels, 1) > 0 then
    select id into new.cliente_id from clientes
     where regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g') = any (v_tels)
     limit 1;
  end if;
  return new;
end $$;

drop trigger if exists trg_viajes_paquetes_vincular on viajes_paquetes;
create trigger trg_viajes_paquetes_vincular before insert or update on viajes_paquetes
  for each row execute function viajes_paquetes_vincular();

-- Después de guardar: lleva el viaje a la ficha (embudo, vuelos, saldo, hospedaje)
create or replace function viajes_paquetes_sincronizar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_embudo text;
  v_completo boolean := new.fecha_llegada is not null and new.fecha_regreso is not null
    and new.hora_llegada ~ '^\d{2}:\d{2}$' and new.hora_regreso ~ '^\d{2}:\d{2}$'
    and coalesce(trim(new.hospedaje), '') <> '' and new.saldo is not null;
  v_saldo saldos%rowtype;
begin
  if new.lead_id is not null then
    select e.embudo into v_embudo from leads l join embudo_etapas e on e.clave = l.estado where l.id = new.lead_id;

    -- Vuelos
    update leads set
      fecha_vuelo_ida = coalesce(new.fecha_llegada, fecha_vuelo_ida),
      fecha_vuelo_vuelta = coalesce(new.fecha_regreso, fecha_vuelo_vuelta)
     where id = new.lead_id
       and (fecha_vuelo_ida is distinct from coalesce(new.fecha_llegada, fecha_vuelo_ida)
         or fecha_vuelo_vuelta is distinct from coalesce(new.fecha_regreso, fecha_vuelo_vuelta));

    -- Hospedaje de la ficha
    if coalesce(trim(new.hospedaje), '') <> '' then
      insert into anfitriona_hospedajes (lead_id, viaje_id, nombre, contacto, pix, fecha_checkin, fecha_checkout)
      values (new.lead_id, new.id, new.hospedaje, new.contacto_hospedaje, new.llave_pix, new.fecha_llegada, new.fecha_regreso)
      on conflict (viaje_id) where viaje_id is not null do update set
        lead_id = excluded.lead_id, nombre = excluded.nombre, contacto = excluded.contacto, pix = excluded.pix,
        fecha_checkin = excluded.fecha_checkin, fecha_checkout = excluded.fecha_checkout
      where (anfitriona_hospedajes.lead_id, anfitriona_hospedajes.nombre, anfitriona_hospedajes.contacto, anfitriona_hospedajes.pix,
             anfitriona_hospedajes.fecha_checkin, anfitriona_hospedajes.fecha_checkout)
        is distinct from (excluded.lead_id, excluded.nombre, excluded.contacto, excluded.pix, excluded.fecha_checkin, excluded.fecha_checkout);
    end if;

    -- Embudo: de Paquetes a Anfitriona solo con todos los datos. Va después de cargar vuelos y
    -- hospedaje a propósito: así las alarmas de este pase las crea el bloque de abajo, que
    -- saltea las que ya quedaron en el pasado (viajes cercanos) y las de cobro si no hay saldo,
    -- en vez de los disparadores de siempre.
    if v_completo and v_embudo = 'paquetes' then
      update leads set estado = 'anfitriona_asignada' where id = new.lead_id;

      if new.fecha_llegada - 2 >= current_date then
        perform recordatorio_automatico(new.lead_id, 'Check in de vuelos + enviar checklist', new.fecha_llegada - 2);
      end if;
      if new.fecha_regreso - 2 >= current_date then
        perform recordatorio_automatico(new.lead_id, 'Check in de vuelos', new.fecha_regreso - 2);
      end if;
      if new.saldo > 0 and new.fecha_llegada - 45 >= current_date then
        perform recordatorio_automatico(new.lead_id, 'Pedir el pago del saldo pendiente', new.fecha_llegada - 45);
      end if;
      if new.saldo > 0 and new.fecha_llegada - 47 >= current_date then
        perform recordatorio_automatico(new.lead_id, 'Cobrar el saldo del hospedaje ' || new.hospedaje, new.fecha_llegada - 47);
      end if;
    end if;
  end if;

  -- Saldo de la ficha (con lead o con cliente). El saldo de la planilla es lo que falta
  -- pagar: si baja, se anota como pagado; si sube, sube el monto.
  if (new.lead_id is not null or new.cliente_id is not null) and new.saldo is not null then
    select * into v_saldo from saldos where viaje_id = new.id;
    if not found and new.saldo > 0 then
      insert into saldos (lead_id, cliente_id, viaje_id, concepto, descripcion, monto, pagado)
      values (new.lead_id, new.cliente_id, new.id, 'paquetes', 'Saldo del viaje (planilla)', greatest(new.saldo, 0), 0);
    elsif found and (v_saldo.monto - v_saldo.pagado is distinct from new.saldo
       or v_saldo.lead_id is distinct from new.lead_id or v_saldo.cliente_id is distinct from new.cliente_id) then
      update saldos set
        lead_id = new.lead_id, cliente_id = new.cliente_id,
        monto = case when new.saldo <= v_saldo.monto then v_saldo.monto else greatest(new.saldo, 0) + v_saldo.pagado end,
        pagado = case when new.saldo <= v_saldo.monto then v_saldo.monto - greatest(new.saldo, 0) else v_saldo.pagado end
       where id = v_saldo.id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_viajes_paquetes_sincronizar on viajes_paquetes;
create trigger trg_viajes_paquetes_sincronizar after insert or update on viajes_paquetes
  for each row execute function viajes_paquetes_sincronizar();

-- De la ficha a la planilla: cobrar o cambiar el saldo del viaje
create or replace function saldos_a_viaje() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update viajes_paquetes set saldo = new.monto - new.pagado, updated_at = now()
   where id = new.viaje_id and saldo is distinct from new.monto - new.pagado;
  return new;
end $$;

drop trigger if exists trg_saldos_a_viaje on saldos;
create trigger trg_saldos_a_viaje after update of monto, pagado on saldos
  for each row when (new.viaje_id is not null) execute function saldos_a_viaje();

-- De la ficha a la planilla: cambios en el hospedaje del viaje
create or replace function anfitriona_hospedajes_a_viaje() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update viajes_paquetes set
    hospedaje = new.nombre, contacto_hospedaje = new.contacto, llave_pix = new.pix,
    fecha_llegada = coalesce(new.fecha_checkin, fecha_llegada), fecha_regreso = coalesce(new.fecha_checkout, fecha_regreso),
    updated_at = now()
   where id = new.viaje_id
     and (hospedaje, contacto_hospedaje, llave_pix, fecha_llegada, fecha_regreso)
       is distinct from (new.nombre, new.contacto, new.pix, coalesce(new.fecha_checkin, fecha_llegada), coalesce(new.fecha_checkout, fecha_regreso));
  return new;
end $$;

drop trigger if exists trg_anfitriona_hospedajes_a_viaje on anfitriona_hospedajes;
create trigger trg_anfitriona_hospedajes_a_viaje after update on anfitriona_hospedajes
  for each row when (new.viaje_id is not null) execute function anfitriona_hospedajes_a_viaje();

-- Une y sincroniza los viajes ya cargados
update viajes_paquetes set updated_at = updated_at;
