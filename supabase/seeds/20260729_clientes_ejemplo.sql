-- 30 clientes de ejemplo (datos ficticios) para cargar la planilla de
-- Clientes: 20 Argentina, 6 Uruguay, 4 Chile. No es una migración de
-- esquema (no toca columnas) — es carga de datos, correr una sola vez.
insert into clientes (nombre, whatsapp, email, pais, ciudad, cantidad_pasajeros) values
  ('María González',     '5491122334455', 'maria.gonzalez@gmail.com',   'Argentina', 'Buenos Aires',      2),
  ('Juan Pérez',          '5493511234567', 'juan.perez@hotmail.com',     'Argentina', 'Córdoba',           4),
  ('Lucía Fernández',     '5493413456789', 'lucia.fernandez@gmail.com',  'Argentina', 'Rosario',           2),
  ('Martín Rodríguez',    '5492613456780', 'martin.rodriguez@gmail.com', 'Argentina', 'Mendoza',           3),
  ('Sofía López',         '5492213344556', 'sofia.lopez@outlook.com',    'Argentina', 'La Plata',          2),
  ('Diego Martínez',      '5492233344556', 'diego.martinez@gmail.com',   'Argentina', 'Mar del Plata',     5),
  ('Valentina Sánchez',   '5491133445566', 'valentina.sanchez@gmail.com','Argentina', 'Buenos Aires',      2),
  ('Nicolás Romero',      '5493873344556', 'nicolas.romero@hotmail.com', 'Argentina', 'Salta',             4),
  ('Camila Torres',       '5491144556677', 'camila.torres@gmail.com',    'Argentina', 'Buenos Aires',      1),
  ('Federico Díaz',       '5493813344556', 'federico.diaz@gmail.com',    'Argentina', 'San Miguel de Tucumán', 3),
  ('Agustina Ruiz',       '5492993344556', 'agustina.ruiz@outlook.com',  'Argentina', 'Neuquén',           2),
  ('Tomás Álvarez',       '5491155667788', 'tomas.alvarez@gmail.com',    'Argentina', 'Buenos Aires',      6),
  ('Julieta Gómez',       '5492913344556', 'julieta.gomez@gmail.com',    'Argentina', 'Bahía Blanca',      2),
  ('Santiago Flores',     '5493513344557', 'santiago.flores@hotmail.com','Argentina', 'Córdoba',           4),
  ('Florencia Acosta',    '5491166778899', 'florencia.acosta@gmail.com', 'Argentina', 'Buenos Aires',      2),
  ('Matías Benítez',      '5493413344558', 'matias.benitez@gmail.com',   'Argentina', 'Rosario',           3),
  ('Antonella Castro',    '5491177889900', 'antonella.castro@outlook.com','Argentina','San Isidro',        2),
  ('Facundo Molina',      '5491188990011', 'facundo.molina@gmail.com',   'Argentina', 'Buenos Aires',      5),
  ('Milagros Ortiz',      '5492213355667', 'milagros.ortiz@gmail.com',   'Argentina', 'La Plata',          2),
  ('Bruno Silva',         '5491199001122', 'bruno.silva@hotmail.com',    'Argentina', 'Vicente López',     4),

  ('Mateo Rodríguez',     '59891234567',  'mateo.rodriguez@gmail.com',  'Uruguay',   'Montevideo',        2),
  ('Emilia Pereira',      '59892345678',  'emilia.pereira@gmail.com',   'Uruguay',   'Montevideo',        3),
  ('Joaquín Fernández',   '59893456789',  'joaquin.fernandez@hotmail.com','Uruguay', 'Punta del Este',    4),
  ('Manuela Silva',       '59894567890',  'manuela.silva@gmail.com',    'Uruguay',   'Montevideo',        2),
  ('Ignacio Correa',      '59895678901',  'ignacio.correa@outlook.com', 'Uruguay',   'Salto',             2),
  ('Renata Bentancur',    '59896789012',  'renata.bentancur@gmail.com', 'Uruguay',   'Montevideo',        5),

  ('Vicente Muñoz',       '56912345678',  'vicente.munoz@gmail.com',    'Chile',     'Santiago',          2),
  ('Isidora Contreras',   '56923456789',  'isidora.contreras@hotmail.com','Chile',   'Valparaíso',        3),
  ('Benjamín Rojas',      '56934567890',  'benjamin.rojas@gmail.com',   'Chile',     'Santiago',          4),
  ('Antonia Vergara',     '56945678901',  'antonia.vergara@outlook.com','Chile',     'Concepción',        2);
