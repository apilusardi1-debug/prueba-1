-- Coexistencia con la app WhatsApp Business del celular: lo que el equipo manda desde el
-- telefono llega al CRM como mensaje saliente con origen = 'celular'. Meta no cobra esos
-- mensajes (solo cobra los que salen por la API), asi que no tienen que sumar al gasto ni
-- consumir el pozo de 1.000 gratis por numero. Siguen contando como respuesta humana para
-- los tiempos de respuesta y para "sin responder": eso no cambia.
--
-- crm_metricas(): igual que la de 20261012100000_importacion_historial_kommo.sql, sin los
-- mensajes con origen = 'celular' en `salientes`.
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
      and m.origen is distinct from 'kommo'
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
  cfg as (select usd_a_brl, mensajes_gratis_mes from config_costos_whatsapp where id = 1),
  -- Orden de cada mensaje saliente DENTRO de su numero y su mes calendario (hora de
  -- Bahia), para saber si ya paso los 1.000 gratis de ESE mes. Hay que mirar TODOS los
  -- mensajes salientes (no solo los del periodo consultado): un dia cualquiera del mes
  -- puede caer despues del mensaje 1.000 aunque ese dia solo tenga unos pocos.
  salientes as (
    select m.id, m.created_at, m.numero, m.whatsapp,
           row_number() over (
             partition by m.numero, date_trunc('month', m.created_at at time zone p_tz)
             order by m.created_at, m.id
           ) as n_en_mes
    from mensajes m
    where m.direccion = 'saliente' and m.created_at < p_hasta
      and m.origen is distinct from 'kommo'
      and m.origen is distinct from 'celular'
  ),
  cobrados as (
    select s.created_at, s.numero,
           pais_desde_whatsapp(s.whatsapp) as pais,
           (s.n_en_mes > cfg.mensajes_gratis_mes) as pago,
           case when s.n_en_mes > cfg.mensajes_gratis_mes
             then coalesce(t.valor_usd, 0) * cfg.usd_a_brl
             else 0
           end as valor
    from salientes s
    cross join cfg
    left join tarifas_pais_whatsapp t on t.pais = pais_desde_whatsapp(s.whatsapp)
    where s.created_at >= p_desde and s.created_at < p_hasta
  ),
  gratis_mes as (
    select n.numero, coalesce(max(s.n_en_mes), 0) as usados
    from (values ('crm'), ('operativo')) as n(numero)
    left join salientes s on s.numero = n.numero
      and date_trunc('month', s.created_at at time zone p_tz) = date_trunc('month', p_ahora at time zone p_tz)
    group by n.numero
  )
  select jsonb_build_object(
    'conversaciones_nuevas',  (select count(*) from primeros where primero >= p_desde and primero < p_hasta),
    'conversaciones_activas', (select count(distinct conversacion_id) from en_periodo where direccion = 'entrante'),
    'mensajes_entrantes',     (select count(*) from en_periodo where direccion = 'entrante'),
    'mensajes_humanos',       (select count(*) from en_periodo where humano),
    'mensajes_bot',           (select count(*) from en_periodo where bot),
    'mensajes_plantilla',     (select count(*) from en_periodo where plantilla),
    'leads', crm_metricas_leads(p_desde, p_hasta),
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
      'gratis',  coalesce((select count(*) from cobrados where not pago), 0),
      'pagos',   coalesce((select count(*) from cobrados where pago), 0),
      'detalle', coalesce((
        select jsonb_object_agg(pais, jsonb_build_object('cantidad', n, 'valor', v))
        from (select pais, count(*) as n, sum(valor) as v from cobrados where pago group by pais) d
      ), '{}'::jsonb)
    ),
    'gratis_mes', coalesce((
      select jsonb_object_agg(g.numero, jsonb_build_object(
               'usados',      g.usados,
               'disponibles', greatest(0, c.mensajes_gratis_mes - g.usados),
               'total',       c.mensajes_gratis_mes
             ))
      from gratis_mes g cross join cfg c
    ), '{}'::jsonb),
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
