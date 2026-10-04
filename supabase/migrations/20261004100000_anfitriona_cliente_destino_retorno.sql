-- Dos etapas nuevas al final del embudo de Anfitriona, despues de "Estadia
-- confirmada": "Cliente en destino" (se llega a mano) y "Retorno". Son de
-- posventa, por eso van como ganadas: no suman a "abiertos" en el Dashboard.
-- "Perdido" sigue siendo la ultima columna del tablero.
do $$
declare v_orden_confirmada integer;
begin
  select orden into v_orden_confirmada from embudo_etapas where clave = 'anfitriona_confirmada';

  if v_orden_confirmada is not null and not exists (select 1 from embudo_etapas where clave = 'anfitriona_cliente_destino') then
    update embudo_etapas
       set orden = orden + 2
     where embudo = 'anfitriona' and orden > v_orden_confirmada;

    insert into embudo_etapas (clave, nombre, orden, color, tipo, embudo) values
      ('anfitriona_cliente_destino', 'Cliente en destino', v_orden_confirmada + 1, '#a78bfa', 'ganada', 'anfitriona'),
      ('anfitriona_retorno',         'Retorno',            v_orden_confirmada + 2, '#38bdf8', 'ganada', 'anfitriona');
  end if;
end $$;
