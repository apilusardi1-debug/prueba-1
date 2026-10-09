# DreamsTour — Contexto del Proyecto

## Quiénes somos
Cristian y Abril desarrollan una plataforma web completa para **DreamsTour**, agencia de turismo con base en Salvador, Bahia (Brasil). El proyecto está en producción activa.

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

## WhatsApp — Arquitectura
Hay DOS flujos, con dos números y dos apps de Meta distintos. Ambos usan Meta Cloud API directo (sin proveedor intermedio).

### 1. Mensajes internos (operaciones)
Al **cerrar una operación** (Agenda), al CLIENTE se le manda `aviso_cliente` por el número operativo (app `Dreamstourwhatsappoperativo`, 1 por reserva, categoría utilidad). Al GUÍA y a cada CHOFER ya no se les manda nada por Meta: desde el 2026-09-25 su aviso queda en el **chat interno de operaciones**, un link personal sin contraseña (`/guia/:token`, `/chofer/:token` — `PanelOperativo.jsx`), en portugués, con botón "Recebido" y un botón por pasajero que abre WhatsApp (wa.me) con el mensaje ya armado para que se lo manden ellos mismos desde su propio celular. El link se copia desde Equipo > Guías/Choferes ("Copiar link"). El admin ve en vivo si cada uno lo abrió (Leído) o confirmó (Recebido) desde Agenda > Gestionar.
- **Función**: `send-whatsapp` (solo para `aviso_cliente`). **Frontend**: `src/lib/ultramsg.js` (`sendWhatsAppTemplate`, el nombre es histórico), `operacionesApi`/`panelOperativoApi` en `src/lib/supabase.js`
- **Estado**: `aviso_cliente` no envía nada hasta regenerar el token operativo (ver Secrets); el chat interno de guía/chofer no depende de ese token y ya está en producción
- **Migración**: `supabase/migrations/20260925100000_chat_interno_operaciones.sql` (agrega `token` a `guias`/`choferes`, crea `operaciones` y `operaciones_avisos`)

### 2. CRM comercial (atención al cliente)
Inbox propio con reparto de conversaciones entre el equipo. Número de prueba **+55 81 99719-9422** (app "DreamsTour CRM" `3006251579723473`, WABA `847194981749193`, phone number id `1254559544416464`).
- **Regla**: el número que hoy usa la agencia en Kommo (+55 81 9768-2691, WABA `273455669191563`) **no se toca** hasta la migración planificada
- **Funciona**: enviar y recibir (con fotos, audios y documentos), ventana de 24 hs, asistente automático de menú (Paquetes o Paseos, reparto entre 5 personas) prendido en todos los chats y con un interruptor por chat para pausarlo (columna `conversaciones.bot_pausado`), que pasa el lead al embudo del grupo que elige el contacto, filtrado de los clientes de Paquetes (pide en un solo mensaje destino, adultos, menores con su edad, presupuesto y fechas, solo lo que todavía no dijeron, y hace a lo sumo una pregunta de seguimiento antes de derivar; textos y rangos editables en Configuración > Asistente; estado `filtrando`), filtros por persona, interés del lead detectado por palabras clave, estado de entrega de cada mensaje, "Marcar como atendida", marcos amarillo (12 hs) y rojo (18 hs) para lo que espera respuesta, avisos de mensaje nuevo (sonido y notificación) y métricas en el Dashboard
- **Costos de Meta** (desde jul-2025 se cobra por mensaje entregado; tabla `tarifas_mensaje`, editable desde el Dashboard): utilidad R$0,035, marketing R$0,34, autenticación R$0,17. Responder con texto libre dentro de las 24 hs es gratis
- **Pendiente**: responder pasadas las 24 hs necesita una plantilla aprobada (a consultar con Florencia); migrar el número real desde Kommo

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
- **Números Brasil**: formato con dígito 9 → `5581989375412` (no `558189375412`)
- **No usar UltraMsg**: instancia detenida por falta de pago
- **Sin métodos de pago**: se sacó Mercado Pago (2026-10-08, pedido de Cristian — "nadie va a pagar por la app"). Finanzas sigue existiendo, pero es control manual de caja; no hay ningún cobro conectado ni se va a conectar
- **Sin emojis** en la interfaz nueva: usar los iconos de línea de `src/components/admin/dashboard/Ic.jsx`
- **Estilo del panel**: paleta gris/negro con la clase `brand-*` (variables CSS en `src/index.css`) y tarjetas `dash-card`; la web pública conserva su azul
- **Migraciones**: Cristian las corre en el SQL Editor de Supabase. Primero el SQL y después desplegar las funciones que lo usan (`npx supabase functions deploy <nombre> --project-ref przvftnhwwistmcbkeon`)
- **Commits**: `git status -uall` completo y `git add` archivo por archivo; en la raíz hay archivos sueltos que no se suben

## RLS — endurecida tabla por tabla
Hasta 2026-10-08 casi todas las tablas tenían una policy `acceso_total_temporal` (`using (true)`) — la clave pública (anon), sola, alcanzaba para leer o escribir cualquier cosa directo contra la base, sin pasar por el login del panel. Se está cerrando de a una tabla, por orden de riesgo, sin tocar las que ya andan.

**Mecanismo**: las escrituras pasan por la Edge Function `catalogo-interno` (exige sesión del panel vigente, igual chequeo que `send-whatsapp`/`usuarios-admin`), service_role del lado del servidor. Para sumar una tabla nueva alcanza con agregarla a `TABLAS` en `supabase/functions/catalogo-interno/index.ts` y cambiar el `xxxApi` correspondiente en `src/lib/supabase.js` para que llame a `invocarCatalogoInterno(tabla, accion, {...})` en vez de `supabase.from(tabla)`. Las tablas que además lee la web pública (`hospedajes`, `hospedaje_habitaciones`, `agencia_videos`, `site_config`) mantienen la LECTURA directa con una policy `lectura_publica` (`for select using (true)`) — solo la escritura pasa por la función.

**Ya cerradas** (RLS sin `acceso_total_temporal`): `conceptos_movimiento`, `embudo_etapas`, `embudo_automatizaciones`, `respuestas_rapidas`, `costos_excursion`, `agencia_videos`, `site_config`, `traslados`, `propuestas`, `hospedajes`, `hospedaje_habitaciones`, `hospedajes_propietarios`, `anfitriona_hospedajes`, `anfitriona_saldos`.

**Pendiente** (quedan abiertas): el resto de las ~38 tablas. Lo más importante que falta es el trío `excursiones` + `reservas` + `clientes`, dejado para el final a propósito: `excursiones.cupos_disponibles` se actualiza automáticamente cuando alguien reserva, incluido un cliente reservando sin login desde la web pública (`Reservar.jsx`) — hay que resolver ese camino sin cortar las reservas del sitio, no alcanza con el mismo patrón de `catalogo-interno` tal cual.

## Pendientes actuales
- [ ] Regenerar el token permanente del número operativo (`META_WHATSAPP_TOKEN`); necesita la aprobación de Florencia. Mientras tanto no sale `aviso_cliente` (el chat interno de guía/chofer no depende de este token)
- [ ] Correr la migración `20260925100000_chat_interno_operaciones.sql` (chat interno de guía/chofer: agrega `token` a `guias`/`choferes`, crea `operaciones` y `operaciones_avisos`)
- [ ] CRM: plantilla de reapertura para responder pasadas las 24 hs (consultar con Florencia)
- [ ] CRM: tiempos de respuesta por persona y gasto real en el Dashboard (Meta informa el costo de cada mensaje en los avisos de estado)
- [ ] Plan para migrar el número real de Kommo al CRM propio
- [ ] Investigar cómo exportar los 5.832 leads de Kommo e importarlos al embudo (consultar con Florencia). Antes hay que paginar el listado de leads: la base entrega como máximo 1.000 filas por consulta
- [ ] Embudos de Leads: hay tres, Paquetes, Paseos y Anfitriona (posventa). Cuando el contacto elige Paquetes o Paseos en el menú del asistente, su lead entra al embudo de ese grupo; un interés detectado como "traslado" entra directo a Paseos y uno de "hospedaje" entra directo a Paquetes, sin pasar por el menú (pedido de Cristian, 2026-10-09) — todo en `supabase/functions/_shared/embudoEntrada.ts` y el bloque `GRUPO_POR_INTERES` de `webhook-whatsapp/index.ts`. Un lead de Paquetes que llega a "Anfitriona entró en contacto" pasa solo a la primera etapa del embudo de Anfitriona (trigger `leads_redirigir_anfitriona`, migración `20260922120000_embudo_anfitriona.sql`, corrida 2026-10-08). Falta decidir qué otras automatizaciones necesitan (hoy hay dos acciones por etapa: crear un recordatorio y asignar responsable; el envío de mensajes de WhatsApp espera lo de las plantillas)
- [ ] Email de contacto real en `/privacidad`
- [ ] Configurar Evolution API en VPS (alternativa a WuzAPI)
- [ ] Correr la migración `20260922100000_realtime_dashboard.sql` (prende el tiempo real en Supabase para `excursiones`, `leads`, `clientes`, `reservas`, `movimientos_caja`, `propuestas`). El Dashboard ya se actualiza solo sin recargar la página (`src/lib/useSincronizado.js`), pero sin este SQL tarda hasta 1 minuto en notarlo en vez de ser casi al instante
