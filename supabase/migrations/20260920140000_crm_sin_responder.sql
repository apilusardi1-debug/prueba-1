-- Conversaciones que esperan respuesta humana y desde cuando, para marcarlas en
-- amarillo (12 hs) y rojo (18 hs) en la lista del CRM. Es la misma definicion
-- de "sin responder" que usa crm_metricas en el Dashboard: cuenta desde el
-- primer mensaje del cliente que llego sin atender; el asistente automatico y
-- las plantillas NO cuentan como respuesta; lo de hace mas de 7 dias se da por
-- cerrado.
create or replace function crm_sin_responder(p_ahora timestamptz default now())
returns table (conversacion_id uuid, desde timestamptz)
language sql stable as $$
  with msgs as (
    select m.id, m.conversacion_id, m.direccion, m.created_at,
           (m.direccion = 'saliente' and m.origen is distinct from 'bot' and coalesce(m.cobro, 'servicio') = 'servicio') as humano
    from mensajes m
    where m.created_at <= p_ahora
  ),
  turnos as (
    select t.conversacion_id,
           min(t.created_at) filter (where t.direccion = 'entrante') as inicio,
           min(t.created_at) filter (where t.humano) as respuesta
    from (
      select msgs.*,
             count(*) filter (where humano) over (
               partition by msgs.conversacion_id order by msgs.created_at, msgs.id
               rows between unbounded preceding and 1 preceding
             ) as n_prev
      from msgs
    ) t
    group by t.conversacion_id, t.n_prev
  )
  select turnos.conversacion_id, turnos.inicio
  from turnos
  where turnos.inicio is not null
    and turnos.respuesta is null
    and turnos.inicio > p_ahora - interval '7 days';
$$;

grant execute on function crm_sin_responder(timestamptz) to anon, authenticated;
