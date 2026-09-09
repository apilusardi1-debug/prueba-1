-- Vincula un movimiento de caja a un cliente (para el buscador con
-- autocompletado en Finanzas al registrar/editar un pago).
alter table movimientos_caja add column if not exists cliente_id uuid references clientes(id);
alter table movimientos_caja add column if not exists cliente_nombre text;
