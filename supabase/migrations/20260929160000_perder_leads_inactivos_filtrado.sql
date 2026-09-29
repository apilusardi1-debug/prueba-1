-- Un lead que queda en "Filtrado" (contactado) sin actividad por mas de 15
-- dias pasa solo a "Perdido". "Actividad" es el ultimo mensaje del chat
-- (conversaciones.ultimo_mensaje_at); si el lead no tiene conversacion
-- vinculada (por ejemplo, uno cargado a mano), se usa la fecha en que entro a
-- Filtrado (estado_at). Si el cliente vuelve a escribir despues, el webhook
-- lo trata como una consulta nueva (ver webhook-whatsapp/index.ts).
create extension if not exists pg_cron with schema extensions;

create or replace function leads_perder_inactivos_filtrado() returns void
language plpgsql security definer set search_path = public as $$
begin
  update leads l
     set estado = 'perdido'
   where l.estado = 'contactado'
     and coalesce(
       (select c.ultimo_mensaje_at from conversaciones c where c.whatsapp = l.whatsapp),
       l.estado_at
     ) < now() - interval '15 days';
end $$;

do $$
begin
  perform cron.unschedule('perder_leads_inactivos_filtrado');
exception when others then null;
end $$;

select cron.schedule(
  'perder_leads_inactivos_filtrado',
  '0 9 * * *',
  $$ select leads_perder_inactivos_filtrado(); $$
);
