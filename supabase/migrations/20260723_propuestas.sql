-- Propuestas de paquetes: registro con estado (enviada/cerrada) para el
-- generador de propuestas del panel admin.
create table if not exists propuestas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id),
  cliente_nombre text not null,
  cliente_whatsapp text,
  items jsonb not null default '[]',
  total numeric not null default 0,
  moneda text not null default 'BRL',
  estado text not null default 'enviada',
  notas text,
  created_at timestamptz default now(),
  cerrada_at timestamptz
);

create index if not exists propuestas_estado_idx on propuestas (estado);
