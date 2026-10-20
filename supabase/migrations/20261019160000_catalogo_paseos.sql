-- Mensaje de Paseos/Traslados con el catálogo en PDF (pedido de Abril, 2026-10-19): el asistente
-- manda el texto del catálogo con un botón "Ver catálogo" que abre el PDF. El botón se edita en
-- Entrenar asistente (nodo Paseos), igual que el de Paquetes. El texto nuevo y el botón se
-- cargan recién al desplegar webhook-whatsapp (antes de eso el asistente no manda el botón):
-- ver el update del final, que se corre aparte.
alter table bot_config
  add column if not exists boton_paseos_texto text,
  add column if not exists boton_paseos_url   text;

-- Bucket público para archivos que se comparten con los clientes (catálogos)
insert into storage.buckets (id, name, public)
values ('catalogos', 'catalogos', true)
on conflict (id) do nothing;

drop policy if exists "acceso_total_temporal_catalogos" on storage.objects;
create policy "acceso_total_temporal_catalogos" on storage.objects for all
  using (bucket_id = 'catalogos') with check (bucket_id = 'catalogos');

-- (Se corre después de desplegar webhook-whatsapp)
-- update bot_config set
--   mensaje_derivacion_paseos = '🌴 Preparamos este catálogo en PDF con mucho cariño, con actividades y paseos que realiza nuestra agencia por la región.
-- 
-- 📸 Las fotos e imágenes fueron tomadas por nosotros mismos, viviendo de cerca cada experiencia que recomendamos.
-- 
-- ✨ ¡Ahora es tu turno de disfrutarlo.!
-- Te invitamos a abrirlo y comenzar a planear momentos inolvidables en este paraíso.',
--   boton_paseos_texto = 'Ver catálogo',
--   boton_paseos_url = 'https://przvftnhwwistmcbkeon.supabase.co/storage/v1/object/public/catalogos/catalogo-paseos-dreamtours.pdf';

