-- Costos operativos por excursión: soporta dos tipos de costo.
--   'por_persona'    (ya existente) -> monto_por_persona x cantidad de pasajeros
--   'chofer_tramos'  (nuevo)        -> se paga una vez por chofer/auto asignado,
--                                      según tramo de cantidad de pasajeros.
--                                      tramos = [{ "hasta": 4, "monto": 280 }, { "hasta": 6, "monto": 330 }]

-- La tabla original se creó con la columna "monto" (no "monto_por_persona"),
-- pero el código del frontend siempre usó "monto_por_persona" -> quedaron
-- desincronizados. Este bloque renombra la columna solo si hace falta.
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'costos_excursion' and column_name = 'monto')
     and not exists (select 1 from information_schema.columns where table_name = 'costos_excursion' and column_name = 'monto_por_persona') then
    alter table costos_excursion rename column monto to monto_por_persona;
  end if;
end $$;

alter table costos_excursion add column if not exists tipo text not null default 'por_persona';
alter table costos_excursion add column if not exists tramos jsonb;
alter table costos_excursion alter column monto_por_persona drop not null;

-- Costo operativo calculado al asignar chofer a una reserva. Queda como
-- referencia informativa en la reserva, no genera movimiento de caja solo.
alter table reservas add column if not exists costo_operativo numeric(12, 2);
alter table reservas add column if not exists costo_operativo_moneda text default 'BRL';
alter table reservas add column if not exists costo_operativo_detalle jsonb;
