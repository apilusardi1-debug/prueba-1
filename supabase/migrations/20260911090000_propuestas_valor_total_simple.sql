-- Propuesta Simple: valor de venta único del paquete completo, cargado a
-- mano (no la suma automática de vuelo+traslado+hospedaje) — y qué combo de
-- servicios incluye ese total. Null en Combinada, donde cada servicio ya
-- tiene su propio precio por separado.
alter table propuestas add column if not exists valor_total_simple numeric;
alter table propuestas add column if not exists incluye_simple text;
