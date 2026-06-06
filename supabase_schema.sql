-- ================================================================
-- SCHEMA SUPABASE · Turismo App
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

-- Extensión para UUIDs
create extension if not exists "pgcrypto";

-- ── Excursiones ────────────────────────────────────────────────
create table excursiones (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  descripcion   text,
  destino       text,
  categoria     text,
  duracion      text,
  precio        integer not null default 0,
  cupos         integer not null default 10,
  cupos_disponibles integer not null default 10,
  imagen        text,
  dificultad    text,
  fechas        text[] default '{}',
  incluye       text[] default '{}',
  activa        boolean default true,
  created_at    timestamptz default now()
);

-- ── Clientes ───────────────────────────────────────────────────
create table clientes (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  whatsapp      text unique,
  email         text,
  origen        text,
  estado        text default 'activo' check (estado in ('activo', 'vip', 'inactivo')),
  notas         text default '',
  created_at    timestamptz default now(),
  ultima_actividad timestamptz default now()
);

-- ── Reservas ───────────────────────────────────────────────────
create table reservas (
  id                uuid primary key default gen_random_uuid(),
  cliente_id        uuid references clientes(id),
  cliente_nombre    text not null,
  cliente_whatsapp  text,
  excursion_id      uuid references excursiones(id),
  fecha             date not null,
  personas          integer not null default 1,
  total             integer not null default 0,
  pagado            integer not null default 0,
  estado            text default 'pendiente' check (estado in ('pendiente', 'confirmada', 'cancelada')),
  notas             text default '',
  created_at        timestamptz default now()
);

-- ── Leads ──────────────────────────────────────────────────────
create table leads (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  whatsapp          text,
  email             text,
  excursion_interes text,
  excursion_id      uuid references excursiones(id),
  origen            text default 'Web',
  estado            text default 'nuevo' check (estado in ('nuevo', 'contactado', 'reservado', 'perdido')),
  notas             text default '',
  created_at        timestamptz default now()
);

-- ── Row Level Security ─────────────────────────────────────────
-- Excursiones: lectura pública, escritura solo autenticados
alter table excursiones enable row level security;
create policy "excursiones_select_public" on excursiones for select using (true);
create policy "excursiones_all_auth" on excursiones for all using (auth.role() = 'authenticated');

-- Reservas: inserción pública (los clientes pueden reservar), gestión solo autenticados
alter table reservas enable row level security;
create policy "reservas_insert_public" on reservas for insert with check (true);
create policy "reservas_select_by_whatsapp" on reservas for select using (true);
create policy "reservas_update_auth" on reservas for update using (auth.role() = 'authenticated');

-- Leads: solo autenticados
alter table leads enable row level security;
create policy "leads_insert_public" on leads for insert with check (true);
create policy "leads_all_auth" on leads for all using (auth.role() = 'authenticated');

-- Clientes: solo autenticados
alter table clientes enable row level security;
create policy "clientes_all_auth" on clientes for all using (auth.role() = 'authenticated');

-- ── Índices ────────────────────────────────────────────────────
create index on reservas(cliente_whatsapp);
create index on reservas(fecha);
create index on leads(estado);
create index on leads(created_at desc);
