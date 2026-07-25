import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const META_TOKEN = Deno.env.get('META_WHATSAPP_TOKEN')
const META_PHONE_NUMBER_ID = Deno.env.get('META_PHONE_NUMBER_ID')
const META_API_VERSION = 'v21.0'

// Cada plantilla quedó registrada en Meta con el idioma que tenía seleccionado
// el dropdown al momento de crearla (no todas quedaron en Español (ARG) por
// error humano) — el nombre + idioma tienen que matchear exacto con Meta o el
// envío falla, así que va por plantilla en vez de un default único.
const TEMPLATE_LANGUAGES: Record<string, string> = {
  aviso_guia: 'es_AR',
  aviso_chofer: 'en',
  aviso_cliente: 'en',
}

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
  aviso_chofer: 'Hola {{1}} 👋\n\nTe confirmamos los datos de tu próxima excursión:\n\n🗺 *{{2}}*\n📅 {{3}}\n🕐 Salida: {{4}}\n\n*Tus pasajeros a cargo:*\n{{5}}\n\nCualquier consulta sobre la operación, podés contactar a tu guía *{{6}}* al 📱 {{7}}\n\n¡Muchas gracias por tu trabajo!',
  aviso_cliente: '👋 {{1}}! Te escribimos de Dream Tours con la información de tu excursión de mañana a *{{2}}*\n\n🧭 Guía: *{{3}}*\n🚗 Chofer: *{{4}}*\n🚘 Auto: {{5}}\n🔖 Patente: {{6}}\n🕐 *Horario de salida*: {{7}}\n🕐 *Horario de regreso*: {{8}}\n🏨 El chofer pasará a buscarlos por *{{9}}*\n\nAnte cualquier duda o consulta, podés escribirle directamente a tu guía al 📱 *{{10}}* — ese día los va a estar esperando en el parador para ingresar todos juntos.\n\n¡Que disfruten el paseo! Acá te dejamos el menú y las actividades opcionales: {{11}} 🎉',
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
          language: { code: TEMPLATE_LANGUAGES[template] || 'es_AR' },
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
