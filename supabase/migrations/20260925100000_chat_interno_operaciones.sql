-- Chat interno para avisar a guías y choferes al cerrar una operación (Agenda), en vez de
-- mandarles una plantilla de WhatsApp por Meta. El aviso al CLIENTE sigue por WhatsApp, sin
-- cambios; solo se saca de Meta lo que antes iban `aviso_guia` y `aviso_chofer`.
--
-- Diseño acordado con Cristian: cada guía y cada chofer tiene un link personal, sin
-- contraseña (su "token"), instalable como una paginita aparte del panel admin. Ahí ve el
-- mensaje de la operación (mismo formato que ya usa Francisco: SAÍDA, passageiros, contato,
-- hospedagem — en portugués, como hablan entre ellos), un botón "Recebido", y por cada
-- pasajero un botón que abre WhatsApp con el mensaje ya escrito para que se lo manden ellos
-- mismos, gratis, desde su propio celular (no sale por la API de Meta).

-- Un link permanente por persona (no uno nuevo por operación)
alter table guias add column if not exists token uuid not null default gen_random_uuid();
alter table choferes add column if not exists token uuid not null default gen_random_uuid();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'guias_token_key') then
    alter table guias add constraint guias_token_key unique (token);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'choferes_token_key') then
    alter table choferes add constraint choferes_token_key unique (token);
  end if;
end $$;

-- Una fila por excursión+fecha que se cerró (antes "cerrar operación" no dejaba rastro en la
-- base, solo mandaba mensajes). Sirve para agrupar los avisos y saber cuándo y quién la cerró.
create table if not exists operaciones (
  id           uuid primary key default gen_random_uuid(),
  excursion_id uuid not null references excursiones(id) on delete cascade,
  fecha        date not null,
  guia_id      uuid references guias(id) on delete set null,
  cerrada_at   timestamptz not null default now(),
  cerrada_por  text,
  unique (excursion_id, fecha)
);

-- Un aviso por guía o por chofer (el mensaje ya armado, en portugués, y los pasajeros que le
-- corresponden a esa persona con el texto que le va a mandar a cada uno por WhatsApp). Si se
-- vuelve a cerrar la misma operación (por ejemplo, cambió un chofer), se reemplazan los avisos
-- viejos por los nuevos.
create table if not exists operaciones_avisos (
  id            uuid primary key default gen_random_uuid(),
  operacion_id  uuid not null references operaciones(id) on delete cascade,
  destinatario  text not null check (destinatario in ('guia', 'chofer')),
  guia_id       uuid references guias(id) on delete cascade,
  chofer_id     uuid references choferes(id) on delete cascade,
  mensaje       text not null,
  pasajeros     jsonb not null default '[]'::jsonb,
  leido_at      timestamptz,
  confirmado_at timestamptz,
  created_at    timestamptz not null default now(),
  constraint operaciones_avisos_destinatario_valido check (
    (destinatario = 'guia' and guia_id is not null and chofer_id is null) or
    (destinatario = 'chofer' and chofer_id is not null and guia_id is null)
  )
);

create index if not exists idx_operaciones_avisos_operacion on operaciones_avisos (operacion_id);
create index if not exists idx_operaciones_avisos_guia on operaciones_avisos (guia_id) where guia_id is not null;
create index if not exists idx_operaciones_avisos_chofer on operaciones_avisos (chofer_id) where chofer_id is not null;

-- El link personal (guía/chofer, sin sesión de admin) necesita poder leer estas tablas con la
-- llave anónima. Misma política que ya usa el resto del panel (acceso_total_temporal): lo que
-- protege el aviso es que el token es imposible de adivinar, no una contraseña.
do $$
declare
  tabla text;
  pol record;
begin
  foreach tabla in array array['operaciones', 'operaciones_avisos']
  loop
    execute format('alter table %I enable row level security;', tabla);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = tabla loop
      execute format('drop policy %I on %I;', pol.policyname, tabla);
    end loop;
    execute format('create policy "acceso_total_temporal" on %I for all using (true) with check (true);', tabla);
  end loop;
end $$;
