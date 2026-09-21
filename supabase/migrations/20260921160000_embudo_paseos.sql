-- Segundo embudo de ventas: Paseos. El de siempre pasa a ser el de Paquetes.
-- Cada etapa pertenece a un embudo y un lead esta en el embudo de su etapa, asi
-- que no hace falta tocar la tabla de leads. Las claves de las etapas siguen
-- siendo unicas en todo el sistema (leads.estado guarda la clave), por eso las de
-- Paseos llevan el prefijo "paseos_".
--
-- Etapas de Paseos (como el embudo PASSEIOS de Kommo, mas "Confirmada"):
--   Contato inicial -> Oferta feita -> Negociação -> Confirmada (ganada)
-- y "Perdido", que queda oculto con el filtro "Leads activos".

alter table embudo_etapas add column if not exists embudo text not null default 'paquetes'
  check (embudo in ('paquetes', 'paseos'));

insert into embudo_etapas (clave, nombre, orden, color, tipo, embudo) values
  ('paseos_contacto_inicial', 'Contato inicial', 1, '#7ec4f2', 'abierta', 'paseos'),
  ('paseos_oferta_hecha',     'Oferta feita',    2, '#f2e26a', 'abierta', 'paseos'),
  ('paseos_negociacion',      'Negociação',      3, '#f5b552', 'abierta', 'paseos'),
  ('paseos_confirmada',       'Confirmada',      4, '#34c38f', 'ganada',  'paseos'),
  ('paseos_perdido',          'Perdido',         5, '#9ca3af', 'perdida', 'paseos')
on conflict (clave) do nothing;
