-- Asistente automatico del CRM: saluda al primer mensaje, pregunta si el
-- contacto busca Paquetes o Paseos y asigna la conversacion en turnos entre
-- los integrantes de ese grupo. Arranca APAGADO (activo = false) hasta que se
-- configure desde Configuracion -> Asistente.

alter table conversaciones
  add column if not exists bot_estado    text,
  add column if not exists bot_intentos  int not null default 0,
  add column if not exists grupo         text;

alter table mensajes
  add column if not exists origen text;

create table if not exists bot_config (
  id                  int primary key default 1 check (id = 1),
  activo              boolean not null default false,
  saludo              text not null default 'Hola! Gracias por escribirle a Dream Tours. ¿Qué estás buscando?',
  mensaje_derivacion  text not null default 'Perfecto! {nombre} del equipo de {grupo} te va a atender en breve.',
  mensaje_sin_asignar text not null default 'Gracias por escribirnos! Un integrante del equipo te va a responder en breve.'
);

insert into bot_config (id) values (1) on conflict (id) do nothing;

create table if not exists bot_reparto (
  id                uuid primary key default gen_random_uuid(),
  grupo             text not null check (grupo in ('paquetes', 'paseos')),
  usuario_id        uuid not null references usuarios_admin(id) on delete cascade,
  ultima_asignacion timestamptz,
  unique (grupo, usuario_id)
);

do $$
declare
  tabla text;
  pol record;
begin
  foreach tabla in array array['bot_config', 'bot_reparto']
  loop
    execute format('alter table %I enable row level security;', tabla);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = tabla loop
      execute format('drop policy %I on %I;', pol.policyname, tabla);
    end loop;
    execute format('create policy "acceso_total_temporal" on %I for all using (true) with check (true);', tabla);
  end loop;
end $$;
