-- Detalle de la propuesta: hospedajes, fechas de vuelo, y desglose de pago
-- (seña / restante) para poder ver una descripcion completa al hacer click.
alter table propuestas add column if not exists hospedajes text;
alter table propuestas add column if not exists fecha_ida date;
alter table propuestas add column if not exists fecha_vuelta date;
alter table propuestas add column if not exists sena numeric not null default 0;
