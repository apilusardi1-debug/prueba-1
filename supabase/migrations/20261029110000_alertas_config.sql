-- Alertas de operaciones (pedido de Cristian, 2026-10-29): la configuración (qué alertas están
-- prendidas y sus horas/días) se guarda en la fila única de site_config. Escribir pasa por
-- catalogo-interno, que ya está desplegado, así que esto no necesita ninguna función nueva.
--
-- Solo agrega una columna: no cambia nada de lo que ya existe. La web pública lee site_config
-- entera, pero acá solo hay horas y días de avisos internos, nada sensible.

alter table site_config add column if not exists alertas_config jsonb;

-- Control: tiene que decir alertas_config
select column_name from information_schema.columns
 where table_name = 'site_config' and column_name = 'alertas_config';
