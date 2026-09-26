-- Cristian pidio juntar "Propuesta enviada" y "Negociação" del embudo de
-- Paquetes en un solo bloque. Se conserva la clave 'propuesta_enviada' (queda
-- primera de las dos) y se borra 'negociacion', pero antes hay que mover lo que
-- apuntaba a esta ultima para no perder nada:
--   - los leads que estaban en "negociacion" pasan a "propuesta_enviada"
--   - las automatizaciones de "negociacion" se reasignan a "propuesta_enviada"
--     (si ya hay una igual ahi, la de "negociacion" se descarta en vez de duplicar)
--   - las etapas que venian despues corren su orden un lugar

do $$
declare v_orden_negociacion integer;
begin
  select orden into v_orden_negociacion from embudo_etapas where clave = 'negociacion';

  if v_orden_negociacion is not null then
    update leads set estado = 'propuesta_enviada' where estado = 'negociacion';

    update embudo_automatizaciones ea
       set etapa_clave = 'propuesta_enviada'
     where ea.etapa_clave = 'negociacion'
       and not exists (
         select 1 from embudo_automatizaciones ea2
          where ea2.etapa_clave = 'propuesta_enviada'
            and ea2.tipo = ea.tipo
            and coalesce(ea2.usuario_id::text, '') = coalesce(ea.usuario_id::text, '')
       );
    delete from embudo_automatizaciones where etapa_clave = 'negociacion';

    delete from embudo_etapas where clave = 'negociacion';

    update embudo_etapas
       set orden = orden - 1
     where embudo = 'paquetes' and orden > v_orden_negociacion;
  end if;
end $$;

update embudo_etapas set nombre = 'Propuesta enviada / Negociação'
 where clave = 'propuesta_enviada';
