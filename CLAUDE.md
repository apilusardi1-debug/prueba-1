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
| Finanzas + Mercado Pago | `/admin/finanzas` | ✅ Activo |
| Hospedajes | `/admin/hospedajes` | ✅ Activo |
| CRM WhatsApp | `/admin/crm/whatsapp` | 🔄 En desarrollo |

## Supabase
- **Proyecto**: `przvftnhwwistmcbkeon`
- **URL**: `https://przvftnhwwistmcbkeon.supabase.co`
- **ANON KEY**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByenZmdG5od3dpc3RtY2JrZW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3ODQ5NjYsImV4cCI6MjA5NjM2MDk2Nn0.HAxYnVc4Anxcq8gfA9h_aS3CAuF_qhTx0EedI4_10r4`

### Edge Functions existentes
- `send-whatsapp` — envío de mensajes WhatsApp (actualmente WuzAPI, migrando)
- `sync-whatsapp` — sincronización de conversaciones
- `webhook-whatsapp` — recibe mensajes entrantes de WhatsApp
- `whatsapp-status` — verifica y reconecta sesión WuzAPI
- `mp-qr` — genera QR de Mercado Pago
- `mp-webhook` — recibe notificaciones de pago de Mercado Pago

### Secrets en Supabase
- `WUZAPI_URL`, `WUZAPI_TOKEN` — WuzAPI (VPS, actualmente desconectado)
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` — Evolution API (instalado en VPS, pendiente de configurar)
- `MP_ACCESS_TOKEN` — Mercado Pago Brasil
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — uso interno en Edge Functions

## WhatsApp — Arquitectura planificada
El proyecto tiene DOS flujos de WhatsApp con proveedores diferentes:

### 1. Mensajes internos (operaciones)
Mensajes automáticos a chofer, guía y cliente al **cerrar operación**.
- **Proveedor objetivo**: Z-API (`z-api.io`) o WAHA Plus
- **Función**: `send-whatsapp` Edge Function
- **Archivo frontend**: `src/lib/ultramsg.js` (llama a la Edge Function)
- **Estado**: WuzAPI desconectado, migración a Z-API pendiente

### 2. CRM comercial (atención al cliente)
Inbox omnicanal, routing de conversaciones entre miembros del equipo.
- **Proveedor objetivo**: Meta Cloud API oficial (desde jul-2025 se cobra por mensaje entregado — marketing ~R$0,31-0,38, utility/auth ~R$0,15-0,19; servicio dentro de ventana de 24hs sigue gratis. Ya no existe la franquicia de 1000 conversaciones gratis/mes)
- **Estado**: En proceso de setup — pendiente verificación Meta Business

## VPS Hostinger
- **IP**: `76.13.224.231`
- **SSH**: `ssh root@76.13.224.231`
- **Puerto 8080**: WuzAPI (token: `app2024`, número: `558189375412`)
- **Puerto 8081**: Evolution API (instalado con Docker, pendiente configuración DB)
- **Docker network**: `evo-net`

## Mercado Pago
- **País**: Brasil (BRL)
- **User ID**: `3504798505`
- **Tipo**: QR estático sin monto fijo (el cliente ingresa el monto al escanear)
- **POS ID**: `134264103`
- **External Store ID**: `dreamstourstore01`
- **External POS ID**: `dreamstourcaja01`
- **Webhook**: registrado en `mp-webhook` Edge Function
- **Tabla BD**: `movimientos_caja` con columna `referencia_mp` (unique)

## Archivos clave
| Archivo | Descripción |
|---------|-------------|
| `src/pages/admin/Agenda.jsx` | Calendario con chips de excursiones |
| `src/pages/admin/Finanzas.jsx` | Tab Mercado Pago con QR y pagos recientes |
| `src/pages/admin/crm/WhatsApp.jsx` | CRM WhatsApp |
| `src/lib/ultramsg.js` | Helper para llamar a `send-whatsapp` Edge Function |
| `supabase/functions/send-whatsapp/index.ts` | Envío de mensajes WhatsApp |
| `supabase/functions/mp-qr/index.ts` | Generación QR Mercado Pago |
| `public/propuesta-dreamtours.html` | Presentación comercial |

## Decisiones técnicas importantes
- **URL única**: `prueba-1-rose.vercel.app` es la URL definitiva (no usar `turismoapp.vercel.app`)
- **Moneda**: BRL (Real brasileño) en toda la app
- **Idioma**: Español en la UI, pero el negocio opera en Brasil
- **Números Brasil**: formato con dígito 9 → `5581989375412` (no `558189375412`)
- **No usar UltraMsg**: instancia detenida por falta de pago
- **QR Mercado Pago**: el campo correcto es `data.qr_image` (URL), no `data.qr_base64`

## Pendientes actuales
- [ ] Migrar `send-whatsapp` a Z-API (mensajes internos)
- [ ] Setup Meta Cloud API (CRM comercial)
- [ ] Corregir `TabMercadoPago` en Finanzas.jsx: usar `data.qr_image` en vez de `data.qr_base64`
- [ ] Configurar Evolution API en VPS (alternativa a WuzAPI)
