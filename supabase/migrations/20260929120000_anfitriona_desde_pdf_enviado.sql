-- La etapa "Anfitriona entró en contacto" sale del embudo de Paquetes (pedido
-- de Cristian, 2026-09-29): ya no aparece como columna, era solo un gatillo
-- que nunca retenía leads (el pase a Anfitriona era instantáneo). Ahora ese
-- mismo pase instantáneo se dispara al llegar a "PDF de servicios enviado",
-- que pasa a ser la última etapa real de Paquetes.

-- El nombre del trigger sigue empezando por "trg_leads_r..." — se mantiene
-- el mismo orden alfabético después de "trg_leads_estado_at" (ver comentario
-- original en 20260922120000_embudo_anfitriona.sql) para que ganado_at se
-- siga marcando antes de la redirección, ahora al pasar por "pdf_enviado".
create or replace function leads_redirigir_anfitriona() returns trigger language plpgsql as $$
begin
  if new.estado = 'pdf_enviado' and (tg_op = 'INSERT' or old.estado is distinct from new.estado) then
    new.estado := 'anfitriona_asignada';
  end if;
  return new;
end $$;

do $$
declare v_orden_vieja integer;
begin
  select orden into v_orden_vieja from embudo_etapas where clave = 'anfitriona';

  if v_orden_vieja is not null then
    -- Por si quedó algún lead con estado = 'anfitriona' de antes del trigger
    -- (no debería, pero por las dudas no se pierde ninguno).
    update leads set estado = 'anfitriona_asignada' where estado = 'anfitriona';

    delete from embudo_automatizaciones where etapa_clave = 'anfitriona';

    delete from embudo_etapas where clave = 'anfitriona';

    update embudo_etapas
       set orden = orden - 1
     where embudo = 'paquetes' and orden > v_orden_vieja;
  end if;
end $$;
