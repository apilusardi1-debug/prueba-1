-- Etiquetar una conversacion como "Pago" (nueva etiqueta, se agrega en el
-- codigo del CRM WhatsApp) mueve al lead a "Activación de AstroPay y formas
-- de pago" dentro del embudo de Paquetes. Mismo patron que
-- 20260926170000_propuestas_mover_lead.sql: cruce por whatsapp, solo avanza
-- (no toca un lead que ya este mas adelante, ganado, perdido o en otro embudo).

-- La columna solo admitia 4 valores (20260623_etiqueta_conversaciones.sql) —
-- se ensancha para agregar "pago", buscando el nombre real de la restriccion
-- en vez de asumirlo (mismo criterio que se usa con las policies de RLS).
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'conversaciones'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%etiqueta%'
  loop
    execute format('alter table conversaciones drop constraint %I', c.conname);
  end loop;
end $$;

alter table conversaciones add constraint conversaciones_etiqueta_check
  check (etiqueta in ('lead', 'interesado', 'cliente', 'no_interesa', 'pago'));

create or replace function conversaciones_etiqueta_pago() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_orden_destino integer;
begin
  if new.etiqueta is distinct from old.etiqueta and new.etiqueta = 'pago' then
    select orden into v_orden_destino from embudo_etapas where clave = 'activacion_pago';

    if v_orden_destino is not null then
      update leads l
         set estado = 'activacion_pago'
        from embudo_etapas e
       where e.clave = l.estado
         and l.whatsapp = new.whatsapp
         and e.embudo = 'paquetes'
         and e.tipo = 'abierta'
         and e.orden < v_orden_destino;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_conversaciones_etiqueta_pago on conversaciones;
create trigger trg_conversaciones_etiqueta_pago after update of etiqueta on conversaciones
  for each row execute function conversaciones_etiqueta_pago();
