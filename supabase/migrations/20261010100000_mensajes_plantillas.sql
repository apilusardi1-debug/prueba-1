-- Textos de los avisos internos de operación (choferes y guías) editables desde Mensajes.
-- Solo las funciones de usuarios-admin leen y cambian esta tabla (sin políticas, igual que usuarios_admin).

create table if not exists mensajes_plantillas (
  clave           text primary key,
  texto           text not null,
  actualizado_at  timestamptz not null default now(),
  actualizado_por text
);

alter table mensajes_plantillas enable row level security;

insert into mensajes_plantillas (clave, texto) values
  ('operacion_guia', E'🗺 *{excursion}*\n📅 {fecha}\n🕐 SAÍDA: {salida} — Volta: {volta}\n\n*Passageiros da operação:*\n\n{pasajeros}'),
  ('operacion_chofer', E'🗺 *{excursion}*\n📅 {fecha}\n🕐 SAÍDA: {salida}\n\n*Seus passageiros:*\n\n{pasajeros}\n\nQualquer dúvida sobre a operação, fale com o guia *{guia}* 📱 +{guia_whatsapp}')
on conflict (clave) do nothing;
