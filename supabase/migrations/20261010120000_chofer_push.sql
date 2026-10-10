-- Notificaciones push para choferes (parte 2 del icono instalable, pedido de Cristian
-- 2026-10-09): cuando se cierra una operación y se crea su aviso, el chofer recibe una
-- notificación push en el celular, sin pasar por WhatsApp ni por Meta.

create table if not exists chofer_push_subscripciones (
  id          uuid primary key default gen_random_uuid(),
  chofer_id   uuid not null references choferes(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_chofer_push_chofer on chofer_push_subscripciones (chofer_id);

-- Mismo criterio que el resto del chat interno (operaciones/operaciones_avisos): lo protege
-- el token del link, no hace falta una sesión de admin para guardar/sacar la suscripción.
alter table chofer_push_subscripciones enable row level security;
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'chofer_push_subscripciones' loop
    execute format('drop policy %I on chofer_push_subscripciones;', pol.policyname);
  end loop;
  execute 'create policy "acceso_total_temporal" on chofer_push_subscripciones for all using (true) with check (true);';
end $$;

-- Al crear un aviso para un chofer (no para un guía: la notificación push es solo para
-- choferes por ahora), Supabase llama a la Edge Function enviar-push-chofer. Es el mismo
-- mecanismo que genera el panel de "Database Webhooks" de Supabase, escrito a mano porque acá
-- las migraciones se corren por SQL Editor. El Content-Type ya le avisa a la funcion que el
-- cuerpo es JSON; no hace falta mandar ninguna clave en el header porque la funcion se
-- despliega con --no-verify-jwt (ver nota en su propio archivo) y ademas vuelve a leer el
-- aviso real de la base en vez de confiar en el cuerpo del pedido.
drop trigger if exists trg_push_aviso_chofer on operaciones_avisos;
create trigger trg_push_aviso_chofer
  after insert on operaciones_avisos
  for each row
  when (new.destinatario = 'chofer')
  execute function supabase_functions.http_request(
    'https://przvftnhwwistmcbkeon.supabase.co/functions/v1/enviar-push-chofer',
    'POST',
    '{"Content-Type":"application/json"}',
    '{}',
    '5000'
  );
