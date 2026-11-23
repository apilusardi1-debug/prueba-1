-- Finanzas conectada a las planillas (Fase A: paseos y paquetes).
-- Solo agrega columnas opcionales: no cambia ni borra ningun dato existente.

-- Cada movimiento puede saber de que reserva / viaje salio y quien cobro.
--   origen: 'cobro_paseo' | 'cobro_paquete' | 'liquidacion_chofer' | 'liquidacion_vendedor' | NULL (carga manual)
--   cobrador: quien tuvo la plata ('Guia', 'Vendedor', 'Francisco', un nombre...)
-- Sin clave foranea a proposito: borrar una reserva no debe borrar el historial de caja.
alter table movimientos_caja add column if not exists reserva_id uuid;
alter table movimientos_caja add column if not exists viaje_id uuid;
alter table movimientos_caja add column if not exists origen text;
alter table movimientos_caja add column if not exists cobrador text;
create index if not exists idx_movimientos_reserva on movimientos_caja(reserva_id);
create index if not exists idx_movimientos_viaje on movimientos_caja(viaje_id);

-- Comision del chofer: queda "por pagar" hasta que se liquida (fecha en que se le pago).
-- comision_chofer_liq_id: el movimiento de caja (egreso) con el que se pagó, para poder deshacerlo.
alter table reservas add column if not exists comision_chofer_pagada_at date;
alter table reservas add column if not exists comision_chofer_liq_id uuid;
