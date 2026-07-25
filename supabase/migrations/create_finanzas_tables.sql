-- Tabla de movimientos de caja
create table if not exists movimientos_caja (
  id            uuid primary key default gen_random_uuid(),
  fecha         date not null,
  tipo          text not null check (tipo in ('ingreso', 'egreso')),
  categoria     text not null default 'otro',
  concepto      text not null,
  monto         numeric(12, 2) not null,
  moneda        text not null default 'USD' check (moneda in ('USD', 'BRL', 'ARS')),
  persona_nombre text,
  metodo        text default 'efectivo' check (metodo in ('efectivo', 'transferencia', 'qr', 'tarjeta', 'otro')),
  estado        text default 'confirmado' check (estado in ('confirmado', 'pendiente', 'anulado')),
  notas         text,
  referencia_mp text unique,  -- ID del pago de Mercado Pago (evita duplicados)
  created_at    timestamptz default now()
);

-- Tabla de costos por excursión
create table if not exists costos_excursion (
  id           uuid primary key default gen_random_uuid(),
  excursion_id uuid references excursiones(id) on delete cascade,
  concepto     text not null,
  monto        numeric(12, 2) not null,
  moneda       text not null default 'USD',
  activo       boolean default true,
  created_at   timestamptz default now()
);

-- Índices para performance
create index if not exists idx_movimientos_fecha on movimientos_caja(fecha desc);
create index if not exists idx_movimientos_tipo on movimientos_caja(tipo);
create index if not exists idx_movimientos_mp on movimientos_caja(referencia_mp);

-- RLS: solo usuarios autenticados pueden leer/escribir
alter table movimientos_caja enable row level security;
alter table costos_excursion enable row level security;

create policy "auth users only" on movimientos_caja for all using (auth.role() = 'authenticated');
create policy "auth users only" on costos_excursion for all using (auth.role() = 'authenticated');

-- El webhook usa service_role_key entonces puede bypassear RLS
