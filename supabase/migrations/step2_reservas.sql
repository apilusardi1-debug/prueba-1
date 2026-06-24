-- reservas ya existe, agregamos los campos nuevos
ALTER TABLE reservas
  ADD COLUMN IF NOT EXISTS cliente_id      uuid references clientes(id) on delete set null,
  ADD COLUMN IF NOT EXISTS precio_unitario numeric,
  ADD COLUMN IF NOT EXISTS moneda          text default 'USD',
  ADD COLUMN IF NOT EXISTS hospedaje       text,
  ADD COLUMN IF NOT EXISTS vendedor_id     uuid references vendedores(id),
  ADD COLUMN IF NOT EXISTS updated_at      timestamp with time zone default now();

CREATE INDEX IF NOT EXISTS idx_reservas_cliente ON reservas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha   ON reservas (fecha);
