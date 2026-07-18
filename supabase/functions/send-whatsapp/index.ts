import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const META_TOKEN = Deno.env.get('META_WHATSAPP_TOKEN')
const META_PHONE_NUMBER_ID = Deno.env.get('META_PHONE_NUMBER_ID')
const META_API_VERSION = 'v21.0'
const TEMPLATE_LANGUAGE = Deno.env.get('META_TEMPLATE_LANGUAGE') || 'es'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Texto de las plantillas aprobadas en Meta, usado solo para reconstruir un
// mensaje legible al guardarlo en conversaciones/mensajes — el envío real
// va estructurado (nombre + parámetros) como exige la Cloud API.
const TEMPLATE_BODIES: Record<string, string> = {
  aviso_guia: 'Hola {{1}} 👋\n\n🗺 *{{2}}*\n📅 {{3}}\n🕐 Salida: {{4}} — Regreso: {{5}}\n\n*Pasajeros de la operación:*\n{{6}}\n\n¡Muchas gracias!',
  aviso_chofer: 'Hola {{1}} 👋\n\n🗺 *{{2}}*\n📅 {{3}}\n🕐 Salida: {{4}}\n\n*Tus pasajeros:*\n{{5}}\n\n🧭 Guía: *{{6}}*\n\n¡Gracias!',
  aviso_cliente: '{{1}}, soy *{{2}}* 👋\n\nEl chofer asignado para realizar su traslado es *{{3}}*, él lo estará buscando por la puerta de su hospedaje a las *{{4}}* del día de mañana para dirigirnos hacia *{{5}}*.\n\nYo los estaré esperando ahí para ingresar todos juntos.\n\nAnte cualquier duda o consulta podés escribirme directamente al 📱 *{{6}}*',
  aviso_asignacion: 'Hola {{1}} 👋 Quedaste asignado/a como {{2}} para la excursión *{{3}}* el {{4}}. Clientes: {{5}}. Pickup: {{6}}. Cualquier duda escribinos.',
}

function renderTemplate(name: string, params: string[]): string {
  const body = TEMPLATE_BODIES[name]
  if (!body) return `[Plantilla: ${name}] ${params.join(' · ')}`
  return params.reduce((text: string, val, i) => text.replaceAll(`{{${i + 1}}}`, String(val ?? '')), body)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { phone, template, params, nombre, conversacion_id } = await req.json()
    let phoneClean = phone.replace(/\D/g, '')
    // Argentina: 54 + número sin 9 (12 dígitos) → agregar 9 → 5492352560810
    if (phoneClean.startsWith('54') && !phoneClean.startsWith('549') && phoneClean.length === 12) {
      phoneClean = '549' + phoneClean.slice(2)
    }

    console.log(`Enviando plantilla "${template}" a ${phoneClean} via Meta Cloud API`)

    const metaController = new AbortController()
    const metaTimer = setTimeout(() => metaController.abort(), 15000)

    const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${META_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${META_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneClean,
        type: 'template',
        template: {
          name: template,
          language: { code: TEMPLATE_LANGUAGE },
          components: [
            {
              type: 'body',
              parameters: (params || []).map((text: unknown) => ({ type: 'text', text: String(text) })),
            },
          ],
        },
      }),
      signal: metaController.signal,
    })
    clearTimeout(metaTimer)

    const responseText = await res.text()
    console.log(`Meta response ${res.status}:`, responseText)

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Meta error ${res.status}`, detail: responseText }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    let data: unknown
    try { data = JSON.parse(responseText) } catch { data = { raw: responseText } }

    const mensajeLegible = renderTemplate(template, params || [])

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let convId = conversacion_id
    if (convId) {
      await supabase.from('conversaciones').update({
        ultimo_mensaje: mensajeLegible,
        ultimo_mensaje_at: new Date().toISOString(),
      }).eq('id', convId)
    } else {
      const { data: existing } = await supabase
        .from('conversaciones').select('id').eq('whatsapp', phoneClean).maybeSingle()

      if (existing) {
        convId = existing.id
        await supabase.from('conversaciones').update({
          ultimo_mensaje: mensajeLegible,
          ultimo_mensaje_at: new Date().toISOString(),
        }).eq('id', convId)
      } else {
        const { data: nueva } = await supabase
          .from('conversaciones')
          .insert({
            whatsapp: phoneClean,
            contacto_nombre: nombre || phoneClean,
            ultimo_mensaje: mensajeLegible,
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
        texto: mensajeLegible,
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
