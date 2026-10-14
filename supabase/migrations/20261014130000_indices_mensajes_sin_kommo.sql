-- Con el historial de Kommo cargado (~242.000 mensajes con origen = 'kommo') las métricas
-- del CRM (crm_metricas, crm_sin_responder) recorrían todos los mensajes para después
-- descartar los importados, y pasaban los 3 segundos que Supabase le da a cada consulta del
-- panel: el Dashboard mostraba "No se pudieron cargar las métricas del CRM". Estos índices
-- parciales dejan afuera los mensajes de Kommo desde el principio (corrida 2026-10-14:
-- crm_metricas bajó de ~3 s a ~0,4 s). El filtro tiene que ser exactamente el mismo que
-- usan las funciones (origen is distinct from 'kommo') para que la base los use.
create index if not exists idx_mensajes_sin_kommo_conv
  on mensajes (conversacion_id, created_at, id)
  where origen is distinct from 'kommo';

create index if not exists idx_mensajes_sin_kommo_fecha
  on mensajes (created_at)
  where origen is distinct from 'kommo';

analyze mensajes;
