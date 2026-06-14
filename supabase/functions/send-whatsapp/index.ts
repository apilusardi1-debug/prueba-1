import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const INSTANCE = Deno.env.get('ULTRAMSG_INSTANCE')
const TOKEN = Deno.env.get('ULTRAMSG_TOKEN')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  try {
    const { phone, message } = await req.json()
    const to = phone.replace(/\D/g, '') + '@c.us'

    const res = await fetch(`https://api.ultramsg.com/${INSTANCE}/messages/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TOKEN, to, body: message }),
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
