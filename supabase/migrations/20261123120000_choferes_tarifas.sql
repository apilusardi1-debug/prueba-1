-- Choferes: tarifa propia por paseo (por viaje, no por pasajero), capacidad del vehículo y notas.
-- Solo agrega columnas opcionales; no cambia ningún dato existente.
alter table choferes add column if not exists tarifas jsonb not null default '{}'::jsonb;
alter table choferes add column if not exists capacidad int;
alter table choferes add column if not exists notas text;

-- Carga del listado de conductores (23/11/2026). Los que ya existen por nombre no se tocan.
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Douglas Barrionuevo', '5581996472820', true, 'Chevrolet Spin', 6, null, '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":350,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":300,"72603c26-878d-4f65-a59c-56034b5bb948":300}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Douglas Barrionuevo'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Marcos', '5581981502470', true, 'Spin', 6, null, '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":350,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":300,"72603c26-878d-4f65-a59c-56034b5bb948":300}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Marcos'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Siberia', '5581986782144', true, 'Spin', 6, null, '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":350,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":300,"72603c26-878d-4f65-a59c-56034b5bb948":300}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Siberia'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Adriano', '5581992957157', true, 'Spin', 6, null, '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":400,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":300,"72603c26-878d-4f65-a59c-56034b5bb948":300}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Adriano'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Jonas', '5581981382152', true, 'Spin', 6, null, '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":350,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":300,"72603c26-878d-4f65-a59c-56034b5bb948":300}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Jonas'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Igor', '', true, 'Spin', 6, 'Habla español. Es difícil conseguir disponibilidad.', '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":400,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":300,"72603c26-878d-4f65-a59c-56034b5bb948":300}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Igor'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Shirlene', '5581989430513', true, 'Spin', 6, null, '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":350,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":300,"72603c26-878d-4f65-a59c-56034b5bb948":300}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Shirlene'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'José', '5581991655170', true, 'Spin', 6, null, '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":350,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":300,"72603c26-878d-4f65-a59c-56034b5bb948":300}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('José'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Abrao', '5581992542443', true, 'Spin', 6, null, '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":350,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":300,"72603c26-878d-4f65-a59c-56034b5bb948":300}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Abrao'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Josemias', '5581991805641', true, 'Spin', 6, null, '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":350,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":300,"72603c26-878d-4f65-a59c-56034b5bb948":300}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Josemias'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Bartolomeo', '5581996208976', true, 'Spin', 6, null, '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":350,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":300,"72603c26-878d-4f65-a59c-56034b5bb948":300}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Bartolomeo'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Cleyton', '5581992421647', true, 'Spin', 6, null, '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":400,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":300,"72603c26-878d-4f65-a59c-56034b5bb948":300}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Cleyton'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Hericles', '5581988348980', true, 'Spin', 6, null, '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":350,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":300,"72603c26-878d-4f65-a59c-56034b5bb948":300}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Hericles'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Lucas', '5581994960919', true, 'Spin', 6, null, '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":350,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":300,"72603c26-878d-4f65-a59c-56034b5bb948":300}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Lucas'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Lennon', '5581995498181', true, 'Automóvil', 4, null, '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":300,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":300,"72603c26-878d-4f65-a59c-56034b5bb948":300}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Lennon'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Eliezer', '5581994985805', true, 'Automóvil', 4, null, '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":300,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":300,"72603c26-878d-4f65-a59c-56034b5bb948":300}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Eliezer'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Lourdes', '5581999801487', true, 'Automóvil', 4, 'Maragogi: en algunas ocasiones R$ 350.', '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":300,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":300,"72603c26-878d-4f65-a59c-56034b5bb948":300}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Lourdes'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Cícero', '5581993832519', true, 'Automóvil', 4, 'Trabaja únicamente los días pares del mes (2, 4, 6, 8, etc.).', '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":300,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":250,"72603c26-878d-4f65-a59c-56034b5bb948":250}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Cícero'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Michel', '5581989877288', true, 'Automóvil', 4, 'Trabaja únicamente los fines de semana.', '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":350,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":300,"72603c26-878d-4f65-a59c-56034b5bb948":300}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Michel'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Mauricio', '', false, 'Automóvil', 4, 'Actualmente no está trabajando, pero tiene previsto regresar.', '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":300,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":250,"72603c26-878d-4f65-a59c-56034b5bb948":250}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Mauricio'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Alef', '', false, 'Automóvil', 4, 'Actualmente no está trabajando, pero tiene previsto regresar.', '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":300,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":250,"72603c26-878d-4f65-a59c-56034b5bb948":250}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Alef'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Eduarda', '5581991230789', true, 'Automóvil', 4, null, '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":350,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":300,"72603c26-878d-4f65-a59c-56034b5bb948":300}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Eduarda'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Douglas Souza', '5581987441914', true, 'Automóvil', 4, null, '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":300,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":250,"72603c26-878d-4f65-a59c-56034b5bb948":250}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Douglas Souza'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Hector', '', true, 'Automóvil', 3, 'Es peruano. Máximo 3 pasajeros. Falta cargar su teléfono.', '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":300,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":300,"72603c26-878d-4f65-a59c-56034b5bb948":300}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Hector'));
insert into choferes (nombre, whatsapp, activo, auto_modelo, capacidad, notas, tarifas)
select 'Mamitesh', '', true, 'Automóvil', 4, 'Falta cargar su teléfono.', '{"ceb0b15e-7c36-4ec1-9116-32af8fd6f107":400,"7ec88755-fc68-45ef-a4d1-9af01d4ea62b":350,"72603c26-878d-4f65-a59c-56034b5bb948":350}'::jsonb
where not exists (select 1 from choferes where lower(nombre) = lower('Mamitesh'));
