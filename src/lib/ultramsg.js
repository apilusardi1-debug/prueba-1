const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export async function sendWhatsApp(phone, message) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000) // 20 segundos máximo

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ phone, message }),
      signal: controller.signal,
    })

    clearTimeout(timer)
    const text = await res.text()
    console.log(`[sendWhatsApp] status: ${res.status}`, text)

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${text}` }
    }

    let data = {}
    try { data = JSON.parse(text) } catch { data = { raw: text } }

    // WuzAPI devuelve { success: true, data: { Details: "Sent" } } cuando el mensaje se envió
    const ok = data.success === true
    return { ok, error: ok ? null : (data.error || data.raw || 'No confirmado por WuzAPI') }
  } catch (err) {
    clearTimeout(timer)
    console.error('[sendWhatsApp] error de red:', err)
    const error = err.name === 'AbortError' ? 'Sin respuesta del servidor (timeout)' : err.message
    return { ok: false, error }
  }
}
