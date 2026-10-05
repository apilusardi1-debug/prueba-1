-- Meta reintenta los avisos que no recibe a tiempo: un mismo mensaje entrante puede llegar dos
-- veces. Con esta clave única el segundo intento no crea otra fila (ver webhook-whatsapp,
-- guardarEntrante). Los NULL no cuentan como repetidos, así que los mensajes sin id no se afectan.

do $$
begin
  if exists (
    select 1 from mensajes
     where wa_message_id is not null
     group by wa_message_id
    having count(*) > 1
  ) then
    raise exception 'Hay wa_message_id repetidos en mensajes: revisarlos antes de crear el índice';
  end if;
end $$;

create unique index if not exists mensajes_wa_message_id_key on mensajes (wa_message_id);
