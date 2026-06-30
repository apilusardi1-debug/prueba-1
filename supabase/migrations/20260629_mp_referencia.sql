-- Columna para vincular movimientos de caja con pagos de Mercado Pago
-- Usada por mp-webhook para evitar duplicados
alter table movimientos_caja
  add column if not exists referencia_mp text unique;
