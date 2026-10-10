-- RLS del trío excursiones/reservas/clientes, el último grupo grande del plan de endurecer
-- RLS tabla por tabla (ver CLAUDE.md). Es el más delicado porque reservas tiene un INSERT
-- público real (el formulario de reserva del sitio, sin login) que ajusta
-- excursiones.cupos_disponibles -- por eso ese ajuste no pasa por catalogo-interno como el
-- resto, pasa por esta función nueva, de alcance bien acotado.

-- Solo ajusta cupos_disponibles, dentro de [0, cupos] -- no deja tocar nada más de la fila.
-- security definer: corre con los permisos de quien la creó (no de quien la llama), así que
-- puede escribir aunque quien llama no tenga permiso de UPDATE en excursiones.
create or replace function ajustar_cupos_excursion(p_excursion_id uuid, p_delta integer)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cupos integer;
  v_disponibles integer;
begin
  select cupos, coalesce(cupos_disponibles, cupos) into v_cupos, v_disponibles
    from excursiones where id = p_excursion_id;
  if v_cupos is null then
    return;
  end if;
  update excursiones
     set cupos_disponibles = least(greatest(v_disponibles + p_delta, 0), v_cupos)
   where id = p_excursion_id;
end $$;

grant execute on function ajustar_cupos_excursion(uuid, integer) to anon, authenticated;

-- excursiones: lectura pública (el catálogo del sitio), escribir pasa a ser solo admin
-- (catalogo-interno). El ajuste de cupos de una reserva pública usa la función de arriba,
-- no esta policy.
drop policy if exists "acceso_total_temporal" on excursiones;
create policy "lectura_publica" on excursiones for select using (true);

-- reservas: insertar sigue siendo público (el formulario de reserva del sitio, sin login) --
-- leer/editar/borrar pasa a ser solo admin (catalogo-interno).
drop policy if exists "acceso_total_temporal" on reservas;
create policy "insercion_publica" on reservas for insert with check (true);

-- clientes: datos personales, sin ninguna lectura ni escritura pública. Todo pasa por
-- catalogo-interno de acá en más.
drop policy if exists "acceso_total_temporal" on clientes;
