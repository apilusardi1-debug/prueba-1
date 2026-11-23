-- Tarifas netas (lo que se le paga al proveedor) de las actividades, por persona.
-- Fuente: tabla de tarifas netas para agencias (23/11/2026). Solo inserta costos nuevos.
insert into costos_excursion (excursion_id, concepto, tipo, monto_por_persona, moneda, activo)
select e.id, 'Tarifa neta', 'por_persona', v.neto, 'BRL', true
from (values
  ('05ea154a-c8e3-478a-b7ad-2d5b4d9cad94'::uuid, 100),  -- Buceo con cilindro
  ('db4b9a0f-5e5a-4583-b5da-fc228c2d47d5'::uuid, 100),  -- Clase de Surf
  ('5bd2fa18-155e-4db3-a9db-9a669e15e6e1'::uuid, 135),  -- Kayak a las piscinas naturales
  ('198296b1-7b54-4706-aa61-ffa69a2ded76'::uuid, 100),  -- Shopping RioMar
  ('e7378f56-08d6-4045-b70a-18d71a565f1f'::uuid, 350)   -- Vuelo en Paramotor
) as v(id, neto)
join excursiones e on e.id = v.id
where not exists (select 1 from costos_excursion c where c.excursion_id = v.id and c.activo and c.concepto = 'Tarifa neta');
