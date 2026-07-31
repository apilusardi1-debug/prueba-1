-- Completa el perfil de los 30 clientes de ejemplo (20260729_clientes_ejemplo.sql)
-- con 1 reserva (paseo), sus notas y, cuando corresponde, un pago
-- registrado — todo en BRL, nunca USD. Pensado para correr una sola vez,
-- después de haber cargado los 30 clientes.
-- Cada cliente se procesa en su propio bloque try/catch: si algo falla
-- para uno (por ejemplo si la tabla "pagos" tiene alguna columna
-- distinta a la esperada), sigue con el resto en vez de cortar todo.
do $$
declare
  cli record;
  v_reserva_id uuid;
  v_excursion_id uuid;
  v_fecha date;
  v_total numeric;
  v_pagado numeric;
  v_estado text;
  v_metodo text;
  v_nota text;
  i integer := 0;
  notas text[] := array[
    'Cliente interesado en paquetes de playa, prefiere contacto por WhatsApp.',
    'Ya viajó con nosotros antes, muy conforme con el servicio.',
    'Pidió cotización para viajar en grupo familiar.',
    'Contactado por Instagram, consultando por fechas de temporada alta.',
    'Prefiere pagos en efectivo, coordinar con anticipación.',
    'Consultó por excursiones opcionales antes de confirmar el viaje.'
  ];
  metodos text[] := array['transferencia', 'efectivo', 'tarjeta', 'qr'];
begin
  for cli in
    select id, nombre, whatsapp, cantidad_pasajeros
    from clientes
    where whatsapp in (
      '5491122334455','5493511234567','5493413456789','5492613456780','5492213344556',
      '5492233344556','5491133445566','5493873344556','5491144556677','5493813344556',
      '5492993344556','5491155667788','5492913344556','5493513344557','5491166778899',
      '5493413344558','5491177889900','5491188990011','5492213355667','5491199001122',
      '59891234567','59892345678','59893456789','59894567890','59895678901','59896789012',
      '56912345678','56923456789','56934567890','56945678901'
    )
  loop
    i := i + 1;
    begin
      select id into v_excursion_id from excursiones where activa = true order by random() limit 1;

      v_estado := (array['completada','completada','confirmada','confirmada','pendiente'])[1 + (i % 5)];
      if v_estado = 'completada' then
        v_fecha := current_date - ((5 + i * 3) || ' days')::interval;
      else
        v_fecha := current_date + ((5 + i * 3) || ' days')::interval;
      end if;

      v_total := 800 * coalesce(cli.cantidad_pasajeros, 2) + (i * 37);
      v_pagado := case (i % 3)
        when 0 then v_total
        when 1 then round(v_total * 0.5)
        else 0
      end;

      insert into reservas (
        cliente_id, cliente_nombre, cliente_whatsapp, excursion_id,
        fecha, adultos, menores, personas, total, moneda, estado, pagado
      ) values (
        cli.id, cli.nombre, cli.whatsapp, v_excursion_id,
        v_fecha, coalesce(cli.cantidad_pasajeros, 2), 0, coalesce(cli.cantidad_pasajeros, 2),
        v_total, 'BRL', v_estado, v_pagado
      )
      returning id into v_reserva_id;

      if v_pagado > 0 then
        v_metodo := metodos[1 + (i % array_length(metodos, 1))];
        begin
          insert into pagos (cliente_id, reserva_id, monto, moneda, metodo, estado)
          values (cli.id, v_reserva_id, v_pagado, 'BRL', v_metodo, 'confirmado');
        exception when others then
          raise notice 'No se pudo registrar el pago de % (tabla pagos): %', cli.nombre, sqlerrm;
        end;
      end if;

      v_nota := notas[1 + (i % array_length(notas, 1))];
      insert into notas_clientes (cliente_id, contenido, autor)
      values (cli.id, v_nota, 'Admin');

    exception when others then
      raise notice 'No se pudo completar el perfil de %: %', cli.nombre, sqlerrm;
    end;
  end loop;
end $$;
