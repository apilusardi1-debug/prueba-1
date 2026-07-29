-- 1) usuarios_admin: bloqueo total. RLS activado, sin ninguna política ->
--    ni anon ni authenticated pueden leer/escribir esta tabla directo.
--    El único acceso es la Edge Function "usuarios-admin", que usa la
--    service_role key (esa key ignora RLS siempre).
alter table usuarios_admin enable row level security;

-- 2) Resto de las tablas: activar RLS con una política permisiva
--    temporal (deja pasar todo, igual que hoy sin RLS) — esto es
--    intencionalmente NO una restricción real, solo saca la alerta
--    "rls_disabled_in_public" de Supabase mientras se decide si vale la
--    pena encarar la migración a Supabase Auth para reglas de verdad.
do $$
declare
  tabla text;
  pol record;
begin
  foreach tabla in array array[
    'actividad_clientes', 'choferes', 'clientes', 'conceptos_movimiento',
    'conversaciones', 'costos_excursion', 'excursiones', 'guias', 'leads',
    'mensajes', 'movimientos_caja', 'notas_clientes', 'pagos', 'propuestas',
    'reservas', 'site_config', 'vendedores'
  ]
  loop
    execute format('alter table %I enable row level security;', tabla);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = tabla loop
      execute format('drop policy %I on %I;', pol.policyname, tabla);
    end loop;
    execute format('create policy "acceso_total_temporal" on %I for all using (true) with check (true);', tabla);
  end loop;
end $$;
