-- Niveles de usuario: superadmin (control total, define qué ve cada tipo), admin (administra
-- usuarios de los tipos operativo, ventas y lectura) y los tipos con secciones definidas por el
-- superadmin. Antes el rol no admitía "ventas" ni "superadmin".

alter table usuarios_admin drop constraint if exists usuarios_admin_rol_check;
alter table usuarios_admin add constraint usuarios_admin_rol_check
  check (rol in ('superadmin', 'admin', 'operativo', 'ventas', 'lectura'));

update usuarios_admin set rol = 'superadmin' where email in ('bellostacristian@gmail.com', 'apilusardi1@gmail.com');
update usuarios_admin set rol = 'admin' where email = 'portilloindupartjc@gmail.com';

-- Secciones que ve cada tipo. Las claves son las secciones del panel (ver src/lib/secciones.js).
create table if not exists permisos_tipos (
  tipo      text primary key check (tipo in ('operativo', 'ventas', 'lectura')),
  secciones text[] not null default '{}'
);

insert into permisos_tipos (tipo, secciones) values
  ('operativo', array['dashboard', 'clientes', 'embudo_paquetes', 'embudo_paseos', 'embudo_anfitriona', 'whatsapp', 'reservas', 'traslados', 'paseos', 'agenda', 'chat_interno', 'hospedajes', 'videos', 'paquetes_clientes', 'paquetes_generador', 'paquetes_enviadas', 'paquetes_cerradas', 'equipo']),
  ('ventas', array['whatsapp', 'embudo_paquetes', 'paquetes_generador']),
  ('lectura', array['dashboard', 'reservas', 'agenda', 'paseos'])
on conflict (tipo) do nothing;

-- Sin políticas: solo la función usuarios-admin (service role) puede leerla o cambiarla.
alter table permisos_tipos enable row level security;
