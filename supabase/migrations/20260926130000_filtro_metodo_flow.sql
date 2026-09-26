-- Interruptor entre el mensaje de texto de siempre y el formulario nativo de WhatsApp
-- (Flow) para pedir los datos del viaje en Paquetes. Arranca en 'texto' (el de siempre):
-- nada cambia para los clientes reales hasta que se pruebe el Flow y se ponga en 'flow'
-- a propósito. El id del Flow en si vive en el codigo (webhook-whatsapp), no en la base.

alter table bot_config
  add column if not exists filtro_metodo text not null default 'texto'
    check (filtro_metodo in ('texto', 'flow'));
