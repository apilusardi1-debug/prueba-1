-- El Dashboard (Ingresos, Salidas, Leads nuevos, Reservas pendientes, Clientes, Costos
-- operativos, y las tarjetas del CRM) ahora escucha estas tablas y se actualiza solo, sin
-- recargar la pagina (ver src/lib/useSincronizado.js). Pero eso necesita que Supabase avise
-- los cambios en tiempo real, y solo "conversaciones" y "mensajes" estaban prendidas para eso
-- (por eso el CRM ya se actualizaba solo y el resto del Dashboard no). Sin este SQL el
-- Dashboard igual se pone al dia, pero tarda hasta 1 minuto (la red de seguridad); con este SQL
-- es casi al instante, como ya pasa en el CRM.

do $$
declare
  tabla text;
begin
  foreach tabla in array array['excursiones', 'leads', 'clientes', 'reservas', 'movimientos_caja', 'propuestas']
  loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tabla
    ) then
      execute format('alter publication supabase_realtime add table %I', tabla);
    end if;
  end loop;
end $$;
