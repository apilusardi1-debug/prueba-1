-- Cantidad de pasajeros habitual del cliente, visible/editable en la
-- planilla de Clientes.
alter table clientes add column if not exists cantidad_pasajeros integer;
