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
| CRM WhatsApp | `/admin/crm/whatsapp` | ✅ Activo con el número real de la agencia (+55 81 99768-2691) desde el 2026-10-17, por 360dialog con coexistencia |

## Supabase
- **Proyecto**: `przvftnhwwistmcbkeon`
- **URL**: `https://przvftnhwwistmcbkeon.supabase.co`
- **ANON KEY**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByenZmdG5od3dpc3RtY2JrZW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3ODQ5NjYsImV4cCI6MjA5NjM2MDk2Nn0.HAxYnVc4Anxcq8gfA9h_aS3CAuF_qhTx0EedI4_10r4`

### Edge Functions existentes
- `send-whatsapp` — envía: plantillas del número operativo (avisos de cerrar operación, Meta directo) y, del número del CRM (por 360dialog), texto, archivos, el formulario "Datos del viaje" a mano (`accion: 'formulario'`) y plantillas aprobadas (`plantilla: {...}`; `accion: 'plantillas'` lista las aprobadas). Guarda el id del mensaje para seguir su estado de entrega
- `webhook-whatsapp` — webhook del número del CRM (hoy llega desde 360dialog): mensajes entrantes (con fotos, audios y documentos), asistente automático de menú y avisos de estado (enviado / entregado / leído / fallido)
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
Hay DOS flujos, con dos números distintos. El operativo usa Meta Cloud API directo; el del CRM (el número real de la agencia) va por **360dialog** desde el 2026-10-17 (ver "Migración de Kommo" más abajo).

### 1. Mensajes internos (operaciones)
Al **cerrar una operación** (Agenda), al CLIENTE se le manda `aviso_cliente` por el número operativo (app `Dreamstourwhatsappoperativo`, 1 por reserva, categoría utilidad). Al GUÍA y a cada CHOFER ya no se les manda nada por Meta: desde el 2026-09-25 su aviso queda en el **chat interno de operaciones**, un link personal sin contraseña (`/guia/:token`, `/chofer/:token` — `PanelOperativo.jsx`), en portugués, con botón "Recebido" y un botón por pasajero que abre WhatsApp (wa.me) con el mensaje ya armado para que se lo manden ellos mismos desde su propio celular. El link se copia desde Equipo > Guías/Choferes ("Copiar link"). El admin ve en vivo si cada uno lo abrió (Leído) o confirmó (Recebido) desde Agenda > Gestionar.
- **Función**: `send-whatsapp` (solo para `aviso_cliente`). **Frontend**: `src/lib/ultramsg.js` (`sendWhatsAppTemplate`, el nombre es histórico), `operacionesApi`/`panelOperativoApi` en `src/lib/supabase.js`
- **Estado**: `aviso_cliente` no envía nada hasta regenerar el token operativo (ver Secrets); el chat interno de guía/chofer no depende de ese token y ya está en producción
- **Migración**: `supabase/migrations/20260925100000_chat_interno_operaciones.sql` (agrega `token` a `guias`/`choferes`, crea `operaciones` y `operaciones_avisos`)
- **Choferes, además**: su link se puede instalar como ícono en el celular (manifest por chofer en `api/chofer-manifest.js`, íconos en `public/icon-chofer-*.png`, service worker `public/sw-chofer.js`) y recibir notificaciones push cuando se crea su aviso — botón "Ativar notificações" en `PanelOperativo.jsx`, probado en producción el 2026-10-10. Tabla `chofer_push_subscripciones` + trigger en `operaciones_avisos` que llama a `enviar-push-chofer` (migración `20261010120000_chofer_push.sql`). Por ahora solo choferes, no guías

### 2. CRM comercial (atención al cliente)
Inbox propio con reparto de conversaciones entre el equipo. **Número real de la agencia +55 81 99768-2691** (Meta lo informa como 558197682691), conectado a **360dialog con coexistencia**: el mismo número funciona a la vez en la app WhatsApp Business del iPhone de la agencia y en el CRM. Cuenta de WhatsApp (WABA) nueva "Dream Tours" en el portfolio DREAM TOURS (verificado), plan Regular 49 EUR/mes, límite 2.000 usuarios/24 hs, auto-recarga de 50 EUR del saldo de mensajes.
- El número de prueba anterior (+55 81 99719-9422, app "DreamsTour CRM" `3006251579723473`, WABA `847194981749193`) ya no se usa para el CRM; queda como respaldo: borrando los secrets `D360_*` el CRM vuelve a él (Meta directo).
- **Coexistencia**: lo que el equipo manda desde el celular o WhatsApp Web entra al CRM como saliente con `origen = 'celular'` (gratis y sin límite de 24 hs: sirve para retomar chats viejos). Hay que **abrir la app del iPhone al menos cada 13 días** o se desconecta. WhatsApp para Windows no sirve como dispositivo vinculado (sí WhatsApp Web, hasta 4).
- **Desde el chat del CRM** (`src/components/crm/EnviosEspeciales.jsx`, 2026-10-17): botón para mandar a mano el formulario "Datos del viaje" (ícono de lista) y, con la ventana de 24 hs cerrada, "Enviar una plantilla" con las aprobadas (hoy `recontact_martin` y `recontact_victoria`, marketing, y `datos_viaje_paquete`, utilidad: pregunta si quiere el formulario y se lo mandan cuando responde "Sí"; todas es_AR). Las plantillas nuevas se crean en WhatsApp Manager de la WABA "Dream Tours" y aparecen solas al aprobarlas. Cuando el cliente completa el formulario (lo mande el asistente o una persona), `webhook-whatsapp` pasa el lead al embudo de Paquetes y a Filtrado (mismas guardas: solo avanza).
- **Conversación "nueva" (numerito, `conversaciones.no_leidos`)** (2026-10-19): abrir el chat NO la saca. Se saca sola cuando le responde una persona, por el trigger `trg_mensajes_respuesta_saca_no_leidos` en `mensajes` (migración `20261019110000_respuesta_saca_no_leidos.sql`, corrida 2026-10-19): todo mensaje saliente que no sea del asistente (`origen = 'bot'`) ni del historial de Kommo pone `no_leidos = 0`, venga del CRM, del celular o de WhatsApp Web. La pantalla además la saca al responder o al tocar "Marcar como atendida".
- **"Ver ficha completa"** en el panel del chat abre la ficha única encima del chat (`?ficha=<id del lead>` en la dirección); cerrarla o la flecha "atrás" del navegador vuelven al mismo chat (2026-10-19; antes llevaba al Embudo de paquetes).
- **Filtro "Fecha ___ al ___"** en la lista del CRM (2026-10-19, pedido de Abril; antes "Nuevos del / al" por primer mensaje): contactos cuyo **último mensaje del cliente** cae entre esas fechas (hora de Brasil), por `conversaciones.ultimo_entrante_at`, que mantiene el trigger `trg_mensajes_ultimo_entrante` con cada mensaje entrante (migración `20261019140000_conversaciones_ultimo_entrante.sql`, corrida 2026-10-19; nuestras respuestas y las del asistente no la cambian). `primer_mensaje_at` (migración `20261017100000_conversaciones_primer_mensaje.sql`) se sigue guardando aunque el filtro ya no la usa.
- **Filtro "Filtrar por plantilla..."** en la lista del CRM (2026-10-19, pedido de Abril): chats reabiertos con una plantilla de Meta (ventana de 24 hs cerrada) — "Con plantilla", "Contestaron" (el cliente escribió después: `ultimo_entrante_at > ultima_plantilla_at`) y "No contestaron". `conversaciones.ultima_plantilla_at` la mantiene el trigger `trg_mensajes_ultima_plantilla`: mensaje saliente del número del CRM con `cobro` distinto de `servicio` y que no sea de Kommo (migración `20261019150000_conversaciones_ultima_plantilla.sql`, corrida 2026-10-19). Antes del 17/10 (Kommo) no hay dato.
- **Archivos compartidos** en el panel "Ficha del contacto" del chat (2026-10-19, pedido de Abril): como "Multimedia, enlaces y docs" de WhatsApp — pestañas "Fotos y videos" (image/video/sticker) y "Documentos" (document), agrupadas por mes, de los dos lados (Cliente/Nosotros). Componente `src/components/crm/ArchivosCompartidos.jsx`; sale de los `mensajes` ya cargados del chat (con `media_path`), links firmados del bucket `whatsapp-media` con `createSignedUrls`. Audios y links quedaron afuera a propósito.
- **Catálogo de Paseos** (2026-10-19, pedido de Abril): el mensaje al derivar de Paseos/Traslados es el texto del catálogo con un botón "Ver catálogo" (cta_url) que abre el PDF del bucket público `catalogos` (`catalogo-paseos-dreamtours.pdf`; para cambiar el catálogo, subir otro con el mismo nombre). Botón en `bot_config.boton_paseos_texto/url`, editable en Entrenar asistente (nodo Paseos); el webhook elige `boton_paseos_*` o `boton_derivacion_*` según el grupo (`botonDerivacion(cfg, grupo)`). Migración `20261019160000_catalogo_paseos.sql`.
- **Responder un mensaje puntual** (2026-10-19, pedido de Abril): flechita ↩ al pasar el mouse por un globo (solo mensajes con `wa_message_id`; los de Kommo no se pueden citar) → barra "Respondiendo a..." arriba del cuadro de texto. `mensajes.respuesta_a_wamid` guarda el wa_message_id del citado: lo llenan send-whatsapp (parámetro `responde_a`, va a Meta como `context.message_id`, solo texto y archivos) y webhook-whatsapp (`message.context.id` del cliente y de los ecos del celular). El globo busca el citado en los mensajes cargados por `wa_message_id` y al hacer clic lleva a él (migración `20261019170000_mensajes_respuesta_a.sql`).
- **Quién atiende chats** (2026-10-19): Abril y Cristian no son de ventas y no se les puede asignar ninguna conversación (`usuarios_admin.atiende_chats = false`). La base lo frena venga de donde venga (trigger `trg_conversaciones_frenar_sin_chats`: la asignación no se guarda; `trg_bot_reparto_frenar_sin_chats`: no entran al reparto del asistente) y el panel los oculta del menú Asignar y del reparto (`usuariosAdminApi.idsSinChats`, función `usuarios_sin_chats()`). Migración `20261019120000_usuarios_sin_chats.sql`, corrida 2026-10-19. Reparto al 2026-10-19: Paseos = Agostina y Francisco; Paquetes = 3 personas.
- **Parceros** (2026-10-19): quien recomendó al contacto (influencers como Sol, agencias como Vivo Porto). Lista en Configuración > Parceros (tabla `parceros`; solo se cargan ahí), botón "Parcero" en el chat que lo guarda en el lead (`leads.parcero_id`), cartelito violeta en la lista, filtro "Filtrar por parcero..." con la cantidad, y fila Parcero en la ficha. Migración `20261019130000_parceros.sql`, corrida 2026-10-19.
- **Funciona**: enviar y recibir (con fotos, audios y documentos), ventana de 24 hs, asistente automático de menú (Paquetes o Paseos, reparto entre 5 personas) prendido en todos los chats y con un interruptor por chat para pausarlo (columna `conversaciones.bot_pausado`), que pasa el lead al embudo del grupo que elige el contacto, filtrado de los clientes de Paquetes (pide en un solo mensaje destino, adultos, menores con su edad, presupuesto y fechas, solo lo que todavía no dijeron, y hace a lo sumo una pregunta de seguimiento antes de derivar; textos y rangos editables en Configuración > Asistente; estado `filtrando`), filtros por persona, interés del lead detectado por palabras clave, estado de entrega de cada mensaje, "Marcar como atendida", marcos amarillo (12 hs) y rojo (18 hs) para lo que espera respuesta, avisos de mensaje nuevo (sonido y notificación) y métricas en el Dashboard
- **Pedido web de paseos** (2026-10-13): en el sitio, "Mi selección" (`src/components/public/SeleccionPaseos.jsx`) arma un mensaje de WhatsApp con los paseos elegidos, fechas de estadía, pasajeros, edades de menores y código de vendedor opcional, y lo abre hacia `site_config.whatsapp` (todavía el número de prueba 5581997199422: Cristian decide cuándo pasarlo a `5581997682691`). El formato vive en `supabase/functions/_shared/pedidoWebPaseos.ts`, que usan la web y `webhook-whatsapp`: el webhook reconoce el mensaje, deriva directo a Paseos sin menú (aunque estuviera a mitad del cuestionario de Paquetes), pasa el lead al embudo de Paseos aunque el asistente no conteste (apagado, pausado o chat ya asignado; misma guarda: solo desde una etapa de entrada), pone interés "paseo" + destinos, etiqueta "Pedido web" y "Vendedor: Nombre (CÓDIGO)" si el código existe en `vendedores`. La reserva de paseos ya no se crea desde el sitio
- **Pedido web de paquete** (2026-10-13): en `/paquetes`, "Armar mi paquete" abre un formulario (`src/components/public/FormularioPaquete.jsx`) con los mismos datos que el formulario del asistente (nombre, destinos, país, ciudad de origen, adultos, menores con edad, hospedaje, presupuesto en USD, fechas) y abre WhatsApp con el mensaje armado. Formato en `supabase/functions/_shared/pedidoWebPaquete.ts` (mismas líneas "Campo: valor" que `textoDesdeFlow`, así `datosViaje.ts` lo lee igual). El webhook lo reconoce: etiqueta "Pedido web", interés "paquete" + destinos, nombre del formulario si WhatsApp no trae uno, pasa el lead al embudo de Paquetes y a Filtrado aunque el asistente no conteste (mismas guardas), y el asistente deriva directo a Paquetes sin menú ni preguntas
- **Costos de Meta** (desde jul-2025 se cobra por mensaje entregado; tabla `tarifas_mensaje`, editable desde el Dashboard): utilidad R$0,035, marketing R$0,34, autenticación R$0,17. Responder con texto libre dentro de las 24 hs es gratis
- **Pasadas las 24 hs**: plantilla aprobada desde el chat, o escribir desde el celular / WhatsApp Web

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
| `src/components/ficha/FichaPersona.jsx` | **Ficha única** (2026-10-14): la misma ficha se abre desde el embudo de Leads y desde Clientes. Junta lead (etapa, vuelos, hospedajes, recordatorios) y cliente (reservas, pagos, propuestas, notas) con un solo listado de saldos (tabla `saldos`, por `lead_id` y/o `cliente_id`, vía `catalogo-interno`). Las fichas viejas siguen en el código detrás de `FICHA_UNICA` en `Leads.jsx` y `Clientes.jsx`; las tablas `anfitriona_saldos` y `cliente_saldos` quedan solo como respaldo. Las notas (`notas_clientes`) cuelgan del lead y/o del cliente (`lead_id`, migración `20261019100000_notas_lead.sql`, corrida 2026-10-19) y son las mismas que las "Notas rápidas" del panel del chat del CRM (`src/components/crm/NotasRapidas.jsx`); el autor es el usuario conectado |
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

## Migración de Kommo al CRM propio — HECHA el 2026-10-17
El número real se desconectó de Kommo y se conectó a 360dialog con coexistencia la madrugada del 17/10. **Kommo ya no recibe ni manda mensajes**; su cuenta sigue visible hasta que se dé de baja. Se cargó en el CRM: conversaciones de WhatsApp desde el 2025-10-14 (`origen = 'kommo'`), leads con movimiento desde el 2026-09-15 (más unos 850 de agosto-septiembre, etiqueta "Kommo") y adjuntos desde el 2026-09-15. El resto (mensajes más viejos, Instagram, adjuntos anteriores, tareas) quedó solo en la exportación de Cristian (`C:\Users\kasem\kommo-exportacion`). Las 234 respuestas rápidas de Kommo se cargaron en el CRM (las 32 que tenían archivo, solo con el texto).
- **Pendientes después del corte**: memoria "Post migracion" (`project_post_migracion.md`, carpeta de memorias de este proyecto). Historial y decisiones de la migración: memoria "Migracion 17" (`project_migracion_17.md`).
- **Cómo se hizo la coexistencia** (por si hay que repetirla con otro número): sacar el número del proveedor anterior en el celular (Plataforma Business > Desconectar), pasarlo a WhatsApp común y volver a Business (se borran perfil comercial, etiquetas y catálogo; los chats no), alta en 360dialog > "Yes, Business app" > Embedded Signup. En la ventana de Meta **hay que escribir el número en "Ingresar un nuevo número"**: Meta lo reconoce, muestra el perfil sin pedir SMS y después un QR que se escanea desde la app.

### Antecedentes (estado al 2026-10-12, ya resuelto)
- **Plan completo y decisiones**: memoria `project_transferencia_kommo.md`, en la carpeta de memorias del otro proyecto de Claude (`C:\Users\kasem\.claude\projects\c--Users-kasem-prueba-1-VS-CODE-ARCH\memory\`).
- **Bloqueo real**: la API de chats de Kommo responde 400 "Channel must be linked to your client". Se le pidió a soporte de Kommo que vincule el canal de WhatsApp a la integración "Exportação histórico DreamTours" (id `194ad67c-81ed-48c8-88d5-768ec854ff2c`). El acceso a esa API vence el **17/10**. No depende de Florencia.
- **Scripts** (fuera del repo): `C:\Users\kasem\kommo-exportacion\exportar-mensajes-kommo.mjs` y `cargar-mensajes-kommo.mjs`. Pendiente en el de carga: normalizar el teléfono (dígito 9) antes de buscar la conversación, y bajar adjuntos.
- **Migración reescrita** sobre la versión vigente de `crm_metricas` (4 parámetros) y con el filtro también en `crm_sin_responder`. La versión anterior del archivo rompía el Dashboard. Cristian la corrió el 2026-10-12 y el Dashboard quedó funcionando.
- **Memoria "Migracion 17"** (`project_migracion_17.md` en la carpeta de memorias de este proyecto): ahí se guarda todo lo importante del tema y la lista de pasos día a día. Leerla primero al retomar.
- **Webhook**: `webhook-whatsapp` ignora los mensajes que no son para `META_CRM_PHONE_NUMBER_ID` (desplegado). `avisosMensajes.js` no avisa por mensajes con `origen = 'kommo'`.
- **Cuenta real en Meta** (consulta de solo lectura con token temporal de la app "DreamsTour CRM"): la app ya puede leer la WABA `273455669191563`; la única app suscrita es Kommo; el número real está `CONNECTED`, calidad `GREEN`, `CLOUD_API`, phone number id `286111201255899`. No registrar el número, no suscribir la app ni quitar a Kommo hasta el día de la migración.

### 360dialog y coexistencia (en producción desde el 2026-10-17)
El número real pasó de Kommo a **360dialog** (proveedor oficial, plan Regular) para mantener la **coexistencia**. Se creó una cuenta de WhatsApp (WABA) nueva: de las 7 plantillas viejas solo se recrearon las 2 de reapertura, y el Flow "Datos del viaje" se recreó ahí. Desde el 2026-10-19 el que se usa es `filtro_paquetes_datos_viaje_v2` (id `2168880017386651`, en `FLOW_ID_PAQUETES`): el mismo de antes más un campo **Observación** al final (`observacion`, texto libre opcional de hasta 50 caracteres, que `textoDesdeFlow` muestra como "Observación: ..." solo si el cliente escribió algo). El anterior (`1682127606962693`) queda publicado hasta que nadie lo tenga pendiente; después se retira en WhatsApp Manager. Los títulos de los campos de texto tienen que tener 20 caracteres o menos, y Meta ahora permite publicar versiones nuevas de un Flow ya publicado. El JSON vigente está en `C:\Users\kasem\kommo-exportacion\flow-datos-viaje-observacion.json` (copiarlo al portapapeles con `Get-Content -Raw -Encoding UTF8`: PowerShell 5 rompe los acentos si no).
- **Código ya desplegado y probado con el entorno de prueba de 360dialog** (recepción, asistente y respuesta a mano; sin probar archivos, mensajes enviados desde el celular ni historial): `supabase/functions/_shared/proveedorWhatsapp.ts`, `webhook-whatsapp` y `send-whatsapp`.
- **Interruptor**: el secret `D360_API_KEY` (cargado desde el 2026-10-17 con `C:\Users\kasem\kommo-exportacion\activar-360dialog.ps1`: primero se corre el script y recién cuando pide Enter se copia la clave en 360dialog). Si se borra (`activar-360dialog.ps1 -Desactivar`), el CRM vuelve a Meta directo con el número de prueba. Otros secrets: `D360_BASE_URL` (opcional, para el entorno de prueba), `D360_WEBHOOK_AUTH` ("usuario:clave": 360dialog no firma con nuestro App Secret, manda Basic Auth) y `FLOW_ID_PAQUETES` (id del Flow en la cuenta nueva).
- El webhook acepta avisos con firma de Meta **o** con la credencial de 360dialog. Lo que el equipo mande desde el celular entra como mensaje saliente con `origen = 'celular'`. El historial que sincroniza Meta al conectar se guarda crudo en el bucket `whatsapp-media/historial-360dialog/` (falta el importador).
- Si el Flow no se puede enviar, el asistente manda las preguntas por texto en vez de quedarse callado.
- Migración `20261013100000_mensajes_desde_celular.sql` corrida el 2026-10-15: los mensajes del celular no cuentan como gasto.
- **Número del sitio**: `site_config.whatsapp` (Admin > Configuración del sitio) sigue siendo el número de prueba (5581997199422) por decisión de Cristian; cuando lo decida, poner `5581997682691`: lo usan todos los botones de WhatsApp de la web, los pedidos de "Mi selección" y "Armar mi paquete", y el contacto de la política de privacidad (`/privacidad`, que lo muestra escrito). Pedido de Abril, 2026-10-14.
- **Al desplegar `webhook-whatsapp` o `send-whatsapp`**: hacer `git pull` antes, siempre. Se despliega lo que hay en la computadora, y una versión vieja borra todo esto.

## Pendientes actuales
- [ ] Regenerar el token permanente del número operativo (`META_WHATSAPP_TOKEN`); necesita la aprobación de Florencia. Mientras tanto no sale `aviso_cliente` (el chat interno de guía/chofer no depende de este token)
- [ ] CRM: tiempos de respuesta por persona y gasto real en el Dashboard (Meta informa el costo de cada mensaje en los avisos de estado)
- [ ] Pendientes de la migración (API key nueva de 360dialog, borrar la integración de Kommo, importador del historial de coexistencia, número del sitio, baja de Kommo): memoria "Post migracion"
- [ ] Embudos de Leads: hay tres, Paquetes, Paseos y Anfitriona (posventa). Cuando el contacto elige Paquetes o Paseos en el menú del asistente, su lead entra al embudo de ese grupo; un interés detectado como "traslado" entra directo a Paseos y uno de "hospedaje" entra directo a Paquetes, sin pasar por el menú (pedido de Cristian, 2026-10-09) — todo en `supabase/functions/_shared/embudoEntrada.ts` y el bloque `GRUPO_POR_INTERES` de `webhook-whatsapp/index.ts`. Un lead de Paquetes que llega a "Anfitriona entró en contacto" pasa solo a la primera etapa del embudo de Anfitriona (trigger `leads_redirigir_anfitriona`, migración `20260922120000_embudo_anfitriona.sql`, corrida 2026-10-08). Falta decidir qué otras automatizaciones necesitan (hoy hay dos acciones por etapa: crear un recordatorio y asignar responsable; el envío de mensajes de WhatsApp espera lo de las plantillas)
- [ ] Email de contacto real en `/privacidad`
- [ ] Configurar Evolution API en VPS (alternativa a WuzAPI)
- [ ] Correr la migración `20260922100000_realtime_dashboard.sql` (prende el tiempo real en Supabase para `excursiones`, `leads`, `clientes`, `reservas`, `movimientos_caja`, `propuestas`). El Dashboard ya se actualiza solo sin recargar la página (`src/lib/useSincronizado.js`), pero sin este SQL tarda hasta 1 minuto en notarlo en vez de ser casi al instante
