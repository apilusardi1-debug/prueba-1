# DreamsTour — Contexto del Proyecto

## Quiénes somos
Cristian y Abril desarrollan una plataforma web completa para **DreamsTour**, agencia de turismo con domicilio legal en Jaboatão dos Guararapes (PE) y operación en Porto de Galinhas, Ipojuca (PE), Brasil. Razón social DREAM TOURS AGENCIA DE TURISMO E SERVICOS LTDA, CNPJ 57.371.792/0001-28. El proyecto está en producción activa.

## Stack tecnológico
- **Frontend**: React 18 + Vite + TailwindCSS + React Router v6
- **Backend**: Supabase (PostgreSQL + Edge Functions en Deno)
- **Deploy**: Vercel (cuenta de Abril) — rama `main` de GitHub → auto-deploy
- **Repositorio**: GitHub `apilusardi1-debug/prueba-1`
- **URL de producción**: `prueba-1-rose.vercel.app` — esta es la URL definitiva

## Flujo de trabajo Git
```
git pull origin main   # antes de trabajar
# ... cambios ...
git add <archivos>
git commit -m "mensaje"
git push origin main   # Vercel despliega automáticamente
```

## Módulos implementados
| Módulo | Ruta | Estado |
|--------|------|--------|
| Dashboard | `/admin` | ✅ Activo |
| Agenda / Calendario | `/admin/agenda` | ✅ Activo |
| Reservas | `/admin/reservas` | ✅ Activo |
| Clientes | `/admin/clientes` | ✅ Activo |
| Leads | `/admin/leads` | ✅ Activo |
| Excursiones | `/admin/excursiones` | ✅ Activo |
| Choferes | `/admin/choferes` | ✅ Activo |
| Guías | `/admin/guias` | ✅ Activo |
| Equipo / Vendedores | `/admin/equipo` | ✅ Activo |
| Finanzas | `/admin/finanzas` | ✅ Activo — control manual (sin ningún método de pago conectado, ver más abajo) |
| Hospedajes | `/admin/hospedajes` | ✅ Activo |
| Embudo de paseos (Leads) | `/admin/leads/paseos` | Activo (el de paquetes es `/admin/leads`) |
| Embudo de anfitriona (Leads, posventa) | `/admin/leads/anfitriona` | ✅ Activo |
| CRM WhatsApp | `/admin/crm/whatsapp` | Activo, en pruebas con número propio |

## Supabase
- **Proyecto**: `przvftnhwwistmcbkeon`
- **URL**: `https://przvftnhwwistmcbkeon.supabase.co`
- **ANON KEY**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByenZmdG5od3dpc3RtY2JrZW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3ODQ5NjYsImV4cCI6MjA5NjM2MDk2Nn0.HAxYnVc4Anxcq8gfA9h_aS3CAuF_qhTx0EedI4_10r4`

### Edge Functions existentes
- `send-whatsapp` — envía por Meta Cloud API: plantillas del número operativo (avisos de cerrar operación) y texto o archivos del número del CRM. Guarda el id del mensaje para seguir su estado de entrega
- `webhook-whatsapp` — webhook de Meta del número del CRM: mensajes entrantes (con fotos, audios y documentos), asistente automático de menú y avisos de estado (enviado / entregado / leído / fallido)
- `usuarios-admin` — login y gestión de usuarios del panel
- `proxy-imagen` — descarga imágenes para los PDF de propuestas
- `catalogo-interno` — punto de acceso único para un grupo de tablas internas (ver "RLS — endurecida tabla por tabla" más abajo)
- `enviar-push-chofer` — manda la notificación push al chofer cuando se crea su aviso (ver "Chat interno" más abajo). Desplegada con `--no-verify-jwt` (la llama un trigger de la base, no una persona)
- `sync-whatsapp`, `whatsapp-status`, `health-check` — heredadas de WuzAPI (desconectado)
- Código compartido entre funciones y frontend: `supabase/functions/_shared/` (detección de interés, estados de entrega, etiquetas del asistente, embudo de entrada, filtrado de Paquetes, lectura de los datos del viaje)

### Secrets en Supabase
- `META_CRM_WHATSAPP_TOKEN`, `META_CRM_PHONE_NUMBER_ID`, `META_CRM_REGISTRATION_PIN`, `META_VERIFY_TOKEN` — Meta Cloud API, número del CRM y webhook
- `META_WHATSAPP_TOKEN`, `META_PHONE_NUMBER_ID` — Meta Cloud API, número operativo (avisos de cerrar operación). El token está inválido (error 190 de Meta) y hay que generar uno permanente nuevo
- `BOT_ESPERA_RAFAGA_MS` — opcional: milisegundos que el asistente espera antes de contestar por si el contacto sigue escribiendo (por defecto 4000; 0 = sin espera)
- `WUZAPI_URL`, `WUZAPI_TOKEN` — WuzAPI (VPS, desconectado)
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` — Evolution API (instalado en VPS, pendiente de configurar)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — uso interno en Edge Functions
- `PANEL_SESSION_SECRET` — firma del token de sesión del panel (HMAC-SHA256)
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — firman las notificaciones push a choferes (protocolo Web Push estándar, no dependen de ningún servicio externo)

## WhatsApp — Arquitectura
Hay DOS flujos, con dos números y dos apps de Meta distintos. Ambos usan Meta Cloud API directo (sin proveedor intermedio).

### 1. Mensajes internos (operaciones)
Al **cerrar una operación** (Agenda), al CLIENTE se le manda `aviso_cliente` por el número operativo (app `Dreamstourwhatsappoperativo`, 1 por reserva, categoría utilidad). Al GUÍA y a cada CHOFER ya no se les manda nada por Meta: desde el 2026-09-25 su aviso queda en el **chat interno de operaciones**, un link personal sin contraseña (`/guia/:token`, `/chofer/:token` — `PanelOperativo.jsx`), en portugués, con botón "Recebido" y un botón por pasajero que abre WhatsApp (wa.me) con el mensaje ya armado para que se lo manden ellos mismos desde su propio celular. El link se copia desde Equipo > Guías/Choferes ("Copiar link"). El admin ve en vivo si cada uno lo abrió (Leído) o confirmó (Recebido) desde Agenda > Gestionar.
- **Función**: `send-whatsapp` (solo para `aviso_cliente`). **Frontend**: `src/lib/ultramsg.js` (`sendWhatsAppTemplate`, el nombre es histórico), `operacionesApi`/`panelOperativoApi` en `src/lib/supabase.js`
- **Estado**: `aviso_cliente` no envía nada hasta regenerar el token operativo (ver Secrets); el chat interno de guía/chofer no depende de ese token y ya está en producción
- **Migración**: `supabase/migrations/20260925100000_chat_interno_operaciones.sql` (agrega `token` a `guias`/`choferes`, crea `operaciones` y `operaciones_avisos`)
- **Choferes, además**: su link se puede instalar como ícono en el celular (manifest por chofer en `api/chofer-manifest.js`, íconos en `public/icon-chofer-*.png`, service worker `public/sw-chofer.js`) y recibir notificaciones push cuando se crea su aviso — botón "Ativar notificações" en `PanelOperativo.jsx`, probado en producción el 2026-10-10. Tabla `chofer_push_subscripciones` + trigger en `operaciones_avisos` que llama a `enviar-push-chofer` (migración `20261010120000_chofer_push.sql`). Por ahora solo choferes, no guías

### 2. CRM comercial (atención al cliente)
Inbox propio con reparto de conversaciones entre el equipo. Número de prueba **+55 81 99719-9422** (app "DreamsTour CRM" `3006251579723473`, WABA `847194981749193`, phone number id `1254559544416464`).
- **Regla**: el número que hoy usa la agencia en Kommo (+55 81 9768-2691, WABA `273455669191563`) **no se toca** hasta la migración planificada
- **Funciona**: enviar y recibir (con fotos, audios y documentos), ventana de 24 hs, asistente automático de menú (Paquetes o Paseos, reparto entre 5 personas) prendido en todos los chats y con un interruptor por chat para pausarlo (columna `conversaciones.bot_pausado`), que pasa el lead al embudo del grupo que elige el contacto, filtrado de los clientes de Paquetes (pide en un solo mensaje destino, adultos, menores con su edad, presupuesto y fechas, solo lo que todavía no dijeron, y hace a lo sumo una pregunta de seguimiento antes de derivar; textos y rangos editables en Configuración > Asistente; estado `filtrando`), filtros por persona, interés del lead detectado por palabras clave, estado de entrega de cada mensaje, "Marcar como atendida", marcos amarillo (12 hs) y rojo (18 hs) para lo que espera respuesta, avisos de mensaje nuevo (sonido y notificación) y métricas en el Dashboard
- **Pedido web de paseos** (2026-10-13): en el sitio, "Mi selección" (`src/components/public/SeleccionPaseos.jsx`) arma un mensaje de WhatsApp con los paseos elegidos, fechas de estadía, pasajeros, edades de menores y código de vendedor opcional, y lo abre hacia `site_config.whatsapp` (hoy número de prueba: hay que poner el del CRM). El formato vive en `supabase/functions/_shared/pedidoWebPaseos.ts`, que usan la web y `webhook-whatsapp`: el webhook reconoce el mensaje, deriva directo a Paseos sin menú (aunque estuviera a mitad del cuestionario de Paquetes), pasa el lead al embudo de Paseos aunque el asistente no conteste (apagado, pausado o chat ya asignado; misma guarda: solo desde una etapa de entrada), pone interés "paseo" + destinos, etiqueta "Pedido web" y "Vendedor: Nombre (CÓDIGO)" si el código existe en `vendedores`. La reserva de paseos ya no se crea desde el sitio
- **Pedido web de paquete** (2026-10-13): en `/paquetes`, "Armar mi paquete" abre un formulario (`src/components/public/FormularioPaquete.jsx`) con los mismos datos que el formulario del asistente (nombre, destinos, país, ciudad de origen, adultos, menores con edad, hospedaje, presupuesto en USD, fechas) y abre WhatsApp con el mensaje armado. Formato en `supabase/functions/_shared/pedidoWebPaquete.ts` (mismas líneas "Campo: valor" que `textoDesdeFlow`, así `datosViaje.ts` lo lee igual). El webhook lo reconoce: etiqueta "Pedido web", interés "paquete" + destinos, nombre del formulario si WhatsApp no trae uno, pasa el lead al embudo de Paquetes y a Filtrado aunque el asistente no conteste (mismas guardas), y el asistente deriva directo a Paquetes sin menú ni preguntas
- **Costos de Meta** (desde jul-2025 se cobra por mensaje entregado; tabla `tarifas_mensaje`, editable desde el Dashboard): utilidad R$0,035, marketing R$0,34, autenticación R$0,17. Responder con texto libre dentro de las 24 hs es gratis
- **Pendiente**: responder pasadas las 24 hs necesita una plantilla aprobada (a consultar con Florencia); migrar el número real desde Kommo

## Reservas = planilla del equipo de paseos (2026-10-13)
`/admin/reservas` tiene las columnas y filtros del Excel con el que trabajaba el equipo de paseos ("NUEVA PLANILLA"): fecha de venta, cliente, cantidad, paseo, fecha del paseo, valor venta, saldo cliente, chofer del día, comisión chofer, hospedaje, obs., seña (= comisión del vendedor), contacto, vendedor, más "Sin traslado" y moneda (R$ o US$). La comisión de la agencia ("COMISION DREAM") se carga **por día** en "Comisión diaria" (tabla `comisiones_agencia_diarias`, por `catalogo-interno`).

`/admin/paquetes/planilla` (Paquetes > Planilla) reemplaza el Excel "PLANILLA VIAJES" del equipo de paquetes: mismas columnas (hora y fecha de llegada, cliente, cantidad, hospedaje, regreso, saldo, llave PIX, observaciones, contacto del hospedaje, link de detalles y servicios en Canva, contacto del cliente, info extra). Tabla `viajes_paquetes`, solo por `catalogo-interno`. Las pestañas VIAJES y YA SE FUERON son dos vistas: un viaje "ya se fue" cuando pasó su fecha de regreso. Importar el Excel: `scripts/importar-planilla-paquetes.mjs` (igual que el de paseos; los datos quedan en `~/Desktop/reservas-paquetes/`, nunca en el repo). Cada viaje se une solo a su lead y cliente por el teléfono de "Contacto cliente" (triggers de `20261015120000_viajes_paquetes_vinculos.sql`): fechas → vuelos del lead, saldo → `saldos` (concepto paquetes, `viaje_id`, sincronizado en las dos direcciones), hospedaje/PIX/contacto → `anfitriona_hospedajes` (`viaje_id`, también en las dos direcciones). Si el viaje tiene todos los datos (fecha y hora de llegada y regreso, hospedaje, saldo) y el lead está en Paquetes, pasa a Anfitriona (sin marcar `ganado_at`; alarmas solo futuras y las de cobro solo con saldo > 0). La ficha única muestra "Viaje de paquete". Las reservas de `/admin/reservas` también se unen solas al lead por `cliente_whatsapp` (`reservas.lead_id`, migración `20261015140000_reservas_vinculo_lead.sql`), así la ficha muestra paseos y traslados aunque la persona sea solo lead. En las dos planillas el nombre abre la ficha y el teléfono abre el chat del CRM (`src/lib/chatCrm.js`), no WhatsApp.
- Columnas nuevas de `reservas` y tabla de comisión: migración `20261014100000_reservas_planilla_paseos.sql`. Helpers compartidos: `src/lib/reservasPlanilla.js`; formulario: `src/components/admin/ModalReservaPlanilla.jsx`.
- Paseo, chofer y vendedor son texto libre (`paseo`, `chofer_texto`, `vendedor_texto`); si el paseo es del catálogo además queda `excursion_id`. Los traslados ("Traslado Porto → Aeropuerto Recife") y paseos fuera de la web ("Jangada") solo tienen el texto: la Agenda los agrupa por ese texto (`grupoId`) y no permite "Cerrar operación" para ellos.
- **Los paseos no tienen cupo**: reservar no descuenta `cupos_disponibles` (pedido de Abril).
- **Importación desde el Excel** mientras el equipo siga usándolo: `scripts/importar-planilla-reservas.mjs` (sin datos; los archivos de clientes quedan fuera del repo, en `~/Desktop/reservas-paseos/` de Abril). Genera vista previa CSV + SQL para el SQL Editor + foto JSON para comparar la próxima actualización. Cada fila se reconoce por `clave_planilla` (fecha de venta + cliente + paseo + fecha del paseo). Solo entran paseos de hoy en adelante. Las equivalencias de nombres están en el script.

## VPS Hostinger
- **IP**: `76.13.224.231`
- **SSH**: `ssh root@76.13.224.231`
- **Puerto 8080**: WuzAPI (token: `app2024`, número: `558189375412`)
- **Puerto 8081**: Evolution API (instalado con Docker, pendiente configuración DB)
- **Docker network**: `evo-net`

## Archivos clave
| Archivo | Descripción |
|---------|-------------|
| `src/pages/admin/Agenda.jsx` | Calendario con chips de excursiones; "Cerrar operación" crea los avisos del chat interno |
| `src/pages/public/PanelOperativo.jsx` | Chat interno: link personal de guía/chofer (`/guia/:token`, `/chofer/:token`), sin sesión de admin |
| `src/components/ficha/FichaPersona.jsx` | **Ficha única** (2026-10-14): la misma ficha se abre desde el embudo de Leads y desde Clientes. Junta lead (etapa, vuelos, hospedajes, recordatorios) y cliente (reservas, pagos, propuestas, notas) con un solo listado de saldos (tabla `saldos`, por `lead_id` y/o `cliente_id`, vía `catalogo-interno`). Las fichas viejas siguen en el código detrás de `FICHA_UNICA` en `Leads.jsx` y `Clientes.jsx`; las tablas `anfitriona_saldos` y `cliente_saldos` quedan solo como respaldo |
| `src/pages/admin/Finanzas.jsx` | Control manual de caja, costos operativos y conceptos — sin ningún método de pago conectado |
| `src/pages/admin/crm/WhatsApp.jsx` | CRM WhatsApp (lista/chat/ficha en una sola columna por debajo de 1024px, con flecha de volver) |
| `src/lib/ultramsg.js` | Helper para llamar a `send-whatsapp` Edge Function |
| `src/lib/avisosMensajes.js` | Avisos de mensaje nuevo del CRM (sonido y notificación), enganchado en `AdminLayout` |
| `src/components/admin/dashboard/` | Tarjetas del Dashboard, métricas del CRM e iconos de línea (`Ic.jsx`) |
| `supabase/functions/webhook-whatsapp/index.ts` | Webhook de Meta: mensajes, asistente automático y estados |
| `supabase/migrations/` | Cambios de base de datos. Se corren a mano en el SQL Editor de Supabase |
| `supabase/functions/send-whatsapp/index.ts` | Envío de mensajes WhatsApp |
| `supabase/functions/catalogo-interno/index.ts` | Acceso a las tablas internas ya migradas del plan de RLS |
| `public/propuesta-dreamtours.html` | Presentación comercial |

## Decisiones técnicas importantes
- **URL única**: `prueba-1-rose.vercel.app` es la URL definitiva (no usar `turismoapp.vercel.app`)
- **Moneda**: BRL (Real brasileño) en toda la app
- **Idioma**: Español en la UI, pero el negocio opera en Brasil
- **Sitio público en tres idiomas** (2026-10-14): español, portugués e inglés, según el selector del encabezado (`dt_lang` en el navegador). Cada página o componente tiene su objeto `TEXTOS = { es, pt, en }` arriba y lo lee con `useTextos(TEXTOS)` de `src/context/LanguageContext.jsx` (lo que falte en pt/en sale en español); fechas con el `locale` de `useLang()`. Texto nuevo del sitio: agregarlo en los tres idiomas, nunca escrito directo en el JSX. El contenido de los destinos (`mockData.js`) se traduce en `src/data/destinosTraducciones.js`: al cambiar un texto ahí, actualizarlo en los dos archivos. **No se traduce**: lo que viene de la base (nombres y descripciones de paseos y hospedajes) y los mensajes de WhatsApp de "Mi selección" y "Armar mi paquete", que salen siempre en español porque `webhook-whatsapp` los reconoce por su encabezado en español. El admin y `Reservar.jsx` (sin enlaces en la web) siguen solo en español
- **Números Brasil**: formato con dígito 9 → `5581989375412` (no `558189375412`)
- **No usar UltraMsg**: instancia detenida por falta de pago
- **Sin métodos de pago**: se sacó Mercado Pago (2026-10-08, pedido de Cristian — "nadie va a pagar por la app"). Finanzas sigue existiendo, pero es control manual de caja; no hay ningún cobro conectado ni se va a conectar
- **Sin emojis** en la interfaz nueva: usar los iconos de línea de `src/components/admin/dashboard/Ic.jsx`
- **SEO y carga del sitio público** (2026-10-14): cada página pública llama a `useSeo({ titulo, descripcion, imagen })` de `src/lib/seo.js` (título, descripción, canónica y etiquetas para compartir; `index.html` trae las de la Home). `/robots.txt` (`api/robots.js`) bloquea admin, login y links de guía/chofer; `/sitemap.xml` lo arma `api/sitemap.js` leyendo paseos y alojamientos activos. **Dominio en un solo lugar**: la variable `VITE_SITIO_URL` (en Vercel; sin ella, `https://prueba-1-rose.vercel.app`) la usan `index.html` (`__SITIO_URL__`, reemplazado en `vite.config.js`), `seo.js`, `api/robots.js`, `api/sitemap.js`, los PDF de propuestas y la Agenda. Al migrar a un dominio propio: cargar `VITE_SITIO_URL` en Vercel y volver a desplegar, redirigir el dominio viejo al nuevo y cargar el sitemap nuevo en Search Console (el `VAPID_SUBJECT` de `enviar-push-chofer` es solo un identificador, no hace falta cambiarlo). Las páginas del admin, el link de guía/chofer y `Reservar` se cargan con `lazy()` en `App.jsx`: el visitante baja ~173 KB comprimidos en vez de 1,2 MB. Página nueva del admin: importarla con `lazy()`, no con `import` común
- **Botones del sitio público**: usar `BTN_PRINCIPAL` (amarillo, para cotizar/consultar/armar/agregar), `BTN_SECUNDARIO` / `BTN_SECUNDARIO_OSCURO` (contorno fino, para ver más o navegar) y `BTN_ELEGIDO` de `src/components/public/botones.js`, no armar estilos a mano (2026-10-14)
- **Estilo del panel**: paleta gris/negro con la clase `brand-*` (variables CSS en `src/index.css`) y tarjetas `dash-card`; la web pública conserva su azul
- **Migraciones**: Cristian las corre en el SQL Editor de Supabase. Primero el SQL y después desplegar las funciones que lo usan (`npx supabase functions deploy <nombre> --project-ref przvftnhwwistmcbkeon`)
- **Commits**: `git status -uall` completo y `git add` archivo por archivo; en la raíz hay archivos sueltos que no se suben

## RLS — endurecida tabla por tabla
Hasta 2026-10-08 casi todas las tablas tenían una policy `acceso_total_temporal` (`using (true)`) — la clave pública (anon), sola, alcanzaba para leer o escribir cualquier cosa directo contra la base, sin pasar por el login del panel. Se está cerrando de a una tabla, por orden de riesgo, sin tocar las que ya andan.

**Mecanismo**: las escrituras pasan por la Edge Function `catalogo-interno` (exige sesión del panel vigente, igual chequeo que `send-whatsapp`/`usuarios-admin`), service_role del lado del servidor. Para sumar una tabla nueva alcanza con agregarla a `TABLAS` en `supabase/functions/catalogo-interno/index.ts` y cambiar el `xxxApi` correspondiente en `src/lib/supabase.js` para que llame a `invocarCatalogoInterno(tabla, accion, {...})` en vez de `supabase.from(tabla)`. Las tablas que además lee la web pública (`hospedajes`, `hospedaje_habitaciones`, `agencia_videos`, `site_config`) mantienen la LECTURA directa con una policy `lectura_publica` (`for select using (true)`) — solo la escritura pasa por la función.

**Ya cerradas** (RLS sin `acceso_total_temporal`): `conceptos_movimiento`, `embudo_etapas`, `embudo_automatizaciones`, `respuestas_rapidas`, `costos_excursion`, `agencia_videos`, `site_config`, `traslados`, `propuestas`, `hospedajes`, `hospedaje_habitaciones`, `hospedajes_propietarios`, `anfitriona_hospedajes`, `anfitriona_saldos`, `excursiones`, `reservas`, `clientes` (trío cerrado el 2026-10-10, el más delicado — ver mecanismo del cupo abajo).

**El trío `excursiones` + `reservas` + `clientes`**: era el más importante porque `excursiones.cupos_disponibles` se actualiza automáticamente cuando alguien reserva, incluido un cliente reservando sin login desde la web pública (`Reservar.jsx`, `ExcursionDetalle.jsx`) — no alcanzaba con el patrón de `catalogo-interno` tal cual. Se resolvió así: `excursiones` tiene lectura pública (`lectura_publica`) igual que el resto del catálogo; `reservas` tiene una policy aparte `insercion_publica` (`for insert with check (true)`) — es la única tabla con un INSERT público además de la lectura pública de otras; `clientes` quedó sin ningún acceso público, todo por `catalogo-interno`. El ajuste de `cupos_disponibles` de una reserva pública no pasa por `catalogo-interno` (no tiene sesión) ni por un UPDATE directo de `excursiones` (le abriría el campo a cualquiera) — pasa por la función de la base `ajustar_cupos_excursion(p_excursion_id, p_delta)` (security definer, acotada a sumar/restar dentro de `[0, cupos]`, grant a `anon`). `reservasApi.crearPublica` en `src/lib/supabase.js` es el único método que hace el INSERT directo (sin pasar por `catalogo-interno`); todo lo demás de reservas/clientes/excursiones (leer, editar, borrar, crear desde el admin) sí pasa por `catalogo-interno`. Migración: `supabase/migrations/20261010140000_rls_excursiones_reservas_clientes.sql`.

**Pendiente** (quedan abiertas): el resto de las ~35 tablas, ninguna con la urgencia del trío de arriba.

## En curso: migración de Kommo al CRM propio (estado al 2026-10-12)
Corte del número real previsto para el **15 o 16/10**; el 17/10 vence el acceso a la API de historial de Kommo.
- **Plan completo y decisiones**: memoria `project_transferencia_kommo.md`, en la carpeta de memorias del otro proyecto de Claude (`C:\Users\kasem\.claude\projects\c--Users-kasem-prueba-1-VS-CODE-ARCH\memory\`).
- **Bloqueo real**: la API de chats de Kommo responde 400 "Channel must be linked to your client". Se le pidió a soporte de Kommo que vincule el canal de WhatsApp a la integración "Exportação histórico DreamTours" (id `194ad67c-81ed-48c8-88d5-768ec854ff2c`). El acceso a esa API vence el **17/10**. No depende de Florencia.
- **Scripts** (fuera del repo): `C:\Users\kasem\kommo-exportacion\exportar-mensajes-kommo.mjs` y `cargar-mensajes-kommo.mjs`. Pendiente en el de carga: normalizar el teléfono (dígito 9) antes de buscar la conversación, y bajar adjuntos.
- **Migración reescrita** sobre la versión vigente de `crm_metricas` (4 parámetros) y con el filtro también en `crm_sin_responder`. La versión anterior del archivo rompía el Dashboard. Cristian la corrió el 2026-10-12 y el Dashboard quedó funcionando.
- **Memoria "Migracion 17"** (`project_migracion_17.md` en la carpeta de memorias de este proyecto): ahí se guarda todo lo importante del tema y la lista de pasos día a día. Leerla primero al retomar.
- **Webhook**: `webhook-whatsapp` ignora los mensajes que no son para `META_CRM_PHONE_NUMBER_ID` (desplegado). `avisosMensajes.js` no avisa por mensajes con `origen = 'kommo'`.
- **Cuenta real en Meta** (consulta de solo lectura con token temporal de la app "DreamsTour CRM"): la app ya puede leer la WABA `273455669191563`; la única app suscrita es Kommo; el número real está `CONNECTED`, calidad `GREEN`, `CLOUD_API`, phone number id `286111201255899`. No registrar el número, no suscribir la app ni quitar a Kommo hasta el día de la migración.

### 360dialog y coexistencia (decidido el 2026-10-13)
El número real va a pasar de Kommo a **360dialog** (proveedor oficial, plan Regular) para mantener la **coexistencia**: el mismo número funciona en la app WhatsApp Business del celular y en nuestro CRM. Es un solo corte, de madrugada (1 a 2 hs), fecha a definir. Se crea una cuenta de WhatsApp (WABA) nueva: se pierden las 7 plantillas y el nombre visible, y el Flow "Datos del viaje" hay que crearlo de nuevo ahí.
- **Código ya desplegado y probado con el entorno de prueba de 360dialog** (recepción, asistente y respuesta a mano; sin probar archivos, mensajes enviados desde el celular ni historial): `supabase/functions/_shared/proveedorWhatsapp.ts`, `webhook-whatsapp` y `send-whatsapp`.
- **Interruptor**: el secret `D360_API_KEY`. Si está cargado, el número del CRM envía y recibe por 360dialog; si no está (como hoy), todo sigue por Meta directo. Otros secrets: `D360_BASE_URL` (opcional, para el entorno de prueba), `D360_WEBHOOK_AUTH` ("usuario:clave": 360dialog no firma con nuestro App Secret, manda Basic Auth) y `FLOW_ID_PAQUETES` (id del Flow en la cuenta nueva).
- El webhook acepta avisos con firma de Meta **o** con la credencial de 360dialog. Lo que el equipo mande desde el celular entra como mensaje saliente con `origen = 'celular'`. El historial que sincroniza Meta al conectar se guarda crudo en el bucket `whatsapp-media/historial-360dialog/` (falta el importador).
- Si el Flow no se puede enviar, el asistente manda las preguntas por texto en vez de quedarse callado.
- **Migración pendiente de correr** (recién hace falta el día del corte): `20261013100000_mensajes_desde_celular.sql`, para que los mensajes del celular no cuenten como gasto.
- **El día del corte, cambiar el número del sitio**: `site_config.whatsapp` (Admin > Configuración del sitio) hoy es el número de prueba del CRM (5581997199422). Hay que poner el número oficial: lo usan todos los botones de WhatsApp de la web, los pedidos de "Mi selección" y "Armar mi paquete", y el contacto de la política de privacidad (`/privacidad`, que lo muestra escrito). Pedido de Abril, 2026-10-14.
- **Al desplegar `webhook-whatsapp` o `send-whatsapp`**: hacer `git pull` antes, siempre. Se despliega lo que hay en la computadora, y una versión vieja borra todo esto.

## Pendientes actuales
- [ ] Regenerar el token permanente del número operativo (`META_WHATSAPP_TOKEN`); necesita la aprobación de Florencia. Mientras tanto no sale `aviso_cliente` (el chat interno de guía/chofer no depende de este token)
- [ ] CRM: plantilla de reapertura para responder pasadas las 24 hs (consultar con Florencia)
- [ ] CRM: tiempos de respuesta por persona y gasto real en el Dashboard (Meta informa el costo de cada mensaje en los avisos de estado)
- [ ] Plan para migrar el número real de Kommo al CRM propio
- [ ] Investigar cómo exportar los 5.832 leads de Kommo e importarlos al embudo (consultar con Florencia). Antes hay que paginar el listado de leads: la base entrega como máximo 1.000 filas por consulta
- [ ] Embudos de Leads: hay tres, Paquetes, Paseos y Anfitriona (posventa). Cuando el contacto elige Paquetes o Paseos en el menú del asistente, su lead entra al embudo de ese grupo; un interés detectado como "traslado" entra directo a Paseos y uno de "hospedaje" entra directo a Paquetes, sin pasar por el menú (pedido de Cristian, 2026-10-09) — todo en `supabase/functions/_shared/embudoEntrada.ts` y el bloque `GRUPO_POR_INTERES` de `webhook-whatsapp/index.ts`. Un lead de Paquetes que llega a "Anfitriona entró en contacto" pasa solo a la primera etapa del embudo de Anfitriona (trigger `leads_redirigir_anfitriona`, migración `20260922120000_embudo_anfitriona.sql`, corrida 2026-10-08). Falta decidir qué otras automatizaciones necesitan (hoy hay dos acciones por etapa: crear un recordatorio y asignar responsable; el envío de mensajes de WhatsApp espera lo de las plantillas)
- [ ] Email de contacto real en `/privacidad`
- [ ] Configurar Evolution API en VPS (alternativa a WuzAPI)
- [ ] Correr la migración `20260922100000_realtime_dashboard.sql` (prende el tiempo real en Supabase para `excursiones`, `leads`, `clientes`, `reservas`, `movimientos_caja`, `propuestas`). El Dashboard ya se actualiza solo sin recargar la página (`src/lib/useSincronizado.js`), pero sin este SQL tarda hasta 1 minuto en notarlo en vez de ser casi al instante
