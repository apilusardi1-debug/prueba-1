-- Quién registró cada movimiento de caja, tomado automáticamente de la
-- sesión del panel (no se tipea a mano).
alter table movimientos_caja add column if not exists registrado_por text;
