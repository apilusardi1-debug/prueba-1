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

CREATE INDEX IF NOT EXISTS idx_pagos_reserva  ON pagos (reserva_id);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente  ON pagos (cliente_id);
