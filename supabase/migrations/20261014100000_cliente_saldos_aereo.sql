-- Saldos del cliente: se agrega el concepto "Aéreo" (pasajes), pedido de Cristian el
-- 2026-10-14. La lista de la pantalla está en CONCEPTOS_SALDO_CLIENTE (Clientes.jsx).
-- Se reemplaza la regla que limita los conceptos permitidos, buscándola por lo que
-- controla (no por su nombre, que Postgres le puso solo al crear la tabla).
do $$
declare regla text;
begin
  for regla in
    select c.conname
      from pg_constraint c
     where c.conrelid = 'public.cliente_saldos'::regclass
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) like '%concepto%'
  loop
    execute format('alter table cliente_saldos drop constraint %I', regla);
  end loop;
end $$;

alter table cliente_saldos add constraint cliente_saldos_concepto_check
  check (concepto in ('paquetes', 'paseos', 'aereo', 'traslados', 'hospedaje', 'restaurante', 'otros'));
