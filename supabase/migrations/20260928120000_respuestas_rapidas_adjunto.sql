-- Respuestas rapidas con archivo adjunto opcional (foto, PDF, video o audio),
-- como las plantillas de chat de Kommo. El archivo vive en el bucket
-- whatsapp-media, carpeta "plantillas/"; aca se guarda la ruta y sus datos.
alter table respuestas_rapidas
  add column if not exists adjunto_path   text,
  add column if not exists adjunto_tipo   text check (adjunto_tipo in ('image', 'video', 'audio', 'document')),
  add column if not exists adjunto_mime   text,
  add column if not exists adjunto_nombre text;
