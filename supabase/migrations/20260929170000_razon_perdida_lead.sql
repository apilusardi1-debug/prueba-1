-- Motivo de perdida que se pide al mover un lead a mano a una etapa perdida
-- (combo tipo Kommo). Texto libre, sin CHECK: la lista de motivos vive en el
-- frontend (RAZONES_PERDIDA en Leads.jsx) porque todavia va a cambiar.
alter table leads add column if not exists razon_perdida text;
