import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { detectarInteres } from '../_shared/interes.ts'
import { estadoDeMeta, filtroEstadosPrevios } from '../_shared/estadoEnvio.ts'
import { etiquetarLeadPorGrupo } from '../_shared/etiquetas.ts'
import { enviarLeadAlEmbudoPorGrupo } from '../_shared/embudoEntrada.ts'
import { extraerDatosViaje } from '../_shared/datosViaje.ts'
import { configFiltro, nombreValido, pasoInicial, pasoTrasRespuesta, mensajePreguntas, mensajeSeguimiento } from '../_shared/filtroPaquetes.ts'

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
// bot_reparto). Se apaga solo cuando alguien queda asignado o responde a mano, y
// se puede pausar en un chat puntual (conversaciones.bot_pausado). Cuando el
// contacto elige Paquetes o Paseos, su lead pasa al embudo de ese grupo. Con
// Paquetes, antes de derivar hace el filtrado (ver _shared/filtroPaquetes.ts).
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

// Devuelve el id del mensaje en Meta (wamid), con el que después llegan los
// avisos de entregado / leído / fallido.
async function enviarMeta(cuerpo: Record<string, unknown>): Promise<string | null> {
  const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${META_CRM_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${META_CRM_TOKEN}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...cuerpo }),
  })
  if (!res.ok) throw new Error(`Meta ${res.status}: ${await res.text()}`)
  const data = await res.json().catch(() => null)
  return data?.messages?.[0]?.id ?? null
}

async function guardarMensajeBot(supabase: ReturnType<typeof createClient>, convId: string, phone: string, texto: string, wamid: string | null) {
  await supabase.from('mensajes').insert({
    conversacion_id: convId,
    whatsapp: phone,
    texto,
    direccion: 'saliente',
    origen: 'bot',
    cobro: 'servicio',
    numero: 'crm', // este webhook solo atiende el número del CRM
    wa_message_id: wamid,
    estado_envio: wamid ? 'enviado' : null,
    estado_envio_at: wamid ? new Date().toISOString() : null,
  })
}

// Meta avisa por el webhook cada cambio de estado de un mensaje nuestro. Nunca
// se retrocede de estado (ver estadoEnvio.ts). Si el aviso llega antes de que
// el mensaje esté guardado (send-whatsapp lo inserta después de la respuesta de
// Meta), se reintenta una vez pasados unos segundos.
// deno-lint-ignore no-explicit-any
async function procesarEstados(supabase: ReturnType<typeof createClient>, estados: any[]) {
  for (const e of estados) {
    const nuevo = estadoDeMeta(String(e?.status))
    const wamid: string | undefined = e?.id
    if (!nuevo || !wamid) continue

    const error = e?.errors?.[0]
    const cambios = {
      estado_envio: nuevo,
      estado_envio_at: e?.timestamp ? new Date(Number(e.timestamp) * 1000).toISOString() : new Date().toISOString(),
      ...(nuevo === 'fallido'
        ? {
            error_codigo: typeof error?.code === 'number' ? error.code : null,
            error_envio: [error?.title, error?.error_data?.details].filter(Boolean).join(' - ') || error?.message || null,
          }
        : {}),
    }

    const actualizar = () =>
      supabase.from('mensajes').update(cambios).eq('wa_message_id', wamid).or(filtroEstadosPrevios(nuevo)).select('id')

    const { data: tocadas, error: errUpdate } = await actualizar()
    if (errUpdate) { console.error('webhook-whatsapp estado error:', errUpdate.message); continue }
    if (tocadas?.length) continue

    const { data: existe } = await supabase.from('mensajes').select('id').eq('wa_message_id', wamid).limit(1)
    if (existe?.length) continue // ya estaba en un estado igual o posterior
    await new Promise((r) => setTimeout(r, 2500))
    await actualizar()
  }
}

async function enviarMenu(supabase: ReturnType<typeof createClient>, convId: string, phone: string, intro: string) {
  const wamid = await enviarMeta({
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
  await guardarMensajeBot(supabase, convId, phone, `${intro}\n[Opciones: Paquetes / Paseos]`, wamid)
}

async function cerrarSinAsignar(supabase: ReturnType<typeof createClient>, texto: string, convId: string, phone: string, grupo: string | null) {
  const wamid = await enviarMeta({ to: phone, type: 'text', text: { body: texto, preview_url: false } })
  await guardarMensajeBot(supabase, convId, phone, texto, wamid)
  await supabase.from('conversaciones').update({ bot_estado: 'sin_asignar', ...(grupo ? { grupo } : {}) }).eq('id', convId)
  await etiquetarLeadPorGrupo(supabase, phone, grupo)
  await enviarLeadAlEmbudoPorGrupo(supabase, phone, grupo)
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
  const wamid = await enviarMeta({ to: phone, type: 'text', text: { body: texto, preview_url: false } })
  await guardarMensajeBot(supabase, convId, phone, texto, wamid)
  await etiquetarLeadPorGrupo(supabase, phone, grupo)
  await enviarLeadAlEmbudoPorGrupo(supabase, phone, grupo)
  return true
}

type Supabase = ReturnType<typeof createClient>

// Los contactos suelen escribir varios mensajes seguidos. Antes de contestar se espera
// unos segundos: si llegó otro mensaje, este no manda nada y contesta el último, que ya
// ve todo lo anterior. Se cambia con el secret BOT_ESPERA_RAFAGA_MS (0 = sin espera).
const ESPERA_RAFAGA_MS = Number(Deno.env.get('BOT_ESPERA_RAFAGA_MS') ?? 4000)

async function llegoOtroMensaje(supabase: Supabase, convId: string, desde: string | null): Promise<boolean> {
  if (!desde || ESPERA_RAFAGA_MS <= 0) return false
  await new Promise((r) => setTimeout(r, ESPERA_RAFAGA_MS))
  const { data } = await supabase.from('mensajes').select('id')
    .eq('conversacion_id', convId).eq('direccion', 'entrante').gt('created_at', desde).limit(1)
  return !!data?.length
}

interface MensajeHilo { direccion: string; origen: string | null; texto: string | null }

// Los últimos mensajes de la conversación, del más viejo al más nuevo
async function cargarHilo(supabase: Supabase, convId: string): Promise<MensajeHilo[]> {
  const { data } = await supabase.from('mensajes').select('direccion, origen, texto')
    .eq('conversacion_id', convId).order('created_at', { ascending: false }).limit(60)
  return ((data ?? []) as MensajeHilo[]).reverse()
}

const textosDelContacto = (hilo: MensajeHilo[]) =>
  hilo.filter((m) => m.direccion === 'entrante' && m.texto).map((m) => m.texto as string)

const ultimoNuestro = (hilo: MensajeHilo[]) => hilo.map((m) => m.direccion).lastIndexOf('saliente')

// Lo que dijo el contacto desde el último mensaje nuestro (la ráfaga a la que se responde)
const textosDeLaRafaga = (hilo: MensajeHilo[]) => textosDelContacto(hilo.slice(ultimoNuestro(hilo) + 1))

// Lo que había dicho hasta que se le hizo la última pregunta
const textosAntesDeLaPregunta = (hilo: MensajeHilo[]) => textosDelContacto(hilo.slice(0, ultimoNuestro(hilo) + 1))

// deno-lint-ignore no-explicit-any
function grupoElegido(message: any, esperando: boolean, textosRafaga: string[]): string | null {
  const directo = interpretarGrupo(message, esperando)
  if (directo) return directo
  // Pudo haberlo dicho en un mensaje anterior de la misma ráfaga ("quiero un paquete" y después "a Maragogi")
  return textosRafaga.length > 1 ? interpretarGrupo({ text: { body: textosRafaga.join(' ') } }, false) : null
}

async function enviarTextoBot(supabase: Supabase, convId: string, phone: string, texto: string) {
  const wamid = await enviarMeta({ to: phone, type: 'text', text: { body: texto, preview_url: false } })
  await guardarMensajeBot(supabase, convId, phone, texto, wamid)
}

// Deriva a una persona del grupo; si no hay a quién, deja la conversación sin asignar.
// deno-lint-ignore no-explicit-any
async function derivarOCerrar(supabase: Supabase, cfg: any, convId: string, phone: string, grupo: string) {
  const derivada = await derivar(supabase, cfg.mensaje_derivacion, convId, phone, grupo)
  if (!derivada) await cerrarSinAsignar(supabase, cfg.mensaje_sin_asignar, convId, phone, grupo)
}

// Si el contacto dijo cómo se llama y WhatsApp no traía un nombre, se guarda en la conversación y en su lead.
// deno-lint-ignore no-explicit-any
async function guardarNombreDicho(supabase: Supabase, conv: any, phone: string, nombre: string | null) {
  if (!nombre) return
  if (!nombreValido(conv.contacto_nombre)) {
    await supabase.from('conversaciones').update({ contacto_nombre: nombre }).eq('id', conv.id)
  }
  const { data: lead } = await supabase.from('leads').select('id, nombre').eq('whatsapp', phone).maybeSingle()
  if (lead && !nombreValido(lead.nombre)) await supabase.from('leads').update({ nombre }).eq('id', lead.id)
}

// El contacto acaba de elegir Paquetes: se le pide en UN mensaje lo que todavía no dijo.
// Si ya lo dijo todo, va directo a una persona.
// deno-lint-ignore no-explicit-any
async function iniciarFiltro(supabase: Supabase, cfg: any, conv: any, phone: string, hilo: MensajeHilo[]) {
  const datos = extraerDatosViaje(textosDelContacto(hilo))
  await guardarNombreDicho(supabase, conv, phone, datos.nombre)
  // Ya se sabe qué busca: se etiqueta al lead (el embudo de Paquetes es donde ya está)
  await etiquetarLeadPorGrupo(supabase, phone, 'paquetes')
  await enviarLeadAlEmbudoPorGrupo(supabase, phone, 'paquetes')

  const paso = pasoInicial(datos, nombreValido(conv.contacto_nombre) || !!datos.nombre)
  if (paso.accion !== 'preguntar') {
    await derivarOCerrar(supabase, cfg, conv.id, phone, 'paquetes')
    return
  }
  await enviarTextoBot(supabase, conv.id, phone, mensajePreguntas(configFiltro(cfg), paso.faltan))
  await supabase.from('conversaciones').update({ bot_estado: 'filtrando', bot_intentos: 1, grupo: 'paquetes' }).eq('id', conv.id)
}

// Ya se le hicieron las preguntas y contestó: completa, una pregunta de seguimiento (una sola) o a una persona.
// deno-lint-ignore no-explicit-any
async function seguirFiltro(supabase: Supabase, cfg: any, conv: any, phone: string, hilo: MensajeHilo[]) {
  const config = configFiltro(cfg)
  const despues = extraerDatosViaje(textosDelContacto(hilo))
  await guardarNombreDicho(supabase, conv, phone, despues.nombre)

  // Si se apagó el filtrado mientras esperaba, se pasa a una persona
  const paso = config.activo
    ? pasoTrasRespuesta({
      antes: extraerDatosViaje(textosAntesDeLaPregunta(hilo)),
      despues,
      nombreConocido: nombreValido(conv.contacto_nombre) || !!despues.nombre,
      intentos: conv.bot_intentos || 0,
      parecePregunta: textosDeLaRafaga(hilo).some((t) => /[?¿]/.test(t)),
    })
    : { accion: 'derivar' as const }

  if (paso.accion === 'seguimiento') {
    await enviarTextoBot(supabase, conv.id, phone, mensajeSeguimiento(config, paso.faltan))
    await supabase.from('conversaciones').update({ bot_intentos: 2 }).eq('id', conv.id)
    return
  }
  await derivarOCerrar(supabase, cfg, conv.id, phone, 'paquetes')
}

// La conversación, solo si el asistente puede actuar en ella ahora.
async function convDondeActua(supabase: Supabase, convId: string) {
  // select('*'): así funciona igual antes y después de correr la migración de bot_pausado
  const { data: conv } = await supabase.from('conversaciones').select('*').eq('id', convId).maybeSingle()
  if (!conv || conv.asignado_a) return null
  // Chat pausado a mano desde el CRM: solo responde el equipo (ni saluda ni deriva)
  if (conv.bot_pausado) return null
  if (['derivado', 'sin_asignar', 'humano'].includes(conv.bot_estado)) return null
  return conv
}

// `desde` es la hora del mensaje que se acaba de guardar (para saber si llegó otro después).
// deno-lint-ignore no-explicit-any
async function ejecutarBot(supabase: Supabase, convId: string, phone: string, message: any, desde: string | null) {
  const { data: cfg } = await supabase.from('bot_config').select('*').eq('id', 1).maybeSingle()
  if (!cfg?.activo) return

  let conv = await convDondeActua(supabase, convId)
  if (!conv) return

  // Si el contacto sigue escribiendo, contesta el último mensaje. Mientras se esperaba, una
  // persona pudo tomar el chat o pausarse el asistente: por eso se vuelve a leer.
  if (await llegoOtroMensaje(supabase, convId, desde)) return
  conv = await convDondeActua(supabase, convId)
  if (!conv) return

  const hilo = await cargarHilo(supabase, convId)
  if (conv.bot_estado === 'filtrando') {
    await seguirFiltro(supabase, cfg, conv, phone, hilo)
    return
  }

  const esperando = conv.bot_estado === 'esperando'
  const grupo = grupoElegido(message, esperando, textosDeLaRafaga(hilo))

  if (grupo === 'paquetes' && configFiltro(cfg).activo) {
    await iniciarFiltro(supabase, cfg, conv, phone, hilo)
    return
  }
  if (grupo) {
    await derivarOCerrar(supabase, cfg, convId, phone, grupo)
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
async function correrBot(supabase: Supabase, convId: string, phone: string, message: any, desde: string | null) {
  try {
    await ejecutarBot(supabase, convId, phone, message, desde)
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

    // Los avisos de "statuses" (enviado / entregado / leído / fallido) llegan al
    // mismo endpoint, sin "messages": actualizan el estado de nuestros mensajes.
    // deno-lint-ignore no-explicit-any
    const estados = (body?.entry ?? []).flatMap((en: any) => en?.changes ?? []).flatMap((c: any) => c?.value?.statuses ?? [])
    if (estados.length) {
      await procesarEstados(
        createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!),
        estados,
      )
    }

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

    // El interés (tipo de servicio + destino) se detecta por palabras clave en
    // cada mensaje. Solo se completa lo que falta: lo que ya tenía el lead, ya
    // sea detectado antes o cargado a mano, no se pisa.
    const interes = detectarInteres(texto)

    const { data: leadExistente } = await supabase
      .from('leads').select('id, interes_tipo, interes_destino').eq('whatsapp', phone).maybeSingle()

    if (!leadExistente) {
      await supabase.from('leads').insert({
        nombre,
        whatsapp: phone,
        notas: texto,
        origen: 'WhatsApp',
        estado: 'nuevo',
        interes_tipo: interes.tipo,
        interes_destino: interes.destino,
      })
    } else {
      const cambios: Record<string, string> = {}
      if (interes.tipo && !leadExistente.interes_tipo) cambios.interes_tipo = interes.tipo
      if (interes.destino && !leadExistente.interes_destino) cambios.interes_destino = interes.destino
      if (Object.keys(cambios).length) await supabase.from('leads').update(cambios).eq('id', leadExistente.id)
    }

    const { data: convExistente } = await supabase
      .from('conversaciones').select('id, no_leidos, contacto_nombre').eq('whatsapp', phone).maybeSingle()

    let convId: string | undefined

    if (convExistente) {
      // Si WhatsApp no trae el nombre del perfil se conserva el que ya tenía (por ejemplo, el que dijo el contacto)
      const nombreConv = nombre === 'Sin nombre' && nombreValido(convExistente.contacto_nombre) ? convExistente.contacto_nombre : nombre
      await supabase.from('conversaciones').update({
        contacto_nombre: nombreConv,
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
      const { data: fila } = await supabase.from('mensajes').insert(filaBase).select('created_at').single()
      await correrBot(supabase, convId, phone, message, fila?.created_at ?? null)
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

    const { data: filaMedia, error: insertMediaErr } = await supabase.from('mensajes').insert({
      ...filaBase,
      tipo: tipoMedia,
      media_path: archivo?.path ?? null,
      media_mime: archivo?.mime ?? media?.mime_type ?? null,
      media_nombre: nombreArchivo,
    }).select('created_at').single()
    let desde: string | null = filaMedia?.created_at ?? null
    if (insertMediaErr) {
      console.error('webhook-whatsapp insert con media falló, guardando solo el texto:', insertMediaErr)
      const { data: filaTexto } = await supabase.from('mensajes').insert(filaBase).select('created_at').single()
      desde = filaTexto?.created_at ?? null
    }

    await correrBot(supabase, convId, phone, message, desde)
    return new Response('ok', { status: 200 })
  } catch (err) {
    // Devolvemos 200 igual aunque falle: si respondemos error, Meta reintenta
    // la entrega con reintentos/backoff y puede terminar duplicando el mensaje.
    console.error('webhook-whatsapp error:', err)
    return new Response('ok', { status: 200 })
  }
})
