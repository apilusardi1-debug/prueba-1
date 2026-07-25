import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const WUZAPI_URL = Deno.env.get('WUZAPI_URL')!
const WUZAPI_TOKEN = Deno.env.get('WUZAPI_TOKEN')!
const ADMIN_PHONE = '5581989375412'

async function sendAlert(message: string) {
  try {
    await fetch(`${WUZAPI_URL}/chat/send/text?token=${WUZAPI_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Phone: ADMIN_PHONE, Body: message }),
      signal: AbortSignal.timeout(10000),
    })
  } catch (_) {}
}

serve(async () => {
  try {
    // 1. Verificar estado actual
    const statusRes = await fetch(`${WUZAPI_URL}/session/status?token=${WUZAPI_TOKEN}`, {
      signal: AbortSignal.timeout(10000),
    })
    const status = await statusRes.json()
    const { connected, loggedIn } = status.data

    if (connected && loggedIn) {
      console.log('[health-check] OK - sesión activa')
      return new Response(JSON.stringify({ ok: true, status: 'connected' }), { status: 200 })
    }

    console.log(`[health-check] Desconectado (connected=${connected}, loggedIn=${loggedIn}). Intentando reconectar...`)

    // 2. Intentar reconectar
    const connectRes = await fetch(`${WUZAPI_URL}/session/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': WUZAPI_TOKEN },
      body: JSON.stringify({ Subscribe: ['Message'], Immediate: false }),
      signal: AbortSignal.timeout(15000),
    })
    const connectData = await connectRes.json()

    if (connectData.success && connectData.data?.jid && !connectData.data?.qrcode) {
      console.log('[health-check] Reconectado automáticamente')
      await sendAlert('✅ *TurismoApp* — WhatsApp reconectado automáticamente. Todo funcionando.')
      return new Response(JSON.stringify({ ok: true, status: 'reconnected' }), { status: 200 })
    }

    // 3. No pudo reconectar — necesita QR
    console.log('[health-check] Necesita QR scan manual')
    await sendAlert('⚠️ *TurismoApp ALERTA* — WhatsApp desconectado y necesita escanear un nuevo código QR. Contactá al soporte urgente.')
    return new Response(JSON.stringify({ ok: false, status: 'needs_qr' }), { status: 200 })

  } catch (err) {
    console.error('[health-check] Error:', err.message)
    await sendAlert(`🔴 *TurismoApp ALERTA* — El servidor de WhatsApp no responde. Error: ${err.message}`)
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 })
  }
})
