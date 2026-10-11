-- El mensaje al derivar era uno solo para Paquetes y Paseos/Traslados, pero no tiene sentido
-- compartido: el de Paquetes habla de "completar el formulario" (pasó por el filtro) y el de
-- Paseos nunca pasó por ningún formulario (deriva directo). Pedido de Cristian, 2026-10-11.
alter table bot_config add column if not exists mensaje_derivacion_paseos text
  not null default 'En breve, uno de nuestros asesores va a continuar con tu atención!
Mientras aguardás, te invitamos a conocer nuestro Instagram y página web, donde vas a poder descubrir un poco más sobre nuestro trabajo, destinos y experiencias.

https://www.instagram.com/dreamtours_esp?dlrf=MThrdWlxdmllZ3l3ag==

https://agenciadreamtoursbrasil.com/?utm_source=ig&utm_medium=social&utm_content=link_in_bio';
