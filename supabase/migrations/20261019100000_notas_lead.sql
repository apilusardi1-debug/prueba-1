-- Notas rápidas del chat del CRM (pedido de Abril, 2026-10-19). Las notas pasan a poder
-- colgar del lead además del cliente, así una persona que todavía es lead tiene notas
-- sueltas (con autor y fecha, borrables de a una) igual que un cliente. La ficha única y el
-- panel del chat muestran las notas del lead y las del cliente juntas.
-- leads.notas (el texto viejo) queda como estaba y se sigue mostrando como "Notas del lead".

alter table notas_clientes add column if not exists lead_id uuid references leads(id) on delete cascade;
create index if not exists notas_clientes_lead_idx on notas_clientes (lead_id, created_at desc);
