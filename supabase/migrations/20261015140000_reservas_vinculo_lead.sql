-- Reservas de paseos y traslados (planilla del equipo de paseos) unidas al lead del cliente,
-- igual que los viajes de la planilla de paquetes (pedido de Abril, 2026-10-15). La reserva
-- se une al lead con el mismo teléfono (cliente_whatsapp; mismas variantes que
-- telefonos_contacto, ver 20261015120000_viajes_paquetes_vinculos.sql), así la ficha única
-- muestra sus paseos y traslados aunque la persona sea solo lead (sin ficha de cliente).
-- cliente_id no se toca: lo sigue manejando el panel (cuenta cantidad_reservas al crear).

alter table reservas add column if not exists lead_id uuid references leads(id) on delete set null;
create index if not exists reservas_lead_idx on reservas (lead_id);

create or replace function reservas_vincular_lead() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_tels text[] := telefonos_contacto(new.cliente_whatsapp);
begin
  if new.lead_id is null and array_length(v_tels, 1) > 0 then
    select id into new.lead_id from leads
     where regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g') = any (v_tels)
     order by created_at desc limit 1;
  end if;
  return new;
end $$;

drop trigger if exists trg_reservas_vincular_lead on reservas;
create trigger trg_reservas_vincular_lead before insert or update of cliente_whatsapp, lead_id on reservas
  for each row execute function reservas_vincular_lead();

-- Las reservas ya cargadas
update reservas r set lead_id = (
  select l.id from leads l
   where regexp_replace(coalesce(l.whatsapp, ''), '\D', '', 'g') = any (telefonos_contacto(r.cliente_whatsapp))
   order by l.created_at desc limit 1)
 where r.lead_id is null and r.cliente_whatsapp is not null;
