import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!
const MP_USER_ID = Deno.env.get('MP_USER_ID')!
const EXTERNAL_STORE_ID = 'dreamstour_store_01'
const EXTERNAL_POS_ID = 'dreamstour_caja_01'
const WEBHOOK_URL = 'https://przvftnhwwistmcbkeon.supabase.co/functions/v1/mp-webhook'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

async function mpFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  return res.json()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // 1. Intentar obtener el POS existente
    let pos = await mpFetch(`/pos/${EXTERNAL_POS_ID}`)

    // 2. Si no existe, crear store + POS
    if (pos.error || !pos.qr_code_base64) {
      // Crear store
      const store = await mpFetch(`/users/${MP_USER_ID}/stores`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'DreamsTour',
          external_id: EXTERNAL_STORE_ID,
          location: {
            street_number: '1',
            street_name: 'Online',
            city_name: 'Maceio',
            state_name: 'AL',
            latitude: -9.665,
            longitude: -35.735,
            reference: 'DreamsTour',
          },
        }),
      })

      if (store.error) {
        console.error('Error creando store:', store)
      }

      // Crear POS con webhook y sin monto fijo
      pos = await mpFetch('/pos', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Caja DreamsTour',
          fixed_amount: false,
          store_id: store.id,
          external_store_id: EXTERNAL_STORE_ID,
          external_id: EXTERNAL_POS_ID,
          notification_url: WEBHOOK_URL,
        }),
      })
    }

    if (!pos.qr_code_base64) {
      return new Response(JSON.stringify({ error: 'No se pudo generar el QR', details: pos }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      qr_base64: pos.qr_code_base64,
      qr_string: pos.qr_code,
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('mp-qr error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
