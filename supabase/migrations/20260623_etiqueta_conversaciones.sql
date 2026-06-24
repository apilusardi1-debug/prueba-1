alter table conversaciones add column if not exists etiqueta text check (etiqueta in ('lead','interesado','cliente','no_interesa'));
create index if not exists idx_conversaciones_etiqueta on conversaciones(etiqueta);
