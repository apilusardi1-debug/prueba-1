-- Fotos, audios, videos y documentos en el CRM de WhatsApp: el webhook baja el
-- archivo desde Meta y lo guarda en un bucket privado; el mensaje guarda solo
-- la ruta (el CRM pide un link firmado temporal al mostrarlo).
alter table mensajes
  add column if not exists tipo         text not null default 'texto',
  add column if not exists media_path   text,
  add column if not exists media_mime   text,
  add column if not exists media_nombre text;

insert into storage.buckets (id, name, public)
values ('whatsapp-media', 'whatsapp-media', false)
on conflict (id) do nothing;

drop policy if exists "crm_media_lectura" on storage.objects;
create policy "crm_media_lectura" on storage.objects
  for select using (bucket_id = 'whatsapp-media');
