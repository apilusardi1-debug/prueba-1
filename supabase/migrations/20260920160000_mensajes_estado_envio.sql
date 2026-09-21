-- Estado de entrega de los mensajes salientes (enviado / entregado / leído /
-- fallido). Meta lo informa por el webhook usando el id del mensaje (wamid), que
-- hasta ahora no se guardaba.

alter table mensajes add column if not exists wa_message_id text;
alter table mensajes add column if not exists estado_envio text;
alter table mensajes add column if not exists estado_envio_at timestamptz;
alter table mensajes add column if not exists error_codigo integer;
alter table mensajes add column if not exists error_envio text;

create unique index if not exists mensajes_wa_message_id_idx
  on mensajes (wa_message_id)
  where wa_message_id is not null;
