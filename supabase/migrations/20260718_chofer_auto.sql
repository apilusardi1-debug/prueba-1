-- Modelo y patente del auto de cada chofer, para incluir en el mensaje al cliente.
alter table choferes add column if not exists auto_modelo text;
alter table choferes add column if not exists auto_patente text;
