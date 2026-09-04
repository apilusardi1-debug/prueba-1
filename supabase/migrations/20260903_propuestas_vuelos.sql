-- Propuesta combinada: puede tener mas de un vuelo (ej: un tramo interno entre
-- destinos). "vuelo" sigue siendo el primero, sin cambios, para todo lo que ya
-- lo lee (modal de cierre, PDF de cierre); "vuelos" es el array completo.
alter table propuestas add column if not exists vuelos jsonb;
