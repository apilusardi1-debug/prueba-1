-- Mismo pedido que en Paquetes (ver 20260926150000_embudo_fusionar_negociacion.sql)
-- pero para el embudo de Paseos: junta "Oferta feita" y "Negociação" en un solo
-- bloque. Se conserva la clave 'paseos_oferta_hecha' (queda primera de las dos) y
-- se borra 'paseos_negociacion', pero antes hay que mover lo que apuntaba a esta
-- ultima para no perder nada:
--   - los leads que estaban en "paseos_negociacion" pasan a "paseos_oferta_hecha"
--   - las automatizaciones de "paseos_negociacion" se reasignan a
--     "paseos_oferta_hecha" (si ya hay una igual ahi, la de "paseos_negociacion"
--     se descarta en vez de duplicar)
--   - las etapas que venian despues corren su orden un lugar

do $$
declare v_orden_negociacion integer;
begin
  select orden into v_orden_negociacion from embudo_etapas where clave = 'paseos_negociacion';

  if v_orden_negociacion is not null then
    update leads set estado = 'paseos_oferta_hecha' where estado = 'paseos_negociacion';

    update embudo_automatizaciones ea
       set etapa_clave = 'paseos_oferta_hecha'
     where ea.etapa_clave = 'paseos_negociacion'
       and not exists (
         select 1 from embudo_automatizaciones ea2
          where ea2.etapa_clave = 'paseos_oferta_hecha'
            and ea2.tipo = ea.tipo
            and coalesce(ea2.usuario_id::text, '') = coalesce(ea.usuario_id::text, '')
       );
    delete from embudo_automatizaciones where etapa_clave = 'paseos_negociacion';

    delete from embudo_etapas where clave = 'paseos_negociacion';

    update embudo_etapas
       set orden = orden - 1
     where embudo = 'paseos' and orden > v_orden_negociacion;
  end if;
end $$;

update embudo_etapas set nombre = 'Oferta feita / Negociação'
 where clave = 'paseos_oferta_hecha';
