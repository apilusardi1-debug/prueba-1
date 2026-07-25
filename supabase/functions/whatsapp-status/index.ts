import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const WUZAPI_URL = Deno.env.get('WUZAPI_URL')!
const WUZAPI_TOKEN = Deno.env.get('WUZAPI_TOKEN')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const url = new URL(req.url)
  const action = url.searchParams.get('action') || 'status'

  try {
    if (action === 'status') {
      // Verificar si la sesión está activa
      const res = await fetch(`${WUZAPI_URL}/session/status?token=${WUZAPI_TOKEN}`, {
        signal: AbortSignal.timeout(8000),
      })
      const data = await res.json()
      return new Response(JSON.stringify(data), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'qr') {
      // Obtener QR para reconectar
      const res = await fetch(`${WUZAPI_URL}/qr?token=${WUZAPI_TOKEN}`, {
        signal: AbortSignal.timeout(10000),
      })
      const data = await res.json()
      return new Response(JSON.stringify(data), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'connect') {
      // Iniciar conexión
      const res = await fetch(`${WUZAPI_URL}/session/connect?token=${WUZAPI_TOKEN}`, {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
      })
      const data = await res.json()
      return new Response(JSON.stringify(data), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Acción no reconocida' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
