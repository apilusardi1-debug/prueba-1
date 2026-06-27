import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WUZAPI_URL = Deno.env.get('WUZAPI_URL')
const WUZAPI_TOKEN = Deno.env.get('WUZAPI_TOKEN')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { phone, message, nombre, conversacion_id } = await req.json()
    const phoneClean = phone.replace(/\D/g, '')

    console.log(`Enviando a ${phoneClean} via WuzAPI`)

    const wuzController = new AbortController()
    const wuzTimer = setTimeout(() => wuzController.abort(), 15000)

    const res = await fetch(`${WUZAPI_URL}/chat/send/text?token=${WUZAPI_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Phone: phoneClean,
        Body: message,
      }),
      signal: wuzController.signal,
    })
    clearTimeout(wuzTimer)

    const responseText = await res.text()
    console.log(`WuzAPI response ${res.status}:`, responseText)

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `WuzAPI error ${res.status}`, detail: responseText }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    let data: unknown
    try { data = JSON.parse(responseText) } catch { data = { raw: responseText } }

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
    console.error('send-whatsapp error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
