-- Meta cambio como cobra WhatsApp: desde el 1 de octubre de 2026 ya no es por categoria
-- (plantilla/servicio) sino por MENSAJE saliente, segun el pais del destinatario, en
-- dolares -- y los primeros 1.000 mensajes salientes de CADA numero de Meta (el del CRM y
-- el operativo, cada uno con su propio pozo), por mes calendario, son gratis. Reemplaza el
-- calculo viejo por categoria de `tarifas_mensaje` (que queda en la base sin usarse).

-- Que numero de Meta mando cada mensaje saliente: hace falta para llevar la cuenta de los
-- 1.000 gratis de CADA numero por separado. Hoy el texto libre/multimedia del inbox del
-- CRM siempre sale del numero de CRM, y una plantilla siempre sale del numero operativo
-- (el unico que manda plantillas) -- por eso el backfill de lo que ya existe es exacto.
alter table mensajes add column if not exists numero text;
update mensajes set numero = case when coalesce(cobro, 'servicio') = 'servicio' then 'crm' else 'operativo' end where numero is null;
alter table mensajes alter column numero set default 'crm';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mensajes_numero_valido') then
    alter table mensajes add constraint mensajes_numero_valido check (numero in ('crm', 'operativo'));
  end if;
end $$;

-- Precio de referencia por pais del destinatario, en USD (los que publico Meta el 1/9,
-- vigentes desde el 1/10/2026). Editables desde el Dashboard.
create table if not exists tarifas_pais_whatsapp (
  pais      text primary key,
  nombre    text not null,
  valor_usd numeric(10, 4) not null default 0,
  orden     int not null default 0
);
insert into tarifas_pais_whatsapp (pais, nombre, valor_usd, orden) values
  ('colombia',    'Colombia',       0.0008, 1),
  ('brasil',      'Brasil',         0.0068, 2),
  ('mexico',      'México',         0.0085, 3),
  ('resto_latam', 'Resto de LATAM', 0.0112, 4),
  ('chile',       'Chile',          0.0200, 5),
  ('argentina',   'Argentina',      0.0260, 6),
  ('peru',        'Perú',           0.0300, 7)
on conflict (pais) do nothing;

-- Cotizacion para pasar los USD de arriba a reales (se usa en todo el panel), y cuantos
-- mensajes salientes por numero y por mes calendario son gratis antes de empezar a cobrar.
create table if not exists config_costos_whatsapp (
  id                  int primary key default 1,
  usd_a_brl           numeric(10, 4) not null default 5.20,
  mensajes_gratis_mes int not null default 1000,
  constraint config_costos_whatsapp_singleton check (id = 1)
);
insert into config_costos_whatsapp (id) values (1) on conflict (id) do nothing;

-- A que pais de la tabla de arriba corresponde un numero de WhatsApp, por su codigo de
-- pais. "resto_latam" si no matchea ninguno de la lista (o si viene vacio).
create or replace function pais_desde_whatsapp(numero text) returns text
language sql immutable as $$
  select case
    when numero is null then 'resto_latam'
    when numero like '54%' then 'argentina'
    when numero like '55%' then 'brasil'
    when numero like '57%' then 'colombia'
    when numero like '52%' then 'mexico'
    when numero like '56%' then 'chile'
    when numero like '51%' then 'peru'
    else 'resto_latam'
  end
$$;

-- RLS de las tablas nuevas (mismo patron que el resto del panel: protege el token, no
-- una politica restrictiva)
do $$
declare tabla text; pol record;
begin
  foreach tabla in array array['tarifas_pais_whatsapp', 'config_costos_whatsapp'] loop
    execute format('alter table %I enable row level security;', tabla);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = tabla loop
      execute format('drop policy %I on %I;', pol.policyname, tabla);
    end loop;
    execute format('create policy "acceso_total_temporal" on %I for all using (true) with check (true);', tabla);
  end loop;
end $$;

-- crm_metricas(): el costo ahora es por pais del destinatario + los 1.000 gratis por
-- numero y por mes calendario, no por categoria de plantilla. `gratis_mes` es siempre del
-- mes calendario ACTUAL (no del periodo Hoy/Semana/Mes que se este mirando en el
-- Dashboard), para que el contador no cambie segun ese filtro.
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
grant execute on function pais_desde_whatsapp(text) to anon, authenticated;
