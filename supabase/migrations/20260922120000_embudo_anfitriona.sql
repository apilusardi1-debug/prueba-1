-- Tercer embudo: Anfitriona. Es posventa: arranca cuando un lead de Paquetes llega a
-- "Anfitriona entró en contacto" (esa etapa ya existía, tipo ganada). Cristian pidió el embudo
-- sin traer una captura de Kommo puntual ("armá vos una propuesta razonable"): un flujo simple
-- de 4 pasos, como el de Paseos.
--
-- Etapas (Contato -> Coordinación -> Confirmada), con Perdido aparte:
--   Anfitriona asignada -> En contacto con el cliente -> Coordinando la estadía
--   -> Estadía confirmada (ganada) / Perdido

alter table embudo_etapas drop constraint if exists embudo_etapas_embudo_check;
alter table embudo_etapas add constraint embudo_etapas_embudo_check
  check (embudo in ('paquetes', 'paseos', 'anfitriona'));

insert into embudo_etapas (clave, nombre, orden, color, tipo, embudo) values
  ('anfitriona_asignada',    'Anfitriona asignada',        1, '#7ec4f2', 'abierta', 'anfitriona'),
  ('anfitriona_contacto',    'En contacto con el cliente', 2, '#f2e26a', 'abierta', 'anfitriona'),
  ('anfitriona_coordinando', 'Coordinando la estadía',     3, '#f5b552', 'abierta', 'anfitriona'),
  ('anfitriona_confirmada',  'Estadía confirmada',         4, '#34c38f', 'ganada',  'anfitriona'),
  ('anfitriona_perdido',     'Perdido',                    5, '#9ca3af', 'perdida', 'anfitriona')
on conflict (clave) do nothing;

-- Cristian pidió que el pase sea automático: un lead nunca queda parado en "anfitriona" (la
-- etapa vieja de Paquetes), entra derecho a la primera etapa del embudo nuevo. Es un trigger
-- BEFORE para que se reescriba antes de guardar (no una segunda fila), y se llama con nombre
-- que ordena alfabéticamente después de "trg_leads_estado_at": así ese otro trigger ve pasar
-- el lead por "anfitriona" (marca ganado_at, porque esa etapa es tipo ganada) antes de que este
-- lo redirija a "anfitriona_asignada".
create or replace function leads_redirigir_anfitriona() returns trigger language plpgsql as $$
begin
  if new.estado = 'anfitriona' and (tg_op = 'INSERT' or old.estado is distinct from new.estado) then
    new.estado := 'anfitriona_asignada';
  end if;
  return new;
end $$;

drop trigger if exists trg_leads_redirigir_anfitriona on leads;
create trigger trg_leads_redirigir_anfitriona before insert or update on leads
  for each row execute function leads_redirigir_anfitriona();

-- Con el embudo nuevo, un lead "cerrado" (la venta) sigue de largo a una etapa posventa que ya
-- no es tipo "ganada" (anfitriona_asignada es "abierta"). "cerrados" contaba antes por la etapa
-- ACTUAL además de por ganado_at, así que un lead recién pasado a Anfitriona dejaba de contar
-- como cerrado apenas se lo redirigía. ganado_at ya está pensado para esto (ver el comentario de
-- la migración que lo creó: "con varias etapas ganadas seguidas, cerrado se cuenta una sola
-- vez"), así que alcanza con eso, sin mirar en qué etapa está ahora.
create or replace function crm_metricas_leads(p_desde timestamptz, p_hasta timestamptz)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'nuevos',   (select count(*) from leads where created_at >= p_desde and created_at < p_hasta),
    'cerrados', (select count(*) from leads where ganado_at >= p_desde and ganado_at < p_hasta),
    'perdidos', (select count(*) from leads l join embudo_etapas e on e.clave = l.estado
                  where e.tipo = 'perdida' and l.estado_at >= p_desde and l.estado_at < p_hasta),
    'abiertos', (select count(*) from leads l join embudo_etapas e on e.clave = l.estado
                  where e.tipo = 'abierta')
  );
$$;
