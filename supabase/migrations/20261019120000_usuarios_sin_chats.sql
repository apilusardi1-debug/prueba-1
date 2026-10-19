-- Usuarios que no atienden chats del CRM (pedido de Abril, 2026-10-19): Abril y Cristian no
-- son del equipo de ventas y no responden mensajes, así que no se les puede asignar ninguna
-- conversación, ni el asistente (bot_reparto), ni a mano (menú Asignar), ni sola al responder
-- desde el CRM (send-whatsapp). La base lo frena en todos los casos; el panel además los
-- oculta del menú Asignar y del reparto (usuariosAdminApi.idsSinChats).

alter table usuarios_admin add column if not exists atiende_chats boolean not null default true;
update usuarios_admin set atiende_chats = false where nombre in ('Abril', 'Cristian');

-- Ids para el panel (usuarios_admin no tiene lectura directa)
create or replace function usuarios_sin_chats() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from usuarios_admin where atiende_chats = false
$$;
grant execute on function usuarios_sin_chats() to anon, authenticated;

-- Fuera del reparto del asistente
delete from bot_reparto where usuario_id in (select usuarios_sin_chats());

-- Sus conversaciones: las de Paseos a Agostina; las de Paquetes repartidas en turnos entre
-- quienes están en el reparto de Paquetes. Las que no tienen grupo quedan sin asignar.
update conversaciones set asignado_a = (select id from usuarios_admin where nombre = 'Agostina')
 where asignado_a in (select usuarios_sin_chats()) and grupo = 'paseos';

with equipo as (
  select usuario_id, row_number() over (order by usuario_id) - 1 as n, count(*) over () as total
    from bot_reparto where grupo = 'paquetes'
), chats as (
  select id, row_number() over (order by created_at) - 1 as n
    from conversaciones where asignado_a in (select usuarios_sin_chats()) and grupo = 'paquetes'
)
update conversaciones c set asignado_a = e.usuario_id
  from chats ch join equipo e on e.n = ch.n % e.total
 where c.id = ch.id;

update conversaciones set asignado_a = null where asignado_a in (select usuarios_sin_chats());

-- Freno en la base: una asignación a quien no atiende chats no se guarda (queda la anterior)
create or replace function conversaciones_frenar_sin_chats() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.asignado_a is not null and new.asignado_a in (select usuarios_sin_chats()) then
    if tg_op = 'UPDATE' and (old.asignado_a is null or old.asignado_a not in (select usuarios_sin_chats())) then
      new.asignado_a := old.asignado_a;
    else
      new.asignado_a := null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_conversaciones_frenar_sin_chats on conversaciones;
create trigger trg_conversaciones_frenar_sin_chats before insert or update of asignado_a on conversaciones
  for each row execute function conversaciones_frenar_sin_chats();

create or replace function bot_reparto_frenar_sin_chats() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.usuario_id in (select usuarios_sin_chats()) then
    raise exception 'Este usuario no atiende chats';
  end if;
  return new;
end $$;

drop trigger if exists trg_bot_reparto_frenar_sin_chats on bot_reparto;
create trigger trg_bot_reparto_frenar_sin_chats before insert or update on bot_reparto
  for each row execute function bot_reparto_frenar_sin_chats();

-- Para revisar: quiénes quedaron marcados
select nombre, atiende_chats from usuarios_admin order by atiende_chats, nombre;
