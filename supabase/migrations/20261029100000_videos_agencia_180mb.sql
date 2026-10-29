-- Videos del panel (Configuración > Videos y videos de hospedajes) de hasta 180 MB por archivo
-- (pedido de Cristian, 2026-10-29; antes 150 MB, y antes de eso 50 MB).
--
-- Además de esto, en Supabase > Storage > Settings, "Upload file size limit" tiene que ser de
-- 180 MB o más: si el límite general es menor, manda ese.
-- En la pantalla el máximo está en MAX_MB_VIDEO_AGENCIA (src/lib/supabase.js).

update storage.buckets
   set file_size_limit = 180 * 1024 * 1024
 where id = 'videos-agencia';

-- Control: tiene que decir 188743680 (180 MB)
select id, file_size_limit from storage.buckets where id = 'videos-agencia';
