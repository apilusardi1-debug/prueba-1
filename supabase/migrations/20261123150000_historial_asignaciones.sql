-- Historial de asignaciones de chats del CRM: quien asigno cada conversacion a quien, y cuando.
-- Solo agrega columnas opcionales y una tabla nueva; no cambia ningun dato existente.
-- La tabla queda cerrada (RLS sin politicas): solo la lee la funcion historial-asignaciones, que exige superadmin.

-- Quien hizo la asignacion desde el panel (el panel completa estas dos columnas al asignar a mano).
alter table conversaciones add column if not exists asignado_por text;
alter table conversaciones add column if not exists asignado_por_at timestamptz;

create table if not exists asignaciones_historial (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  conversacion_id  uuid,
  contacto_nombre  text,
  contacto_whatsapp text,
  cliente_id       uuid,
  de_usuario_id    uuid,      -- a quien estaba asignada antes (null = sin asignar)
  a_usuario_id     uuid,      -- a quien quedo asignada (null = quedo sin asignar)
  asignado_por     text,      -- email de quien la asigno desde el panel (null si fue automatico)
  origen           text not null default 'automatico'  -- 'manual' | 'automatico' (reparto, asistente o respuesta del equipo)
);
create index if not exists idx_asig_hist_fecha on asignaciones_historial(created_at desc);
create index if not exists idx_asig_hist_conv on asignaciones_historial(conversacion_id);
alter table asignaciones_historial enable row level security;

create or replace function registrar_asignacion_conversacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare manual boolean;
begin
  if tg_op = 'INSERT' then
    if new.asignado_a is null then return new; end if;
    manual := new.asignado_por_at is not null;
  else
    if new.asignado_a is not distinct from old.asignado_a then return new; end if;
    -- Si el panel asigno a mano, cambia asignado_por_at en la misma actualizacion; si no cambia, fue automatico
    manual := new.asignado_por_at is distinct from old.asignado_por_at;
  end if;
  -- Si por cualquier motivo el registro falla, la asignacion igual se hace: el historial nunca bloquea al CRM
  begin
    insert into asignaciones_historial (conversacion_id, contacto_nombre, contacto_whatsapp, cliente_id, de_usuario_id, a_usuario_id, asignado_por, origen)
    values (new.id, coalesce(new.nombre_agendado, new.contacto_nombre), new.whatsapp, new.cliente_id,
            case when tg_op = 'UPDATE' then old.asignado_a else null end, new.asignado_a,
            case when manual then new.asignado_por else null end,
            case when manual then 'manual' else 'automatico' end);
  exception when others then
    null;
  end;
  return new;
end $$;

drop trigger if exists trg_registrar_asignacion on conversaciones;
create trigger trg_registrar_asignacion
  after insert or update of asignado_a on conversaciones
  for each row execute function registrar_asignacion_conversacion();
