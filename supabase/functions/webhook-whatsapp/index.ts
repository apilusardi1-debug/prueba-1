import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const body = await req.json()
    const msg = body.data

    // Solo procesar mensajes entrantes (del cliente, no nuestros)
    if (!msg || msg.fromMe) {
      return new Response('ok', { status: 200 })
    }

    const phone = (msg.from || '').replace('@c.us', '')
    const nombre = msg.pushName || 'Sin nombre'
    const mensaje = msg.body || ''

    if (!phone) return new Response('ok', { status: 200 })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Si ya existe un lead con ese número, no crear otro
    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .eq('whatsapp', phone)
      .maybeSingle()

    if (existing) {
      return new Response('exists', { status: 200 })
    }

    await supabase.from('leads').insert({
      nombre,
      whatsapp: phone,
      notas: mensaje,
      origen: 'WhatsApp',
      estado: 'nuevo',
    })

    return new Response('ok', { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
