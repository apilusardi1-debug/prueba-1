-- No todos los paseos se cobran por persona: el Buggy, el Jet Ski y el Quad
-- se cobran por vehículo/paseo completo (con varias personas incluidas), la
-- Fotografía submarina por sesión y los Traslados por traslado. La ficha
-- pública mostraba "Precio por persona" siempre, sin importar el paseo.

alter table excursiones add column if not exists precio_unidad text not null default 'persona';
