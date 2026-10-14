-- Ficha única del cliente (pedido de Cristian, 2026-10-14): una persona tiene UN solo
-- listado de saldos, sea lead, cliente o las dos cosas. Hasta ahora había dos tablas que
-- se llenaban por separado: anfitriona_saldos (ficha del lead de Anfitriona) y
-- cliente_saldos (ficha de Clientes). Esta tabla las reemplaza: cada saldo queda ligado
-- al lead, al cliente o a los dos, y la ficha muestra los de ambos.
--
-- Las dos tablas viejas NO se borran: se copian acá y quedan como respaldo por si hubiera
-- que volver a la ficha anterior.

create table if not exists saldos (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid references leads(id) on delete cascade,
  cliente_id  uuid references clientes(id) on delete cascade,
  concepto    text not null default 'paquetes'
              check (concepto in ('paquetes', 'paseos', 'aereo', 'traslados', 'hospedaje', 'restaurante', 'otros')),
  descripcion text,
  monto       numeric(12, 2) not null default 0 check (monto >= 0),
  pagado      numeric(12, 2) not null default 0 check (pagado >= 0),
  created_at  timestamptz not null default now(),
  constraint saldos_de_alguien check (lead_id is not null or cliente_id is not null)
);

create index if not exists idx_saldos_lead on saldos (lead_id);
create index if not exists idx_saldos_cliente on saldos (cliente_id);

-- Copia de lo ya cargado (mismo id, así se puede correr más de una vez sin duplicar)
insert into saldos (id, lead_id, concepto, descripcion, monto, pagado, created_at)
select id, lead_id, concepto, descripcion, monto, pagado, created_at from anfitriona_saldos
on conflict (id) do nothing;

insert into saldos (id, cliente_id, concepto, descripcion, monto, pagado, created_at)
select id, cliente_id, concepto, descripcion, monto, pagado, created_at from cliente_saldos
on conflict (id) do nothing;

-- Sin acceso con la clave pública (datos de pago de clientes): se lee y escribe solo por
-- la función catalogo-interno, que exige la sesión del panel.
alter table saldos enable row level security;
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'saldos' loop
    execute format('drop policy %I on saldos;', pol.policyname);
  end loop;
end $$;
