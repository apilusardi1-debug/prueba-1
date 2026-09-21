-- "Marcar como atendida": el equipo cierra la espera de una conversacion sin
-- mandar ningun mensaje (un "gracias" final, algo resuelto por telefono, una
-- prueba). Se guarda cuando y quien.
--
-- Como cuenta en las metricas:
--  * la conversacion sale de "sin responder" (lista del CRM y Dashboard);
--  * ese turno NO cuenta como respuesta: no entra en el tiempo de respuesta ni
--    en el promedio de espera, para no falsear el dato;
--  * marca un corte: si el contacto vuelve a escribir despues, la espera nueva
--    cuenta desde ese mensaje y la conversacion vuelve a aparecer sola;
--  * "Deshacer" deja atendida_at en null y todo vuelve a contarse como antes.

alter table conversaciones add column if not exists atendida_at timestamptz;
alter table conversaciones add column if not exists atendida_por uuid references usuarios_admin(id);

-- La hora la pone el servidor: si la marcara el navegador, un reloj mal puesto
-- en la computadora dejaria la marca en el futuro y se ignoraria.
create or replace function crm_marcar_atendida(p_conversacion uuid, p_usuario uuid default null)
returns timestamptz
language sql as $$
  update conversaciones
     set atendida_at = now(), atendida_por = p_usuario
   where id = p_conversacion
  returning atendida_at;
$$;

grant execute on function crm_marcar_atendida(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Conversaciones que esperan respuesta humana (misma definicion que antes, mas
-- el corte de "atendida").
create or replace function crm_sin_responder(p_ahora timestamptz default now())
returns table (conversacion_id uuid, desde timestamptz)
language sql stable as $$
  with eventos as (
    select m.id, m.conversacion_id, m.direccion, m.created_at,
           (m.direccion = 'saliente' and m.origen is distinct from 'bot' and coalesce(m.cobro, 'servicio') = 'servicio') as humano,
           false as cierre
    from mensajes m
    where m.created_at <= p_ahora
    union all
    select null::uuid, c.id, 'cierre'::text, c.atendida_at, false, true
    from conversaciones c
    where c.atendida_at is not null and c.atendida_at <= p_ahora
  ),
  turnos as (
    select t.conversacion_id,
           min(t.created_at) filter (where t.direccion = 'entrante') as inicio,
           min(t.created_at) filter (where t.humano) as respuesta,
           bool_or(t.cierre) as cerrado
    from (
      select eventos.*,
             count(*) filter (where humano or cierre) over (
               partition by eventos.conversacion_id order by eventos.created_at, eventos.id
               rows between unbounded preceding and 1 preceding
             ) as n_prev
      from eventos
    ) t
    group by t.conversacion_id, t.n_prev
  )
  select turnos.conversacion_id, turnos.inicio
  from turnos
  where turnos.inicio is not null
    and turnos.respuesta is null
    and not turnos.cerrado
    and turnos.inicio > p_ahora - interval '7 days';
$$;

grant execute on function crm_sin_responder(timestamptz) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Metricas del Dashboard (igual que antes, salvo los turnos cerrados a mano).
drop function if exists crm_metricas(timestamptz, timestamptz, text);

create or replace function crm_metricas(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_tz    text default 'America/Bahia',
  p_ahora timestamptz default now()
) returns jsonb language sql stable as $$
  with msgs as (
    select m.id, m.conversacion_id, m.direccion, m.created_at, m.cobro,
           (m.direccion = 'saliente' and m.origen is distinct from 'bot' and coalesce(m.cobro, 'servicio') = 'servicio') as humano,
           (m.direccion = 'saliente' and m.origen = 'bot') as bot,
           (m.direccion = 'saliente' and m.origen is distinct from 'bot' and coalesce(m.cobro, 'servicio') <> 'servicio') as plantilla
    from mensajes m
    where m.created_at < p_hasta
  ),
  eventos as (
    select id, conversacion_id, direccion, created_at, humano, false as cierre from msgs
    union all
    select null::uuid, c.id, 'cierre'::text, c.atendida_at, false, true
    from conversaciones c
    where c.atendida_at is not null and c.atendida_at < p_hasta and c.atendida_at <= p_ahora
  ),
  turnos as (
    select conversacion_id, n_prev,
           min(created_at) filter (where direccion = 'entrante') as inicio,
           min(created_at) filter (where humano) as respuesta,
           bool_or(cierre) as cerrado
    from (
      select eventos.*,
             count(*) filter (where humano or cierre) over (
               partition by conversacion_id order by created_at, id
               rows between unbounded preceding and 1 preceding
             ) as n_prev
      from eventos
    ) x
    group by conversacion_id, n_prev
  ),
  turnos_periodo as (
    select inicio, respuesta,
           extract(epoch from (respuesta - inicio)) as seg,
           extract(epoch from (coalesce(respuesta, p_ahora) - inicio)) as espera
    from turnos
    where inicio >= p_desde and inicio < p_hasta
      and not cerrado
  ),
  pendientes as (
    select conversacion_id, inicio, extract(epoch from (p_ahora - inicio)) as seg
    from turnos
    where inicio is not null and respuesta is null
      and not cerrado
      and inicio > p_ahora - interval '7 days'
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
      'promedio_seg',        (select round(avg(seg)) from turnos_periodo where respuesta is not null),
      'mediana_seg',         (select round(percentile_cont(0.5) within group (order by seg)::numeric) from turnos_periodo where respuesta is not null),
      'respondidos',         (select count(*) from turnos_periodo where respuesta is not null),
      'sin_responder',       (select count(*) from turnos_periodo where respuesta is null and inicio is not null),
      'espera_promedio_seg', (select round(avg(espera)) from turnos_periodo where respuesta is not null or inicio > p_ahora - interval '7 days'),
      'pendientes', jsonb_build_object(
        'cantidad',     (select count(*) from pendientes),
        'max_seg',      (select round(max(seg)) from pendientes),
        'promedio_seg', (select round(avg(seg)) from pendientes),
        'lista', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'conversacion_id', p.conversacion_id,
                   'whatsapp', c.whatsapp,
                   'nombre', c.contacto_nombre,
                   'desde', p.inicio,
                   'seg', round(p.seg)
                 ) order by p.seg desc)
          from (select * from pendientes order by seg desc limit 8) p
          left join conversaciones c on c.id = p.conversacion_id
        ), '[]'::jsonb)
      )
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

grant execute on function crm_metricas(timestamptz, timestamptz, text, timestamptz) to anon, authenticated;
