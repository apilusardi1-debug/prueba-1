-- Horario real de partida/regreso por excursión, reemplaza el diccionario
-- hardcodeado en Agenda.jsx (HORARIOS_EXCURSION) que matcheaba por nombre.
alter table excursiones add column if not exists hora_salida text not null default '8:00 AM';
alter table excursiones add column if not exists hora_regreso text not null default '6:00 PM';

-- Preserva los horarios especiales que ya existían hardcodeados en el frontend.
update excursiones set hora_salida = '7:00 AM', hora_regreso = '6:00 PM' where nombre ilike '%maragogi%';
update excursiones set hora_salida = '6:30 AM', hora_regreso = '5:30 PM' where nombre ilike '%carneiros%';
