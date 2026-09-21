-- Asistente automatico: interruptor por conversacion.
--
-- El asistente esta prendido en todos los chats (lo enciende o apaga
-- bot_config.activo, para todos a la vez). Desde el chat se puede pausar en uno
-- puntual para que solo responda el equipo, y volver a prenderlo cuando se
-- quiera. Mientras un chat esta pausado el webhook no hace nada en el: ni
-- saluda, ni manda el menu, ni deriva, ni avisa que alguien va a responder.
--
-- Es independiente de bot_estado (por donde iba la conversacion): pausar y
-- reactivar no lo toca, asi que al reactivar sigue donde estaba.

alter table conversaciones
  add column if not exists bot_pausado boolean not null default false;
