-- Reemplaza el viejo campo "Presupuesto límite" del Generador de Propuesta
-- por un combo de qué pidió el cliente (mismos 3 valores que "incluye_simple"
-- + texto libre cuando no encaja en ninguno). presupuesto_limite se deja
-- como está (no se borra), solo deja de completarse desde el formulario.
alter table propuestas add column if not exists pedido_cliente text;
