import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const rawBody = await req.text()

    // WuzAPI envía form-encoded: instanceName=xxx&jsonData=xxx&userID=xxx
    const params = new URLSearchParams(rawBody)
    const jsonDataStr = params.get('jsonData')
    if (!jsonDataStr) return new Response('ok', { status: 200 })

    const payload = JSON.parse(jsonDataStr)

    if (payload.type !== 'Message') return new Response('ok', { status: 200 })

    const event = payload.event
    if (!event) return new Response('ok', { status: 200 })

    const info = event.Info
    if (!info) return new Response('ok', { status: 200 })

    if (info.IsFromMe) return new Response('ok', { status: 200 })
    if (info.IsGroup) return new Response('ok', { status: 200 })

    const chatJid = info.Chat || ''
    if (chatJid.includes('@g.us') || chatJid.includes('@broadcast')) {
      return new Response('ok', { status: 200 })
    }

    // SenderAlt tiene el número real incluso para contactos @lid
    let phone = ''
    if (info.SenderAlt) {
      phone = info.SenderAlt.split(':')[0].split('@')[0]
    } else {
      phone = chatJid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@lid', '').split(':')[0]
    }

    if (!phone) return new Response('ok', { status: 200 })

    const nombre = info.PushName || 'Sin nombre'
    const msg = event.Message
    const mensaje =
      msg?.conversation ||
      msg?.extendedTextMessage?.text ||
      msg?.imageMessage?.caption ||
      '[Mensaje multimedia]'

    if (!mensaje) return new Response('ok', { status: 200 })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: leadExistente } = await supabase
      .from('leads').select('id').eq('whatsapp', phone).maybeSingle()

    if (!leadExistente) {
      await supabase.from('leads').insert({
        nombre,
        whatsapp: phone,
        notas: mensaje,
        origen: 'WhatsApp',
        estado: 'nuevo',
      })
    }

    const { data: convExistente } = await supabase
      .from('conversaciones').select('id, no_leidos').eq('whatsapp', phone).maybeSingle()

    let convId: string | undefined

    if (convExistente) {
      await supabase.from('conversaciones').update({
        contacto_nombre: nombre,
        ultimo_mensaje: mensaje,
        ultimo_mensaje_at: new Date().toISOString(),
        no_leidos: (convExistente.no_leidos || 0) + 1,
      }).eq('id', convExistente.id)
      convId = convExistente.id
    } else {
      const { data: nueva, error: insertErr } = await supabase
        .from('conversaciones')
        .insert({
          whatsapp: phone,
          contacto_nombre: nombre,
          ultimo_mensaje: mensaje,
          ultimo_mensaje_at: new Date().toISOString(),
          no_leidos: 1,
        })
        .select('id')
        .single()

      if (insertErr) {
        const { data: fallback } = await supabase
          .from('conversaciones').select('id').eq('whatsapp', phone).single()
        convId = fallback?.id
      } else {
        convId = nueva?.id
      }
    }

    if (!convId) return new Response('ok', { status: 200 })

    await supabase.from('mensajes').insert({
      conversacion_id: convId,
      whatsapp: phone,
      texto: mensaje,
      direccion: 'entrante',
    })

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('webhook-whatsapp error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
