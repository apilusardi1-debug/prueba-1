-- Datos internos de una propuesta cerrada, uso exclusivo del panel (no van al
-- cliente): notas de paseos/excursiones incluidos y un telefono operativo
-- (chofer, guia, hotel, etc.), distinto del whatsapp del cliente.
alter table propuestas add column if not exists paseos_notas text;
alter table propuestas add column if not exists telefono_interno text;
