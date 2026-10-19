-- Parceros (pedido de Abril, 2026-10-19): influencers, agencias y otros que recomiendan
-- DreamTours y derivan contactos ("vengo de parte de Sol", "de parte de Vivo Porto"). La lista
-- se arma en Configuración > Parceros; en el chat del CRM se elige el parcero del contacto y
-- queda en su lead (leads.parcero_id). La lista del CRM filtra por parcero con la cantidad.
-- Misma política abierta que leads (todavía sin pasar por catalogo-interno).

create table if not exists parceros (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists parceros_nombre_unico on parceros (lower(nombre));

alter table parceros enable row level security;
drop policy if exists "acceso_total_temporal" on parceros;
create policy "acceso_total_temporal" on parceros for all using (true) with check (true);

alter table leads add column if not exists parcero_id uuid references parceros(id) on delete set null;
create index if not exists leads_parcero_idx on leads (parcero_id) where parcero_id is not null;
