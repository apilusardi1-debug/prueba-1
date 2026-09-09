-- El bucket "videos-agencia" (público, creado a mano en Storage) permite
-- lectura anónima por default, pero Storage bloquea la escritura (upload/
-- delete) hasta que se agregue una política explícita en storage.objects.
-- Mismo patrón "acceso total temporal" que el resto de las tablas del
-- proyecto (ver 20260728_rls.sql).
create policy "acceso_total_temporal_videos_agencia"
on storage.objects for all
using (bucket_id = 'videos-agencia')
with check (bucket_id = 'videos-agencia');
