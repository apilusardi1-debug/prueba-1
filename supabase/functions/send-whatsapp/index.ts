import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Número operativo (avisos automáticos a chofer/guía/cliente, solo plantillas)
const META_TOKEN = Deno.env.get('META_WHATSAPP_TOKEN')
const META_PHONE_NUMBER_ID = Deno.env.get('META_PHONE_NUMBER_ID')
// Número de CRM (leads/clientes, texto libre — respuestas del inbox)
const META_CRM_TOKEN = Deno.env.get('META_CRM_WHATSAPP_TOKEN')
const META_CRM_PHONE_NUMBER_ID = Deno.env.get('META_CRM_PHONE_NUMBER_ID')
const META_API_VERSION = 'v21.0'
const MEDIA_BUCKET = 'whatsapp-media'
const TIPOS_MEDIA_SALIENTE = ['image', 'video', 'audio', 'document']
const ETIQUETA_MEDIA: Record<string, string> = { image: 'Imagen', video: 'Video', audio: 'Audio', document: 'Documento' }
// Categoría de cobro de Meta de cada plantilla, para estimar el gasto en el
// Dashboard. Si Meta clasificara alguna distinto (p. ej. marketing), se corrige acá.
const COBRO_PLANTILLA: Record<string, string> = {
  aviso_guia: 'utilidad',
  aviso_chofer: 'utilidad',
  aviso_cliente: 'utilidad',
}

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
    const { phone, template, params, message, nombre, conversacion_id, media, accion, filename } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Paso previo a enviar un archivo desde el CRM: se devuelve una URL de
    // subida firmada de un solo uso, así el navegador sube directo al bucket
    // privado sin que la clave pública tenga permiso de escritura.
    if (accion === 'subida') {
      if (!conversacion_id || !filename) {
        return new Response(JSON.stringify({ error: 'Faltan conversacion_id o filename' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }
      const seguro = String(filename).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]/g, '_').slice(-80)
      const path = `${conversacion_id}/out-${Date.now()}-${seguro}`
      const { data: subida, error: errSubida } = await supabase.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path)
      if (errSubida || !subida) {
        return new Response(JSON.stringify({ error: 'No se pudo preparar la subida', detail: errSubida?.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }
      return new Response(JSON.stringify({ path: subida.path, token: subida.token }), {
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    let phoneClean = phone.replace(/\D/g, '')
    // Argentina: 54 + número sin 9 (12 dígitos) → agregar 9 → 5492352560810
    if (phoneClean.startsWith('54') && !phoneClean.startsWith('549') && phoneClean.length === 12) {
      phoneClean = '549' + phoneClean.slice(2)
    }

    // Dos casos: "template" = aviso automático del número operativo (chofer/
    // guía/cliente); "message" = respuesta de texto libre desde el inbox del
    // CRM (número de leads/clientes). Cada uno usa su propio número/token de
    // Meta — son apps y WABAs distintas.
    const esMedia = !template && !!media
    const esTexto = !template && !esMedia && !!message
    const esCrm = esTexto || esMedia
    const metaToken = esCrm ? META_CRM_TOKEN : META_TOKEN
    const metaPhoneNumberId = esCrm ? META_CRM_PHONE_NUMBER_ID : META_PHONE_NUMBER_ID

    if (!metaToken || !metaPhoneNumberId) {
      return new Response(JSON.stringify({
        error: esCrm
          ? 'Falta configurar META_CRM_WHATSAPP_TOKEN / META_CRM_PHONE_NUMBER_ID en los secrets de Supabase.'
          : 'Falta configurar META_WHATSAPP_TOKEN / META_PHONE_NUMBER_ID en los secrets de Supabase.',
      }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } })
    }

    // Archivo del CRM: solo se aceptan rutas subidas con la acción "subida" de
    // esta misma conversación, y se le da a Meta un link firmado que vence en
    // 10 minutos para que lo descargue.
    let urlArchivo = ''
    const captionMedia: string = esMedia && media.tipo !== 'audio' ? (message || '') : ''
    if (esMedia) {
      const ruta = String(media.path || '')
      if (!TIPOS_MEDIA_SALIENTE.includes(media.tipo) || !conversacion_id || !ruta.startsWith(`${conversacion_id}/out-`) || ruta.includes('..')) {
        return new Response(JSON.stringify({ error: 'Archivo inválido' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }
      const { data: firmada, error: errFirma } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(ruta, 600)
      if (errFirma || !firmada?.signedUrl) {
        return new Response(JSON.stringify({ error: 'No se pudo leer el archivo subido', detail: errFirma?.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }
      urlArchivo = firmada.signedUrl
    }

    const metaBody = esMedia
      ? {
          messaging_product: 'whatsapp',
          to: phoneClean,
          type: media.tipo,
          [media.tipo]: {
            link: urlArchivo,
            ...(captionMedia ? { caption: captionMedia } : {}),
            ...(media.tipo === 'document' && media.nombre ? { filename: media.nombre } : {}),
          },
        }
      : esTexto
      ? { messaging_product: 'whatsapp', to: phoneClean, type: 'text', text: { body: message, preview_url: false } }
      : {
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
        }

    console.log(esMedia ? `Enviando ${media.tipo} a ${phoneClean} (CRM)` : esTexto ? `Enviando texto libre a ${phoneClean} (CRM)` : `Enviando plantilla "${template}" a ${phoneClean} (operativo)`)

    const metaController = new AbortController()
    const metaTimer = setTimeout(() => metaController.abort(), 15000)

    const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${metaPhoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${metaToken}`,
      },
      body: JSON.stringify(metaBody),
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

    const mensajeLegible = esMedia
      ? (captionMedia || `${ETIQUETA_MEDIA[media.tipo]}${media.tipo === 'document' && media.nombre ? `: ${media.nombre}` : ''}`)
      : esTexto ? message : renderTemplate(template, params || [])

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
        // Respuesta libre dentro de la ventana de 24 hs = servicio (sin costo);
        // una plantilla se cobra según su categoría.
        cobro: template ? (COBRO_PLANTILLA[template] || 'utilidad') : 'servicio',
        ...(esMedia ? {
          tipo: media.tipo,
          media_path: media.path,
          media_mime: media.mime ?? null,
          media_nombre: media.nombre ?? null,
        } : {}),
      })
    }

    // Si una persona ya escribió a mano, el asistente automático no interviene
    // más en esa conversación (ni saluda ni pregunta el menú).
    if (esCrm && convId) {
      await supabase.from('conversaciones')
        .update({ bot_estado: 'humano' })
        .eq('id', convId)
        .or('bot_estado.is.null,bot_estado.eq.esperando')
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
