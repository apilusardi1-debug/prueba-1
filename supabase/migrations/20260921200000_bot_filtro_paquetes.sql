-- Filtrado de clientes de Paquetes en el asistente automatico.
--
-- Despues de que el contacto elige Paquetes, el asistente le pide en UN solo mensaje
-- lo que todavia no dijo (nombre, destino, adultos, menores con su edad, presupuesto y
-- fechas). Si la respuesta viene incompleta hace una unica pregunta de seguimiento y
-- despues lo pasa a una persona. Estos son los textos y las opciones que se pueden
-- editar desde Configuracion > Asistente; el apagado deja todo como antes (Paquetes
-- se deriva directo a una persona).

alter table bot_config
  add column if not exists filtro_activo boolean not null default true,
  add column if not exists filtro_intro text not null
    default 'Perfecto! Para armarte una propuesta a tu medida necesito unos datos. Podés contestarme todo en un solo mensaje:',
  add column if not exists filtro_seguimiento text not null
    default 'Gracias! Para terminar me faltan estos datos:',
  -- destinos separados por coma
  add column if not exists filtro_destinos text not null
    default 'Porto de Galinhas, Maragogi, Pipa, Fernando de Noronha, Maceió',
  -- un rango de presupuesto por linea
  add column if not exists filtro_presupuestos text not null
    default E'Desde 1.000 a 2.000 USD\nDesde 2.000 a 2.500 USD\nDesde 2.500 a 3.000 USD';

-- El saludo de fabrica no preguntaba de forma explicita que le interesa. Solo se cambia
-- si nadie lo edito (si ya tiene un texto propio, no se toca).
update bot_config
   set saludo = 'Hola! ¿Cómo estás? Gracias por contactarte con Dreamtours. ¿Qué te interesa?'
 where saludo = 'Hola! Gracias por escribirle a Dream Tours. ¿Qué estás buscando?';
