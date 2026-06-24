ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS email             text,
  ADD COLUMN IF NOT EXISTS pais              text,
  ADD COLUMN IF NOT EXISTS ciudad            text,
  ADD COLUMN IF NOT EXISTS total_gastado     numeric default 0,
  ADD COLUMN IF NOT EXISTS cantidad_reservas int default 0;
