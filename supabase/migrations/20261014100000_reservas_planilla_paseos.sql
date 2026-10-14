-- Reservas como la planilla del equipo de paseos (Excel "NUEVA PLANILLA"), para que
-- carguen las reservas en el admin igual que en el Excel. Pedido de Abril, 2026-10-13.
--
-- Columnas del Excel → reservas:
--   FECHA (de venta)     → fecha_venta
--   NOMBRE CLIENTE       → cliente_nombre        (ya existía)
--   CTDAD                → personas              (ya existía)
--   PASEO                → paseo (+ excursion_id si es un paseo del catálogo)
--   (fecha del paseo)    → fecha                 (ya existía)
--   VALOR VENTA          → total                 (ya existía)
--   SALDO CLIENTE        → saldo_cliente
--   CHOFER DEL DIA       → chofer_texto
--   COMISION CHOFER      → comision_chofer
--   HOSPEDAJE            → hospedaje             (ya existía)
--   OBS                  → notas                 (ya existía)
--   VALOR (seña = comisión del vendedor) → sena
--   CONTACTO CLIENTE     → cliente_whatsapp      (ya existía)
--   VENDEDORES           → vendedor_texto
-- COMISION DREAM no va por reserva: el equipo la carga por día → comisiones_agencia_diarias.

alter table reservas add column if not exists fecha_venta date;
-- Nombre del paseo tal como se muestra. Los paseos del catálogo además tienen excursion_id;
-- los traslados ("Traslado Porto → Aeropuerto Recife") y los paseos que no están en la web
-- ("Jangada") quedan solo con este texto.
alter table reservas add column if not exists paseo text;
-- Paseo vendido sin traslado: el cliente va por su cuenta (en su auto, en lancha, etc.)
alter table reservas add column if not exists sin_traslado boolean not null default false;
-- Chofer del día como lo escribe el equipo ("Lourdes + guía"); chofer_id sigue siendo el
-- que se asigna desde la Agenda.
alter table reservas add column if not exists chofer_texto text;
alter table reservas add column if not exists comision_chofer numeric(12, 2);
alter table reservas add column if not exists saldo_cliente numeric(12, 2);
-- Seña que paga el cliente antes del paseo; es también la comisión de quien lo vendió
alter table reservas add column if not exists sena numeric(12, 2);
alter table reservas add column if not exists vendedor_texto text;
-- De dónde salió: 'planilla' para las importadas del Excel. clave_planilla reconoce cada
-- fila del Excel en las actualizaciones (fecha de venta + cliente + paseo + fecha del paseo),
-- para cargar solo lo nuevo o lo que cambió.
alter table reservas add column if not exists origen text;
alter table reservas add column if not exists clave_planilla text;
create unique index if not exists reservas_clave_planilla_key on reservas (clave_planilla) where clave_planilla is not null;

-- Las reservas cargadas en el admin no tienen precio por persona (se vende por total)
alter table reservas alter column precio_unitario drop not null;
-- En la planilla hay reservas sin contacto
alter table reservas alter column cliente_whatsapp drop not null;

-- Comisión de la agencia por día (en el Excel, "COMISION DREAM", cargada una vez por día)
create table if not exists comisiones_agencia_diarias (
  id          uuid primary key default gen_random_uuid(),
  fecha       date not null unique,
  monto       numeric(12, 2) not null,
  moneda      text not null default 'BRL',
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- Sin policies: solo se lee y escribe por catalogo-interno (sesión del panel)
alter table comisiones_agencia_diarias enable row level security;
