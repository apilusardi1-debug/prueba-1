-- Datos que se completan al cerrar una propuesta, para el PDF de "Cierre de
-- propuesta" (código de reserva, vencimiento del saldo, y traslados como línea
-- aparte del total para el desglose de precio).
alter table propuestas add column if not exists codigo_reserva text;
alter table propuestas add column if not exists vencimiento_saldo date;
alter table propuestas add column if not exists traslados numeric;
