-- El PDF de cierre (documento que el equipo manda después de "Ya pagó, reserva
-- confirmada") mueve al lead a "PDF de cierre enviado" -- pero ese lead sigue
-- de largo, instantáneo, a la primera etapa de Anfitriona (mismo mecanismo que
-- ya existía para "PDF de servicios enviado" -- ver 20260929120000_anfitriona_
-- desde_pdf_enviado.sql). Se re-crea acá entero (función + trigger), sin
-- asumir que esa migración vieja haya quedado corrida, porque en producción
-- había un lead (Baleia, 2026-10-10) parado en "pdf_enviado" sin redirigir --
-- el backfill del final lo corrige.
--
-- Pedido de Cristian, 2026-10-11: la columna "PDF de cierre enviado" del
-- tablero de Paquetes no tiene que quedar vacía apenas pasa esto -- tiene que
-- quedar un comprobante visual ("se mandó este PDF a tal lead") durante 24
-- horas, sin ser un lead real (no se puede abrir ni arrastrar, es solo un
-- registro). Por eso esta tabla aparte en vez de duplicar el lead de verdad:
-- duplicarlo rompería las búsquedas por whatsapp que hace el resto del
-- sistema (el asistente, los pases automáticos de etapa en embudoEntrada.ts),
-- que asumen un solo lead activo por número.
create table if not exists leads_pdf_cierre_registro (
  id uuid primary key default gen_random_uuid(),
  lead_nombre text,
  lead_whatsapp text,
  creado_at timestamptz not null default now()
);

alter table leads_pdf_cierre_registro enable row level security;
-- Sin ninguna policy: nadie lee ni escribe directo con la clave pública. Se
-- lee desde el admin vía catalogo-interno; se escribe solo desde el trigger
-- de abajo (security definer, no depende de RLS ni de qué clave llamó).

create or replace function leads_redirigir_anfitriona() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'pdf_enviado' and (tg_op = 'INSERT' or old.estado is distinct from new.estado) then
    insert into leads_pdf_cierre_registro (lead_nombre, lead_whatsapp) values (new.nombre, new.whatsapp);
    new.estado := 'anfitriona_asignada';
  end if;
  return new;
end $$;

drop trigger if exists trg_leads_redirigir_anfitriona on leads;
create trigger trg_leads_redirigir_anfitriona before insert or update on leads
  for each row execute function leads_redirigir_anfitriona();

-- Un registro de más de 24 horas ya cumplió su función (avisar que se mandó
-- el PDF) -- se borra solo. Mismo patrón que ya usa
-- leads_perder_inactivos_filtrado (pg_cron, habilitado en esa migración).
create or replace function limpiar_registro_pdf_cierre() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from leads_pdf_cierre_registro where creado_at < now() - interval '24 hours';
end $$;

do $$
begin
  perform cron.unschedule('limpiar_registro_pdf_cierre');
exception when others then null;
end $$;

select cron.schedule(
  'limpiar_registro_pdf_cierre',
  '0 * * * *',
  $$ select limpiar_registro_pdf_cierre(); $$
);

-- Backfill: el lead que haya quedado parado en "pdf_enviado" antes de este
-- arreglo (el trigger viejo no estaba redirigiendo) pasa ahora a Anfitriona,
-- mismo efecto que hubiera tenido el trigger si ya hubiera estado andando.
-- No genera registro (es un arreglo de algo viejo, no un envío de ahora).
update leads set estado = 'anfitriona_asignada' where estado = 'pdf_enviado';
