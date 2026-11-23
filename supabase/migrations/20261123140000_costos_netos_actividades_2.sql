-- Tarifas netas de las actividades restantes (23/11/2026).
-- Jet Ski, Buggy y Cuatriciclo cuestan por paseo (fijo, no por persona). Helicoptero: la agencia gana 10%,
-- por lo que el costo es el 90% del precio por pasajero.
-- Se crean dos actividades nuevas OCULTAS (activa = false) hasta que tengan foto y descripcion completa.

insert into excursiones (nombre, descripcion, destino, categoria, duracion, precio, precio_unidad, cupos, cupos_disponibles, dificultad, activa, horario_tipo, incluye)
select 'Jangada con buceo libre', 'Precio por persona.', 'Porto de Galinhas', 'excursiones', null, 90, 'persona', 30, 30, 'Mar', false, 'variable', '{}'
where not exists (select 1 from excursiones where nombre = 'Jangada con buceo libre');

insert into excursiones (nombre, descripcion, destino, categoria, duracion, precio, precio_unidad, cupos, cupos_disponibles, dificultad, activa, horario_tipo, incluye)
select 'Paseo en Helicóptero - Ruta B', 'Precio por persona.', 'Porto de Galinhas', 'excursiones', null, 700, 'persona', 30, 30, 'Aventura desde el aire', false, 'variable', '{}'
where not exists (select 1 from excursiones where nombre = 'Paseo en Helicóptero - Ruta B');

insert into costos_excursion (excursion_id, concepto, tipo, monto_por_persona, moneda, activo)
select e.id, 'Tarifa neta', v.tipo, v.monto, 'BRL', true
from (values
  ('66e2415a-9e08-4675-b28a-12c067ddb401'::uuid, 'por_paseo', 250),    -- Jet Ski (hasta 2 personas)
  ('d123b79b-da48-416a-9152-00c012453342'::uuid, 'por_paseo', 400),    -- Paseo en Buggy
  ('b239e202-f2a7-4ac2-986c-b94bfb8f60d4'::uuid, 'por_paseo', 250),    -- Paseo en Quad (cuatriciclo)
  ('249f8a75-a8cb-4f8e-8a28-8443cc23fc3b'::uuid, 'por_persona', 450)   -- Helicoptero Ruta A: 90% de 500
) as v(id, tipo, monto)
join excursiones e on e.id = v.id
where not exists (select 1 from costos_excursion c where c.excursion_id = v.id and c.activo and c.concepto = 'Tarifa neta');

insert into costos_excursion (excursion_id, concepto, tipo, monto_por_persona, moneda, activo)
select e.id, 'Tarifa neta', 'por_persona', v.monto, 'BRL', true
from (values ('Jangada con buceo libre', 60), ('Paseo en Helicóptero - Ruta B', 630)) as v(nombre, monto)
join excursiones e on e.nombre = v.nombre
where not exists (select 1 from costos_excursion c where c.excursion_id = e.id and c.activo and c.concepto = 'Tarifa neta');
