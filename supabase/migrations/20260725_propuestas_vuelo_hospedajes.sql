-- Datos estructurados para el PDF "Paquete de viaje" (aéreo + hospedajes),
-- réplica exacta del diseño que ya usa la agencia. Reemplaza el uso del
-- campo de texto libre "hospedajes" para este flujo — ese campo queda
-- como estaba, sin tocar, por si algo más lo sigue usando.
alter table propuestas add column if not exists vuelo jsonb;
alter table propuestas add column if not exists hospedajes_detalle jsonb;
