-- Sección "Entrenar al asistente" (solo Cristian y Abril, filtrado por email
-- en el frontend — ver src/lib/entrenamiento.js). Dos tablas nuevas:
--
-- asistente_sinonimos: palabras extra que suman a la deteccion de interes ya
-- hardcodeada en supabase/functions/_shared/interes.ts (DESTINOS, PALABRAS_TIPO).
-- No reemplazan nada de lo que ya funciona, solo se agregan por arriba.
--
-- asistente_bitacora: registro automatico de que se cambio en la
-- configuracion del asistente desde esta seccion, y quien y cuando.

create table if not exists asistente_sinonimos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('destino', 'paquete', 'paseo', 'traslado', 'hospedaje')),
  -- Nombre del destino (solo cuando tipo = 'destino'; para el resto no hace falta)
  valor text,
  -- Sinonimos separados por coma, tal como los escribe quien los carga
  palabras text not null,
  creado_por text,
  created_at timestamptz not null default now(),
  constraint destino_necesita_valor check (tipo <> 'destino' or (valor is not null and length(trim(valor)) > 0))
);

create table if not exists asistente_bitacora (
  id uuid primary key default gen_random_uuid(),
  usuario_nombre text,
  usuario_email text,
  resumen text not null,
  detalle jsonb,
  created_at timestamptz not null default now()
);

alter table asistente_sinonimos enable row level security;
alter table asistente_bitacora enable row level security;
do $$
declare pol record;
begin
  for pol in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('asistente_sinonimos', 'asistente_bitacora') loop
    execute format('drop policy %I on %I;', pol.policyname, pol.tablename);
  end loop;
  execute 'create policy "acceso_total_temporal" on asistente_sinonimos for all using (true) with check (true);';
  execute 'create policy "acceso_total_temporal" on asistente_bitacora for all using (true) with check (true);';
end $$;
