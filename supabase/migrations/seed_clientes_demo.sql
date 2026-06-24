-- Clientes de demo
INSERT INTO clientes (nombre, whatsapp, email, pais, ciudad, notas, total_gastado, cantidad_reservas) VALUES
  ('María Rodríguez',  '5491134567890', 'maria.rod@gmail.com',   'Argentina', 'Buenos Aires', 'Le gusta los paquetes premium. Prefiere salidas en la mañana.', 1200, 3),
  ('Carlos Mendes',    '5511987654321', 'cmendes@hotmail.com',   'Brasil',    'São Paulo',    'Viene todos los veranos. Cliente VIP.', 2800, 6),
  ('Lucía Torres',     '5491167890123', 'ltorres@gmail.com',     'Argentina', 'Córdoba',      'Primera vez. Interesada en Maceió.', 0, 0),
  ('Pedro Alves',      '5521994561234', 'pedro.alves@gmail.com', 'Brasil',    'Rio de Janeiro','Reservó para grupo familiar de 4 personas.', 950, 2),
  ('Ana Gómez',        '5981234567890', 'ana.gomez@yahoo.com',   'Uruguay',   'Montevideo',   'Contactada por Instagram.', 400, 1),
  ('Roberto Silva',    '5511876543219', 'rsilva@empresa.com.br', 'Brasil',    'Belo Horizonte', 'Ejecutivo. Prefiere traslados privados.', 3500, 7)
ON CONFLICT (whatsapp) DO NOTHING;

-- Reservas vinculadas (incluyendo cliente_nombre requerido por constraint viejo)
INSERT INTO reservas (cliente_id, cliente_nombre, cliente_whatsapp, excursion_id, fecha, personas, precio_unitario, total, moneda, estado, hospedaje)
SELECT
  c.id,
  c.nombre,
  c.whatsapp,
  (SELECT id FROM excursiones ORDER BY random() LIMIT 1),
  date '2026-07-15' + ((row_number() OVER ()) * 7 || ' days')::interval,
  2,
  150,
  300,
  'USD',
  CASE (row_number() OVER ()) % 3
    WHEN 0 THEN 'completada'
    WHEN 1 THEN 'confirmada'
    ELSE 'pendiente'
  END,
  'Hotel Costa Mar'
FROM clientes c
WHERE c.nombre IN ('María Rodríguez','Carlos Mendes','Pedro Alves','Ana Gómez');
