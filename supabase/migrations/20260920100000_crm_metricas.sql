-- Metricas del CRM para el Dashboard: conversaciones, leads cerrados/perdidos,
-- tiempo de respuesta humana y gasto estimado en mensajes.

-- 1) Fecha del ultimo cambio de estado de cada lead: sin esto no se puede
--    contar "cerrados hoy / esta semana / este mes". Los leads existentes
--    arrancan con su fecha de creacion.
alter table leads add column if not exists estado_at timestamptz;
update leads set estado_at = created_at where estado_at is null;
alter table leads alter column estado_at set default now();

create or replace function leads_marcar_estado_at() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.estado_at := coalesce(new.estado_at, now());
  elsif new.estado is distinct from old.estado then
    new.estado_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_leads_estado_at on leads;
create trigger trg_leads_estado_at before insert or update on leads
  for each row execute function leads_marcar_estado_at();

-- 2) Cobro de cada mensaje saliente. Los mensajes de servicio (respuesta libre
--    dentro de las 24 hs) no se cobran; las plantillas si. Las tarifas son
--    editables desde el Dashboard porque son estimaciones: lo que vale es la
--    factura de Meta.
alter table mensajes add column if not exists cobro text;
create index if not exists idx_mensajes_conv_fecha on mensajes (conversacion_id, created_at);

create table if not exists tarifas_mensaje (
  cobro  text primary key,
  nombre text not null,
  valor  numeric(10, 4) not null default 0,
  moneda text not null default 'BRL'
);

insert into tarifas_mensaje (cobro, nombre, valor) values
  ('servicio',      'Servicio: respuesta libre dentro de las 24 hs', 0),
  ('utilidad',      'Plantilla de utilidad (avisos operativos)',     0.17),
  ('marketing',     'Plantilla de marketing',                         0.34),
  ('autenticacion', 'Plantilla de autenticacion',                     0.17)
on conflict (cobro) do nothing;

alter table tarifas_mensaje enable row level security;
do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'tarifas_mensaje' loop
    execute format('drop policy %I on tarifas_mensaje;', pol.policyname);
  end loop;
  execute 'create policy "acceso_total_temporal" on tarifas_mensaje for all using (true) with check (true);';
end $$;

-- 3) Funcion que devuelve todas las metricas de un periodo en un solo JSON.
--    El tiempo de respuesta se mide por "turno": desde el primer mensaje del
--    cliente que llega sin atender hasta la primera respuesta HUMANA (los
--    mensajes del asistente automatico y las plantillas no cuentan como
--    respuesta). Se atribuye al periodo en que llego el mensaje del cliente.
create or replace function crm_metricas(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_tz    text default 'America/Bahia'
) returns jsonb language sql stable as $$
  with msgs as (
    select m.id, m.conversacion_id, m.direccion, m.created_at, m.cobro,
           (m.direccion = 'saliente' and m.origen is distinct from 'bot' and coalesce(m.cobro, 'servicio') = 'servicio') as humano,
           (m.direccion = 'saliente' and m.origen = 'bot') as bot,
           (m.direccion = 'saliente' and m.origen is distinct from 'bot' and coalesce(m.cobro, 'servicio') <> 'servicio') as plantilla
    from mensajes m
    where m.created_at < p_hasta
  ),
  turnos as (
    select conversacion_id, n_prev,
           min(created_at) filter (where direccion = 'entrante') as inicio,
           min(created_at) filter (where humano) as respuesta
    from (
      select msgs.*,
             count(*) filter (where humano) over (
               partition by conversacion_id order by created_at, id
               rows between unbounded preceding and 1 preceding
             ) as n_prev
      from msgs
    ) x
    group by conversacion_id, n_prev
  ),
  turnos_periodo as (
    select inicio, respuesta, extract(epoch from (respuesta - inicio)) as seg
    from turnos
    where inicio >= p_desde and inicio < p_hasta
  ),
  primeros as (
    select conversacion_id, min(created_at) as primero
    from msgs where direccion = 'entrante'
    group by conversacion_id
  ),
  en_periodo as (
    select * from msgs where created_at >= p_desde
  ),
  cobrados as (
    select m.created_at, m.cobro, t.valor
    from en_periodo m join tarifas_mensaje t on t.cobro = m.cobro
    where m.direccion = 'saliente'
  )
  select jsonb_build_object(
    'conversaciones_nuevas',  (select count(*) from primeros where primero >= p_desde and primero < p_hasta),
    'conversaciones_activas', (select count(distinct conversacion_id) from en_periodo where direccion = 'entrante'),
    'mensajes_entrantes',     (select count(*) from en_periodo where direccion = 'entrante'),
    'mensajes_humanos',       (select count(*) from en_periodo where humano),
    'mensajes_bot',           (select count(*) from en_periodo where bot),
    'mensajes_plantilla',     (select count(*) from en_periodo where plantilla),
    'leads', jsonb_build_object(
      'nuevos',   (select count(*) from leads where created_at >= p_desde and created_at < p_hasta),
      'cerrados', (select count(*) from leads where estado = 'reservado' and estado_at >= p_desde and estado_at < p_hasta),
      'perdidos', (select count(*) from leads where estado = 'perdido'   and estado_at >= p_desde and estado_at < p_hasta),
      'abiertos', (select count(*) from leads where estado in ('nuevo', 'contactado'))
    ),
    'respuesta', jsonb_build_object(
      'promedio_seg',  (select round(avg(seg)) from turnos_periodo where respuesta is not null),
      'mediana_seg',   (select round(percentile_cont(0.5) within group (order by seg)::numeric) from turnos_periodo where respuesta is not null),
      'respondidos',   (select count(*) from turnos_periodo where respuesta is not null),
      'sin_responder', (select count(*) from turnos_periodo where respuesta is null and inicio is not null)
    ),
    'costo', jsonb_build_object(
      'moneda',  'BRL',
      'total',   coalesce((select sum(valor) from cobrados), 0),
      'detalle', coalesce((
        select jsonb_object_agg(cobro, jsonb_build_object('cantidad', n, 'valor', v))
        from (select cobro, count(*) as n, sum(valor) as v from cobrados group by cobro) d
      ), '{}'::jsonb)
    ),
    'por_dia', coalesce((
      select jsonb_agg(jsonb_build_object(
               'dia', d.dia,
               'conversaciones_nuevas', coalesce(c.n, 0),
               'mensajes_entrantes',    coalesce(e.n, 0),
               'gasto',                 coalesce(g.v, 0)
             ) order by d.dia)
      from (
        select generate_series(
                 (p_desde at time zone p_tz)::date,
                 ((p_hasta - interval '1 second') at time zone p_tz)::date,
                 interval '1 day')::date as dia
      ) d
      left join (
        select (primero at time zone p_tz)::date as dia, count(*) as n
        from primeros where primero >= p_desde and primero < p_hasta group by 1
      ) c on c.dia = d.dia
      left join (
        select (created_at at time zone p_tz)::date as dia, count(*) as n
        from en_periodo where direccion = 'entrante' group by 1
      ) e on e.dia = d.dia
      left join (
        select (created_at at time zone p_tz)::date as dia, sum(valor) as v
        from cobrados group by 1
      ) g on g.dia = d.dia
    ), '[]'::jsonb)
  );
$$;

grant execute on function crm_metricas(timestamptz, timestamptz, text) to anon, authenticated;
