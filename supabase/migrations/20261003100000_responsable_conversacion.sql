-- Quien mando cada mensaje saliente desde el CRM (send-whatsapp lo guarda), para
-- saber si el asignado de la conversacion ya respondio al ultimo mensaje.
alter table mensajes add column if not exists enviado_por uuid references usuarios_admin(id) on delete set null;

-- La persona asignada a la conversacion es el responsable del lead con el mismo
-- WhatsApp: se copia cada vez que cambia la asignacion (a mano en el chat, o
-- automaticamente cuando responde otro usuario).
create or replace function conversaciones_sincronizar_responsable() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update leads
     set responsable_id = new.asignado_a
   where whatsapp = new.whatsapp
     and responsable_id is distinct from new.asignado_a;
  return new;
end $$;

drop trigger if exists trg_conversaciones_responsable on conversaciones;
create trigger trg_conversaciones_responsable after update of asignado_a on conversaciones
  for each row when (old.asignado_a is distinct from new.asignado_a)
  execute function conversaciones_sincronizar_responsable();
