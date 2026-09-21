-- Etiquetas propias y valor de cada lead, como en el Funil de vendas de Kommo
-- (etiquetas tipo VIVO o ENTRO POR PASEOS, y "Clientes potenciales: R$").

alter table leads add column if not exists etiquetas text[] not null default '{}';
alter table leads add column if not exists valor numeric(12, 2) not null default 0;

create index if not exists idx_leads_etiquetas on leads using gin (etiquetas);
