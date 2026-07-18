const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export async function sendWhatsAppTemplate(phone, template, params) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000) // 20 segundos máximo

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ phone, template, params }),
      signal: controller.signal,
    })

    clearTimeout(timer)
    const text = await res.text()
    console.log(`[sendWhatsAppTemplate] status: ${res.status}`, text)

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${text}` }
    }

    let data = {}
    try { data = JSON.parse(text) } catch { data = { raw: text } }

    // Meta Cloud API devuelve { messages: [{ id: "wamid...." }] } cuando el mensaje se aceptó para envío
    const ok = !!data.messages?.[0]?.id
    return { ok, error: ok ? null : (data.error?.message || data.detail || data.raw || 'No confirmado por Meta') }
  } catch (err) {
    clearTimeout(timer)
    console.error('[sendWhatsAppTemplate] error de red:', err)
    const error = err.name === 'AbortError' ? 'Sin respuesta del servidor (timeout)' : err.message
    return { ok: false, error }
  }
}
