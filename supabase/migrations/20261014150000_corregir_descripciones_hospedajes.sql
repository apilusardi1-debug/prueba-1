-- Corrige descripciones de hospedajes y habitaciones mal traducidas del portugués
-- (traducción automática de la importación): "Pipa" quedó como "la cometa", "Natal"
-- como "Navidad", "Sombra e Água Fresca" como "la sombra y el recurso de agua dulce",
-- "Porto de Galhas", "categoría Lojo", "LCD TC". Solo datos, no cambia tablas.
-- Cada UPDATE se aplica únicamente si el texto todavía tiene el error, así no pisa
-- una corrección hecha a mano desde el admin.

begin;

-- Sombra e Água Fresca Resort (Pipa)
update hospedajes set descripcion =
'Sombra e Água Fresca Resort, en Pipa, es para descansar de verdad. Tiene 10 casas amuebladas y decoradas con lujo, para que te sientas en una casa de playa súper acogedora sin resignar un servicio de hotel del más alto nivel. Cada detalle de la decoración está pensado para que te sientas como en casa.

Los alojamientos se dividen en 4 categorías: superlujo, premium, vista al mar, y vista al mar con piscina, sauna y jacuzzi privados. También hay villas de lujo individuales con spa y bañera de hidromasaje. Todo a solo 150 m de la Praia do Amor.'
where id = '00bce4c7-96e4-4f5c-9cb3-24528b2df6e8' and descripcion like '%cometa%';

-- Pousada da Ladeira (Pipa)
update hospedajes set descripcion =
'La Pousada da Ladeira está a 100 metros de la playa, en el centro de un antiguo pueblo de pescadores, con vista a la calle principal. Los departamentos tienen aire acondicionado, wifi gratis, TV, minibar y baño privado con ducha de hidromasaje; algunas habitaciones tienen vista parcial al mar.

Sirve un desayuno buffet todos los días, con frutas de estación, y hay bar junto a la piscina. La recepción atiende las 24 horas. Sobre la misma avenida hay muchos restaurantes, bares y tiendas. Natal está a 90 km, y el aeropuerto internacional de São Gonçalo do Amarante (Natal), a unas 2 horas en auto.'
where id = '19b7ae8c-4029-4a03-8e08-6de7b78766f0' and descripcion like '%Navidad%';

-- Pousada Ponta de Mangue (Maragogi): frases cortadas, "pensión", "piscinas naturales. de Gales"
update hospedajes set descripcion =
'La Pousada Ponta de Mangue está en Maragogi (Alagoas), a 450 metros de la Praia de Ponta de Mangue, a la que se llega por senderos dentro del predio, entre la vegetación y el canto de los pájaros. Es una de las playas más lindas de la costa norte de Alagoas, de aguas azules y transparentes, en lo que se conoce como el Caribe brasileño. Ideal para quienes valoran la naturaleza, la tranquilidad y la buena atención.

Está a 8 km de la playa de Maragogi y a 1 km de las piscinas naturales de Galés. Tiene recepción las 24 horas, donde te informan sobre paseos por la región, wifi gratis en las áreas comunes, tres piscinas para adultos y tres para chicos, sendero para caminar, área de juegos, sala de juguetes, inflable y hamacas. Las habitaciones tienen aire acondicionado y minibar. El desayuno está incluido y hay estacionamiento gratis.'
where id = '2a2f8b34-ae11-4780-a0b1-f1332be0ad8e' and descripcion like '%pensión Ponta de Mangue%';

-- 02C Bela Vista (Porto de Galinhas)
update hospedajes set descripcion = replace(descripcion, 'Porto de Galhas', 'Porto de Galinhas')
where id = 'b7b1b847-5cca-4684-a13d-9eff076ee81b' and descripcion like '%Porto de Galhas%';

-- Enotel, habitación "Lujo con Vista a la Piscina"
update hospedaje_habitaciones set descripcion = replace(descripcion, 'categoría Lojo', 'categoría Lujo')
where id = '73d092ed-39e1-47f5-a797-2831bc3037ed' and descripcion like '%categoría Lojo%';

-- Xamã Senses, tres habitaciones: "LCD TC con Sky" y un punto doble
update hospedaje_habitaciones set descripcion = replace(replace(descripcion, 'LCD TC con Sky', 'TV LCD con Sky'), 'comodidades..', 'comodidades.')
where id in ('d7043c5a-5ef7-4200-834e-5b30ebe147ba', 'd11cd31b-4479-4014-a57f-9e04b30ae680', 'a3f4d50c-9877-488b-8770-4d9ffc709994')
  and descripcion like '%LCD TC%';

commit;
