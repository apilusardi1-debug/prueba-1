-- Datos de intake que reemplazan hospedajes/fechas/seña en el formulario
-- del Generador de propuesta: ahora se captura el pedido inicial del
-- cliente (cuántos pasajeros, período y presupuesto límite). Hospedajes,
-- fechas y seña se siguen pudiendo cargar más adelante desde el panel de
-- edición en Clientes (Paquetes), una vez que el paquete está definido.
alter table propuestas add column if not exists cantidad_pasajeros integer;
alter table propuestas add column if not exists periodo text;
alter table propuestas add column if not exists presupuesto_limite numeric(12, 2);
