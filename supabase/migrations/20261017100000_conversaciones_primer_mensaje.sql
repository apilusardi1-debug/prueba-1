-- Fecha en que cada contacto escribió por primera vez (pedido del equipo, 2026-10-17): el CRM
-- filtra por esta fecha los "contactos nuevos" de un día o de un rango.
-- No alcanzaba con conversaciones.created_at: en las conversaciones importadas de Kommo es el
-- día de la importación (14 al 17/10/2026), no el de su primer mensaje.
--
-- Solo agrega una columna: no cambia ni borra nada de lo que ya existe (ni mensajes, ni el orden
-- de la lista, que va por ultimo_mensaje_at). Las conversaciones nuevas la completan solas con
-- la hora en que se crean (el default now()), que es cuando llega el primer mensaje del contacto;
-- no hace falta tocar el webhook.

alter table conversaciones
  add column if not exists primer_mensaje_at timestamptz default now();

-- Las que ya existen, de una sola pasada (usa el índice idx_mensajes_conv_fecha): el primer
-- mensaje del contacto; si no hay ninguno, el primer mensaje de la conversación.
update conversaciones c
set primer_mensaje_at = coalesce(x.primero_entrante, x.primero)
from (
  select conversacion_id,
         min(created_at) filter (where direccion = 'entrante') as primero_entrante,
         min(created_at) as primero
  from mensajes
  group by conversacion_id
) x
where x.conversacion_id = c.id;

-- Las que no tienen ningún mensaje: la fecha en que se crearon (el alter de arriba les puso "ahora")
update conversaciones c
set primer_mensaje_at = c.created_at
where not exists (select 1 from mensajes m where m.conversacion_id = c.id);

create index if not exists idx_conversaciones_primer_mensaje on conversaciones (primer_mensaje_at);

-- Control: cuántas conversaciones quedaron con fecha y el rango de fechas
select count(*) as conversaciones,
       count(primer_mensaje_at) as con_fecha,
       min(primer_mensaje_at)::date as primera,
       max(primer_mensaje_at)::date as ultima
from conversaciones;
