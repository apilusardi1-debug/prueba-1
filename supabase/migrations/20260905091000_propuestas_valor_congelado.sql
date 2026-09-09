-- Valor equivalente en reales "congelado" al momento del cierre (ej: el saldo
-- se cobra en ARS pero se le muestra al cliente cuanto es en BRL a un tipo de
-- cambio fijado ese dia) — dato manual, no hay conversion automatica en el
-- sistema. Opcional: si queda vacio, esa linea no aparece en el PDF de cierre.
alter table propuestas add column if not exists valor_congelado_brl numeric;
