-- Nombre "agendado" en el chat del CRM (pedido de Cristian, 2026-10-24): el nombre que el equipo
-- le pone al cliente en la ficha (leads.nombre) es el que se ve en el chat, como un contacto
-- agendado en el celular. Si no hay ninguno, se sigue viendo el nombre del perfil de WhatsApp
-- (conversaciones.contacto_nombre).
--
-- Va en una columna aparte a propósito: webhook-whatsapp reescribe contacto_nombre con el
-- nombre de WhatsApp en cada mensaje que entra, y así no lo pisa. No hace falta tocar el webhook.
--
-- Cuenta como agendado un nombre de la ficha que tenga letras, no sea "Sin nombre" y sea distinto
-- del de WhatsApp (el lead que crea el webhook nace con el nombre de WhatsApp: ese no cuenta).

alter table conversaciones add column if not exists nombre_agendado text;

create or replace function nombre_agendado_valido(p_nombre text, p_whatsapp_nombre text)
returns boolean language sql immutable as $$
  select coalesce(trim(p_nombre), '') ~ '[[:alpha:]]'
     and lower(trim(p_nombre)) <> 'sin nombre'
     and trim(p_nombre) is distinct from trim(coalesce(p_whatsapp_nombre, ''))
$$;

-- Cuando se crea o se cambia el nombre de un lead, pasa al chat de ese teléfono
create or replace function leads_nombre_al_chat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update conversaciones c
     set nombre_agendado = case when nombre_agendado_valido(new.nombre, c.contacto_nombre) then trim(new.nombre) end
   where c.whatsapp = new.whatsapp
     and c.nombre_agendado is distinct from
         (case when nombre_agendado_valido(new.nombre, c.contacto_nombre) then trim(new.nombre) end);
  return new;
end $$;

drop trigger if exists trg_leads_nombre_al_chat on leads;
create trigger trg_leads_nombre_al_chat
  after insert or update of nombre, whatsapp on leads
  for each row execute function leads_nombre_al_chat();

-- Un chat que se crea después del lead (por ejemplo, un lead cargado a mano que recién escribe)
-- arranca con el nombre agendado
create or replace function conversaciones_nombre_agendado_inicial() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_nombre text;
begin
  select nombre into v_nombre from leads where whatsapp = new.whatsapp limit 1;
  if nombre_agendado_valido(v_nombre, new.contacto_nombre) then
    new.nombre_agendado := trim(v_nombre);
  end if;
  return new;
end $$;

drop trigger if exists trg_conversaciones_nombre_agendado_inicial on conversaciones;
create trigger trg_conversaciones_nombre_agendado_inicial
  before insert on conversaciones
  for each row execute function conversaciones_nombre_agendado_inicial();

-- Los que ya existen. OJO: cada fila cambiada le llega en vivo a cada CRM abierto; si son
-- muchas, correrlo cuando el equipo no esté usando el CRM (o pedirles que recarguen después).
-- Para ver cuántas son antes de correrlo:
--   select count(*) from conversaciones c join leads l on l.whatsapp = c.whatsapp
--   where nombre_agendado_valido(l.nombre, c.contacto_nombre);
update conversaciones c
   set nombre_agendado = trim(l.nombre)
  from leads l
 where l.whatsapp = c.whatsapp
   and nombre_agendado_valido(l.nombre, c.contacto_nombre)
   and c.nombre_agendado is distinct from trim(l.nombre);

-- Control
select count(*) as chats, count(nombre_agendado) as con_nombre_agendado from conversaciones;
