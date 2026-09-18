import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Webhook oficial de Meta Cloud API para el número de CRM (leads/clientes).
// Reemplaza la versión anterior, que hablaba el formato de WuzAPI (form-encoded
// jsonData estilo Baileys) — ese número se migró a Meta directo, sin BSP, porque
// nadie del equipo dependía de seguir usando la app de WhatsApp Business en el
// celular. El número operativo (avisos a chofer/guía/cliente) es un número y una
// app de Meta distintos, no tocados por este archivo.
const META_VERIFY_TOKEN = Deno.env.get('META_VERIFY_TOKEN')

serve(async (req) => {
  const url = new URL(req.url)

  // Meta llama una vez con GET para verificar la URL al configurar el webhook.
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
      return new Response(challenge ?? '', { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  try {
    const body = await req.json()
    const value = body?.entry?.[0]?.changes?.[0]?.value
    const message = value?.messages?.[0]

    // Los webhooks de "statuses" (entregado/leído) llegan al mismo endpoint
    // sin "messages" — no son mensajes nuevos, los ignoramos.
    if (!message) return new Response('ok', { status: 200 })

    const phone: string | undefined = message.from
    if (!phone) return new Response('ok', { status: 200 })

    const texto: string =
      message.text?.body ??
      message.button?.text ??
      message.interactive?.button_reply?.title ??
      `[Mensaje de tipo ${message.type}]`

    const nombre: string = value?.contacts?.[0]?.profile?.name || 'Sin nombre'

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
        notas: texto,
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
        ultimo_mensaje: texto,
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
          ultimo_mensaje: texto,
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
      texto,
      direccion: 'entrante',
    })

    return new Response('ok', { status: 200 })
  } catch (err) {
    // Devolvemos 200 igual aunque falle: si respondemos error, Meta reintenta
    // la entrega con reintentos/backoff y puede terminar duplicando el mensaje.
    console.error('webhook-whatsapp error:', err)
    return new Response('ok', { status: 200 })
  }
})
