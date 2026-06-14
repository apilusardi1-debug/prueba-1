const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export async function sendWhatsApp(phone, message) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ phone, message }),
  })

  const data = await res.json()
  return { ok: data.sent === 'true', error: data.error || null }
}
