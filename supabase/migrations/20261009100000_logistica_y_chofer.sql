-- Logística (Francisco): ve Operaciones, Agenda, Chat interno y Equipo, y puede crear cuentas de choferes.
-- Chofer: cuenta simple que solo ve el chat interno de sus operaciones.

alter table usuarios_admin drop constraint if exists usuarios_admin_rol_check;
alter table usuarios_admin add constraint usuarios_admin_rol_check
  check (rol in ('superadmin', 'admin', 'operativo', 'ventas', 'lectura', 'logistica', 'chofer'));

alter table permisos_tipos drop constraint if exists permisos_tipos_tipo_check;
alter table permisos_tipos add constraint permisos_tipos_tipo_check
  check (tipo in ('operativo', 'ventas', 'lectura', 'logistica', 'chofer'));

insert into permisos_tipos (tipo, secciones) values
  ('logistica', array['operaciones', 'agenda', 'chat_interno', 'equipo']),
  ('chofer', array['chat_interno'])
on conflict (tipo) do nothing;
