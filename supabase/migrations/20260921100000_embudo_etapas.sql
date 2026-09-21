-- Embudo de ventas con etapas propias (como el "Funil de vendas" de Kommo), en
-- vez de los 4 estados fijos. Cada etapa tiene un tipo:
--   abierta = consulta en curso
--   ganada  = ya pago / reserva confirmada (incluye las etapas de posventa)
--   perdida = no compro
-- leads.estado guarda la clave de la etapa. Las claves 'nuevo', 'contactado',
-- 'reservado' y 'perdido' ya existian, asi que los leads actuales siguen validos.

create table if not exists embudo_etapas (
  clave      text primary key,
  nombre     text not null,
  orden      integer not null,
  color      text not null default '#a1a1aa',
  tipo       text not null default 'abierta' check (tipo in ('abierta', 'ganada', 'perdida')),
  created_at timestamptz not null default now()
);

insert into embudo_etapas (clave, nombre, orden, color, tipo) values
  ('nuevo',             'Nueva consulta',                          1, '#8b8fe8', 'abierta'),
  ('contactado',        'Filtrado',                                2, '#7ec4f2', 'abierta'),
  ('propuesta_enviada', 'Propuesta enviada',                       3, '#7fd6a0', 'abierta'),
  ('negociacion',       'Negociação',                              4, '#f2d15c', 'abierta'),
  ('activacion_pago',   'Activación de AstroPay y formas de pago', 5, '#f0a35c', 'abierta'),
  ('reservado',         'Ya pagó, reserva confirmada',             6, '#34c38f', 'ganada'),
  ('pdf_enviado',       'PDF de servicios enviado',                7, '#e8788a', 'ganada'),
  ('anfitriona',        'Anfitriona entró en contacto',            8, '#6db3e8', 'ganada'),
  ('perdido',           'Perdido',                                 9, '#9ca3af', 'perdida')
on conflict (clave) do nothing;

alter table embudo_etapas enable row level security;
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'embudo_etapas' loop
    execute format('drop policy %I on embudo_etapas;', pol.policyname);
  end loop;
  execute 'create policy "acceso_total_temporal" on embudo_etapas for all using (true) with check (true);';
end $$;

-- Con varias etapas ganadas seguidas (pago, PDF enviado, anfitriona), "cerrado"
-- se cuenta una sola vez: cuando el lead llega por primera vez a una etapa
-- ganada. Pasar de una ganada a otra no lo cuenta de nuevo.
alter table leads add column if not exists ganado_at timestamptz;
update leads set ganado_at = estado_at
 where ganado_at is null
   and estado in (select clave from embudo_etapas where tipo = 'ganada');

create or replace function leads_marcar_estado_at() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.estado_at := coalesce(new.estado_at, now());
  elsif new.estado is distinct from old.estado then
    new.estado_at := now();
  end if;

  if new.ganado_at is null
     and (tg_op = 'INSERT' or new.estado is distinct from old.estado)
     and exists (select 1 from embudo_etapas e where e.clave = new.estado and e.tipo = 'ganada') then
    new.ganado_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_leads_estado_at on leads;
create trigger trg_leads_estado_at before insert or update on leads
  for each row execute function leads_marcar_estado_at();

-- Conteo de leads para el Dashboard, segun el tipo de etapa. Va aparte para que
-- cambiar las etapas no obligue a reescribir crm_metricas.
create or replace function crm_metricas_leads(p_desde timestamptz, p_hasta timestamptz)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'nuevos',   (select count(*) from leads where created_at >= p_desde and created_at < p_hasta),
    'cerrados', (select count(*) from leads l join embudo_etapas e on e.clave = l.estado
                  where e.tipo = 'ganada' and l.ganado_at >= p_desde and l.ganado_at < p_hasta),
    'perdidos', (select count(*) from leads l join embudo_etapas e on e.clave = l.estado
                  where e.tipo = 'perdida' and l.estado_at >= p_desde and l.estado_at < p_hasta),
    'abiertos', (select count(*) from leads l join embudo_etapas e on e.clave = l.estado
                  where e.tipo = 'abierta')
  );
$$;

grant execute on function crm_metricas_leads(timestamptz, timestamptz) to anon, authenticated;

-- crm_metricas: igual que antes, salvo que los leads salen de crm_metricas_leads.
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
