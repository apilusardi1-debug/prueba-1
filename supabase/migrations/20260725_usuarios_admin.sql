-- Usuarios del panel admin (login propio, no Supabase Auth) + rol para
-- limitar qué secciones puede ver cada uno. La contraseña se guarda como
-- hash SHA-256 (no en texto plano), calculado en el navegador con
-- crypto.subtle antes de guardar/comparar — no es una tabla con RLS
-- (mismo criterio que el resto de las tablas de este proyecto), así que
-- no reemplaza una autenticación real tipo Supabase Auth, solo evita
-- guardar contraseñas legibles directamente.
create table if not exists usuarios_admin (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  email         text not null unique,
  password_hash text not null,
  rol           text not null default 'operativo' check (rol in ('admin', 'operativo', 'lectura')),
  activo        boolean not null default true,
  created_at    timestamptz default now()
);

-- Usuario admin inicial, mismo login que ya usaban (admin@turismo.com / admin123)
-- para no perder acceso al panel. Cambiá esta contraseña desde
-- Configuración → Accesos apenas puedas.
insert into usuarios_admin (nombre, email, password_hash, rol)
values ('Admin', 'admin@turismo.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin')
on conflict (email) do nothing;
