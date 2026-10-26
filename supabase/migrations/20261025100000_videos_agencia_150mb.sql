-- Videos del panel (Configuración > Videos y videos de hospedajes) de hasta 150 MB por archivo
-- (pedido de Cristian, 2026-10-25: videos de hasta unos 3 minutos; antes el máximo era 50 MB).
-- El proyecto ya está en el plan Pro, que permite más de 50 MB.
--
-- Además de esto, en Supabase > Storage > Settings, "Upload file size limit" tiene que ser de
-- 150 MB o más: si el límite general es menor, manda ese.
-- En la pantalla el máximo está en MAX_MB_VIDEO_AGENCIA (src/lib/supabase.js).

update storage.buckets
   set file_size_limit = 150 * 1024 * 1024
 where id = 'videos-agencia';

-- Control: tiene que decir 157286400 (150 MB)
select id, file_size_limit from storage.buckets where id = 'videos-agencia';
