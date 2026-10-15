-- Viajes de paquetes como la planilla de Excel del equipo de paquetes ("PLANILLA VIAJES",
-- pestañas VIAJES y YA SE FUERON), para que carguen los viajes en el admin
-- (Paquetes > Planilla) igual que en el Excel. Pedido de Abril, 2026-10-14.
--
-- Columnas del Excel → viajes_paquetes:
--   HORA LLEGADA                 → hora_llegada        (texto: a veces dice "preguntar")
--   FECHA DE VIAJE               → fecha_llegada
--   NOMBRE CLIENTE               → cliente_nombre
--   CTDAD                        → personas
--   HOSPEDAJE                    → hospedaje
--   FECHA DE REGRESO             → fecha_regreso
--   HORARIO DE REGRESO           → hora_regreso
--   SALDOS                       → saldo (+ moneda)
--   LLAVE PIX                    → llave_pix           (a quién se le paga el hospedaje)
--   OBSERVACIONES                → observaciones
--   CONTACTO                     → contacto_hospedaje  (dueño o encargado del hospedaje)
--   LINK DETALLES Y SERVICIOS    → detalles_texto + detalles_url (el PDF/Canva del viaje)
--   CONTACTO CLIENTE             → cliente_contacto    (texto: puede tener más de un número)
--   INFORMACION EXTRA            → info_extra
-- "Ya se fueron" no es una columna: es todo viaje con fecha de regreso (o de llegada, si no
-- tiene regreso) anterior a hoy.

create table if not exists viajes_paquetes (
  id                  uuid primary key default gen_random_uuid(),
  hora_llegada        text,
  fecha_llegada       date,
  cliente_nombre      text not null,
  personas            integer,
  hospedaje           text,
  fecha_regreso       date,
  hora_regreso        text,
  saldo               numeric(12, 2),
  moneda              text not null default 'BRL',
  llave_pix           text,
  observaciones       text,
  contacto_hospedaje  text,
  detalles_texto      text,
  detalles_url        text,
  cliente_contacto    text,
  info_extra          text,
  -- 'planilla' para los importados del Excel. clave_planilla reconoce cada fila del Excel
  -- en las actualizaciones (cliente + fecha de viaje), para cargar solo lo nuevo o lo que cambió.
  origen              text,
  clave_planilla      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index if not exists viajes_paquetes_clave_planilla_key on viajes_paquetes (clave_planilla) where clave_planilla is not null;
create index if not exists viajes_paquetes_fecha_llegada_idx on viajes_paquetes (fecha_llegada);

-- Sin policies: tiene datos de clientes, solo se lee y escribe por catalogo-interno
-- (sesión del panel)
alter table viajes_paquetes enable row level security;
