-- ─────────────────────────────────────────────────────────────
-- DREAMTOURS · HISTORIAL DE CLIENTES
-- ─────────────────────────────────────────────────────────────

-- 1. Campos nuevos en clientes
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS email             text,
  ADD COLUMN IF NOT EXISTS pais              text,
  ADD COLUMN IF NOT EXISTS ciudad            text,
  ADD COLUMN IF NOT EXISTS lead_id           uuid references leads(id),
  ADD COLUMN IF NOT EXISTS total_gastado     numeric default 0,
  ADD COLUMN IF NOT EXISTS cantidad_reservas int default 0;

-- 2. Link conversaciones con clientes
ALTER TABLE conversaciones
  ADD COLUMN IF NOT EXISTS cliente_id uuid references clientes(id);

-- 3. Reservas (relacionales)
CREATE TABLE IF NOT EXISTS reservas (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid references clientes(id) on delete set null,
  excursion_id     uuid references excursiones(id) on delete set null,
  fecha            date not null,
  personas         int not null default 1,
  precio_unitario  numeric not null,
  total            numeric not null,
  moneda           text not null default 'USD',
  estado           text not null default 'pendiente',
  hospedaje        text,
  chofer_id        uuid references choferes(id),
  guia_id          uuid references guias(id),
  vendedor_id      uuid references vendedores(id),
  notas            text,
  created_at       timestamp with time zone default now(),
  updated_at       timestamp with time zone default now()
);

-- 4. Pagos
CREATE TABLE IF NOT EXISTS pagos (
  id               uuid primary key default gen_random_uuid(),
  reserva_id       uuid references reservas(id) on delete cascade,
  cliente_id       uuid references clientes(id) on delete set null,
  monto            numeric not null,
  moneda           text not null default 'USD',
  metodo           text not null,
  estado           text not null default 'pendiente',
  fecha_pago       date,
  comprobante_url  text,
  notas            text,
  created_at       timestamp with time zone default now()
);

-- 5. Timeline de actividad por cliente
CREATE TABLE IF NOT EXISTS actividad_clientes (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid references clientes(id) on delete cascade,
  tipo        text not null,
  titulo      text not null,
  descripcion text,
  metadata    jsonb default '{}',
  created_at  timestamp with time zone default now()
);

-- 6. Notas internas por cliente
CREATE TABLE IF NOT EXISTS notas_clientes (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid references clientes(id) on delete cascade,
  contenido   text not null,
  autor       text,
  created_at  timestamp with time zone default now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_reservas_cliente  ON reservas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha    ON reservas (fecha);
CREATE INDEX IF NOT EXISTS idx_pagos_reserva     ON pagos (reserva_id);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente     ON pagos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_actividad_cliente ON actividad_clientes (cliente_id, created_at desc);
