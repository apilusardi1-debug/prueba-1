-- Routing del CRM: a qué usuario del panel está asignada cada conversación.
-- Nullable = sin asignar (así queda hoy toda conversación existente).
alter table conversaciones add column if not exists asignado_a uuid references usuarios_admin(id);
