import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Webhook oficial de Meta Cloud API para el número de CRM (leads/clientes).
// Reemplaza la versión anterior, que hablaba el formato de WuzAPI (form-encoded
// jsonData estilo Baileys) — ese número se migró a Meta directo, sin BSP, porque
// nadie del equipo dependía de seguir usando la app de WhatsApp Business en el
// celular. El número operativo (avisos a chofer/guía/cliente) es un número y una
// app de Meta distintos, no tocados por este archivo.
const META_VERIFY_TOKEN = Deno.env.get('META_VERIFY_TOKEN')
const META_CRM_TOKEN = Deno.env.get('META_CRM_WHATSAPP_TOKEN')
const META_API_VERSION = 'v21.0'
const MEDIA_BUCKET = 'whatsapp-media'

const TIPOS_MEDIA = ['image', 'audio', 'video', 'document', 'sticker']
const ETIQUETA_MEDIA: Record<string, string> = {
  image: 'Imagen', audio: 'Audio', video: 'Video', document: 'Documento', sticker: 'Sticker',
}
const EXT_POR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/amr': 'amr',
  'video/mp4': 'mp4', 'video/3gpp': '3gp',
  'application/pdf': 'pdf', 'text/plain': 'txt',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
}

// Meta no manda el archivo en el webhook, solo un id: hay que pedir la URL
// temporal y bajarlo con el mismo token. Se guarda en un bucket privado y en el
// mensaje queda solo la ruta.
async function guardarMedia(supabase: ReturnType<typeof createClient>, mediaId: string, convId: string, msgId: string) {
  const headers = { Authorization: `Bearer ${META_CRM_TOKEN}` }
  const infoRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${mediaId}`, { headers })
  if (!infoRes.ok) throw new Error(`Meta media info ${infoRes.status}`)
  const info = await infoRes.json()
  const fileRes = await fetch(info.url, { headers })
  if (!fileRes.ok) throw new Error(`Meta media download ${fileRes.status}`)
  const bytes = new Uint8Array(await fileRes.arrayBuffer())
  const mime = String(info.mime_type || fileRes.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim()
  const ext = EXT_POR_MIME[mime] || 'bin'
  const path = `${convId}/${msgId.replace(/[^A-Za-z0-9]/g, '').slice(-40)}.${ext}`
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType: mime, upsert: true })
  if (error) throw error
  return { path, mime }
}

// ── Asistente automático ─────────────────────────────────────────────────────
// Saluda al primer mensaje de una conversación, pregunta Paquetes o Paseos y
// asigna la conversación en turnos entre las personas de ese grupo (tabla
// bot_reparto). Se apaga solo cuando alguien queda asignado o responde a mano.
const META_CRM_PHONE_NUMBER_ID = Deno.env.get('META_CRM_PHONE_NUMBER_ID')
const NOMBRE_GRUPO: Record<string, string> = { paquetes: 'Paquetes', paseos: 'Paseos' }
const TEXTO_REINTENTO = 'Para derivarte con la persona indicada, tocá una de estas opciones:'

function sinAcentos(t: string): string {
  return t.replace(/[áàâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
    .replace(/[óòôö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ñ/g, 'n')
}

// Devuelve el grupo elegido o null si no se entiende o es ambiguo. Los números
// "1" y "2" solo valen si el menú ya se mostró.
// deno-lint-ignore no-explicit-any
function interpretarGrupo(message: any, permitirNumeros: boolean): string | null {
  const idBoton = message?.interactive?.button_reply?.id
  if (idBoton === 'paquetes' || idBoton === 'paseos') return idBoton
  const t = sinAcentos(String(message?.text?.body ?? message?.button?.text ?? '').toLowerCase()).trim()
  if (!t) return null
  if (permitirNumeros) {
    if (/^1\W*$/.test(t)) return 'paquetes'
    if (/^2\W*$/.test(t)) return 'paseos'
  }
  const quierePaquete = /paquete/.test(t)
  const quierePaseo = /paseo|excursion|tour/.test(t)
  if (quierePaquete && !quierePaseo) return 'paquetes'
  if (quierePaseo && !quierePaquete) return 'paseos'
  return null
}

async function enviarMeta(cuerpo: Record<string, unknown>) {
  const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${META_CRM_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${META_CRM_TOKEN}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...cuerpo }),
  })
  if (!res.ok) throw new Error(`Meta ${res.status}: ${await res.text()}`)
}

async function guardarMensajeBot(supabase: ReturnType<typeof createClient>, convId: string, phone: string, texto: string) {
  await supabase.from('mensajes').insert({ conversacion_id: convId, whatsapp: phone, texto, direccion: 'saliente', origen: 'bot' })
}

async function enviarMenu(supabase: ReturnType<typeof createClient>, convId: string, phone: string, intro: string) {
  await enviarMeta({
    to: phone,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: intro },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'paquetes', title: 'Paquetes' } },
          { type: 'reply', reply: { id: 'paseos', title: 'Paseos' } },
        ],
      },
    },
  })
  await guardarMensajeBot(supabase, convId, phone, `${intro}\n[Opciones: Paquetes / Paseos]`)
}

async function cerrarSinAsignar(supabase: ReturnType<typeof createClient>, texto: string, convId: string, phone: string, grupo: string | null) {
  await enviarMeta({ to: phone, type: 'text', text: { body: texto, preview_url: false } })
  await guardarMensajeBot(supabase, convId, phone, texto)
  await supabase.from('conversaciones').update({ bot_estado: 'sin_asignar', ...(grupo ? { grupo } : {}) }).eq('id', convId)
}

// Elige a quien lleva más tiempo sin recibir una conversación del grupo.
async function derivar(supabase: ReturnType<typeof createClient>, mensaje: string, convId: string, phone: string, grupo: string): Promise<boolean> {
  const { data: reparto } = await supabase.from('bot_reparto').select('id, usuario_id, ultima_asignacion').eq('grupo', grupo)
  const ids = (reparto || []).map((m) => m.usuario_id)
  if (!ids.length) return false
  const { data: usuarios } = await supabase.from('usuarios_admin').select('id, nombre, activo').in('id', ids)
  const candidatos = (reparto || [])
    .filter((m) => (usuarios || []).some((u) => u.id === m.usuario_id && u.activo !== false))
    .sort((a, b) => (a.ultima_asignacion ? Date.parse(a.ultima_asignacion) : 0) - (b.ultima_asignacion ? Date.parse(b.ultima_asignacion) : 0))
  const elegido = candidatos[0]
  if (!elegido) return false
  const usuario = (usuarios || []).find((u) => u.id === elegido.usuario_id)!

  await supabase.from('bot_reparto').update({ ultima_asignacion: new Date().toISOString() }).eq('id', elegido.id)
  await supabase.from('conversaciones').update({ asignado_a: elegido.usuario_id, grupo, bot_estado: 'derivado' }).eq('id', convId)

  const texto = mensaje
    .replaceAll('{nombre}', String(usuario.nombre || '').split(' ')[0])
    .replaceAll('{grupo}', NOMBRE_GRUPO[grupo])
  await enviarMeta({ to: phone, type: 'text', text: { body: texto, preview_url: false } })
  await guardarMensajeBot(supabase, convId, phone, texto)
  return true
}

// deno-lint-ignore no-explicit-any
async function ejecutarBot(supabase: ReturnType<typeof createClient>, convId: string, phone: string, message: any) {
  const { data: cfg } = await supabase.from('bot_config').select('*').eq('id', 1).maybeSingle()
  if (!cfg?.activo) return

  const { data: conv } = await supabase
    .from('conversaciones').select('id, asignado_a, bot_estado, bot_intentos').eq('id', convId).maybeSingle()
  if (!conv || conv.asignado_a) return
  if (['derivado', 'sin_asignar', 'humano'].includes(conv.bot_estado)) return

  const esperando = conv.bot_estado === 'esperando'
  const grupo = interpretarGrupo(message, esperando)

  if (grupo) {
    const derivada = await derivar(supabase, cfg.mensaje_derivacion, convId, phone, grupo)
    if (!derivada) await cerrarSinAsignar(supabase, cfg.mensaje_sin_asignar, convId, phone, grupo)
    return
  }

  if (!esperando) {
    await enviarMenu(supabase, convId, phone, cfg.saludo)
    await supabase.from('conversaciones').update({ bot_estado: 'esperando', bot_intentos: 1 }).eq('id', convId)
    return
  }

  if ((conv.bot_intentos || 0) < 2) {
    await enviarMenu(supabase, convId, phone, TEXTO_REINTENTO)
    await supabase.from('conversaciones').update({ bot_intentos: 2 }).eq('id', convId)
    return
  }

  await cerrarSinAsignar(supabase, cfg.mensaje_sin_asignar, convId, phone, null)
}

// Un fallo del asistente nunca debe hacer perder el mensaje del cliente.
// deno-lint-ignore no-explicit-any
async function correrBot(supabase: ReturnType<typeof createClient>, convId: string, phone: string, message: any) {
  try {
    await ejecutarBot(supabase, convId, phone, message)
  } catch (err) {
    console.error('webhook-whatsapp bot error:', err)
  }
}

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

    const tipoMedia: string | null = TIPOS_MEDIA.includes(message.type) ? message.type : null
    const media = tipoMedia ? message[tipoMedia] : null
    const nombreArchivo: string | null = media?.filename ?? null

    const ubicacion = message.location
    const textoUbicacion = ubicacion
      ? `Ubicación${ubicacion.name ? `: ${ubicacion.name}` : ''} - https://maps.google.com/?q=${ubicacion.latitude},${ubicacion.longitude}`
      : null

    const texto: string =
      message.text?.body ??
      message.button?.text ??
      message.interactive?.button_reply?.title ??
      message.interactive?.list_reply?.title ??
      media?.caption ??
      textoUbicacion ??
      (tipoMedia ? `${ETIQUETA_MEDIA[tipoMedia]}${nombreArchivo ? `: ${nombreArchivo}` : ''}` : `[Mensaje de tipo ${message.type}]`)

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

    const filaBase = {
      conversacion_id: convId,
      whatsapp: phone,
      texto,
      direccion: 'entrante',
    }

    if (!tipoMedia) {
      await supabase.from('mensajes').insert(filaBase)
      await correrBot(supabase, convId, phone, message)
      return new Response('ok', { status: 200 })
    }

    // Si la descarga falla igual se guarda el mensaje (con la etiqueta "Imagen",
    // "Audio", etc.) para no perder que el cliente escribió.
    let archivo: { path: string; mime: string } | null = null
    try {
      if (media?.id) archivo = await guardarMedia(supabase, media.id, convId, message.id || crypto.randomUUID())
    } catch (mediaErr) {
      console.error('webhook-whatsapp media error:', mediaErr)
    }

    const { error: insertMediaErr } = await supabase.from('mensajes').insert({
      ...filaBase,
      tipo: tipoMedia,
      media_path: archivo?.path ?? null,
      media_mime: archivo?.mime ?? media?.mime_type ?? null,
      media_nombre: nombreArchivo,
    })
    if (insertMediaErr) {
      console.error('webhook-whatsapp insert con media falló, guardando solo el texto:', insertMediaErr)
      await supabase.from('mensajes').insert(filaBase)
    }

    await correrBot(supabase, convId, phone, message)
    return new Response('ok', { status: 200 })
  } catch (err) {
    // Devolvemos 200 igual aunque falle: si respondemos error, Meta reintenta
    // la entrega con reintentos/backoff y puede terminar duplicando el mensaje.
    console.error('webhook-whatsapp error:', err)
    return new Response('ok', { status: 200 })
  }
})
