import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const body = await req.json()

    // Solo procesar mensajes entrantes
    if (body.event !== 'messages.upsert') {
      return new Response('ok', { status: 200 })
    }

    const msg = body.data
    if (!msg || msg.key?.fromMe) {
      return new Response('ok', { status: 200 })
    }

    const phone = (msg.key?.remoteJid || '')
      .replace('@s.whatsapp.net', '')
      .replace('@c.us', '')
    const nombre = msg.pushName || 'Sin nombre'
    const mensaje = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''

    if (!phone || !mensaje) return new Response('ok', { status: 200 })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Crear lead si no existe
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

    // Buscar o crear conversacion
    const { data: convExistente } = await supabase
      .from('conversaciones').select('id, no_leidos').eq('whatsapp', phone).maybeSingle()

    let convId: string
    if (convExistente) {
      await supabase.from('conversaciones').update({
        contacto_nombre: nombre,
        ultimo_mensaje: mensaje,
        ultimo_mensaje_at: new Date().toISOString(),
        no_leidos: (convExistente.no_leidos || 0) + 1,
      }).eq('id', convExistente.id)
      convId = convExistente.id
    } else {
      const { data: nueva } = await supabase
        .from('conversaciones')
        .insert({
          whatsapp: phone,
          contacto_nombre: nombre,
          ultimo_mensaje: mensaje,
          ultimo_mensaje_at: new Date().toISOString(),
          no_leidos: 1,
        })
        .select('id').single()
      convId = nueva!.id
    }

    await supabase.from('mensajes').insert({
      conversacion_id: convId,
      whatsapp: phone,
      texto: mensaje,
      direccion: 'entrante',
    })

    return new Response('ok', { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
