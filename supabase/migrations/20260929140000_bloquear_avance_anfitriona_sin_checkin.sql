-- Un lead de Anfitriona sin la fecha de check-in cargada no puede avanzar a
-- otra etapa de ese mismo embudo (siempre se puede marcar "Perdido", eso no
-- se bloquea nunca). Ya se corta esto en el panel (Leads.jsx), esto es el
-- respaldo del lado de la base por si el cambio de etapa llega por otro
-- camino. Va ANTES que trg_leads_redirigir_anfitriona en orden alfabetico
-- ("bloquear" < "estado_at" < "redirigir"), asi que cuando un lead recien
-- entra por "pdf_enviado" el chequeo mira su etapa VIEJA (de Paquetes, no
-- Anfitriona) y lo deja pasar — el bloqueo empieza a regir una vez que ya
-- esta adentro de Anfitriona.
create or replace function leads_bloquear_avance_anfitriona_sin_checkin() returns trigger
language plpgsql as $$
declare
  v_embudo_actual text;
begin
  if new.estado is distinct from old.estado then
    select embudo into v_embudo_actual from embudo_etapas where clave = old.estado;
    if v_embudo_actual = 'anfitriona' and new.estado <> 'anfitriona_perdido' and new.fecha_checkin is null then
      raise exception 'Cargá la fecha de check-in del vuelo antes de mover este lead a otra etapa de Anfitriona.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_leads_bloquear_avance_checkin on leads;
create trigger trg_leads_bloquear_avance_checkin before update on leads
  for each row execute function leads_bloquear_avance_anfitriona_sin_checkin();
