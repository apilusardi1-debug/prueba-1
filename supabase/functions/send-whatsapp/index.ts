import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EVOLUTION_URL = Deno.env.get('EVOLUTION_API_URL')
const EVOLUTION_KEY = Deno.env.get('EVOLUTION_API_KEY')
const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { phone, message, nombre, conversacion_id } = await req.json()
    const phoneClean = phone.replace(/\D/g, '')

    const res = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_KEY!,
      },
      body: JSON.stringify({
        number: phoneClean,
        options: { delay: 1200 },
        textMessage: { text: message },
      }),
    })
    const data = await res.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let convId = conversacion_id
    if (convId) {
      await supabase.from('conversaciones').update({
        ultimo_mensaje: message,
        ultimo_mensaje_at: new Date().toISOString(),
      }).eq('id', convId)
    } else {
      const { data: existing } = await supabase
        .from('conversaciones').select('id').eq('whatsapp', phoneClean).maybeSingle()

      if (existing) {
        convId = existing.id
        await supabase.from('conversaciones').update({
          ultimo_mensaje: message,
          ultimo_mensaje_at: new Date().toISOString(),
        }).eq('id', convId)
      } else {
        const { data: nueva } = await supabase
          .from('conversaciones')
          .insert({
            whatsapp: phoneClean,
            contacto_nombre: nombre || phoneClean,
            ultimo_mensaje: message,
            ultimo_mensaje_at: new Date().toISOString(),
          })
          .select('id').single()
        convId = nueva?.id
      }
    }

    if (convId) {
      await supabase.from('mensajes').insert({
        conversacion_id: convId,
        whatsapp: phoneClean,
        texto: message,
        direccion: 'saliente',
      })
    }

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
