CREATE TABLE IF NOT EXISTS actividad_clientes (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid references clientes(id) on delete cascade,
  tipo        text not null,
  titulo      text not null,
  descripcion text,
  metadata    jsonb default '{}',
  created_at  timestamp with time zone default now()
);

CREATE TABLE IF NOT EXISTS notas_clientes (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid references clientes(id) on delete cascade,
  contenido   text not null,
  autor       text,
  created_at  timestamp with time zone default now()
);

CREATE INDEX IF NOT EXISTS idx_actividad_cliente ON actividad_clientes (cliente_id, created_at desc);
