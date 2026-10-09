import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { detectarInteresConExtras } from '../_shared/interes.ts'
import { estadoDeMeta, filtroEstadosPrevios } from '../_shared/estadoEnvio.ts'
import { etiquetarLeadPorGrupo } from '../_shared/etiquetas.ts'
import { enviarLeadAlEmbudoPorGrupo, moverAFiltrado } from '../_shared/embudoEntrada.ts'
import { extraerDatosViaje } from '../_shared/datosViaje.ts'
import { configFiltro, nombreValido, pasoInicial, pasoTrasRespuesta, mensajePreguntas, mensajeSeguimiento } from '../_shared/filtroPaquetes.ts'
import { firmaMetaValida } from '../_shared/firmaMeta.ts'

// Webhook oficial de Meta Cloud API para el número de CRM (leads/clientes).
// Reemplaza la versión anterior, que hablaba el formato de WuzAPI (form-encoded
// jsonData estilo Baileys) — ese número se migró a Meta directo, sin BSP, porque
// nadie del equipo dependía de seguir usando la app de WhatsApp Business en el
// celular. El número operativo (avisos a chofer/guía/cliente) es un número y una
// app de Meta distintos, no tocados por este archivo.
const META_VERIFY_TOKEN = Deno.env.get('META_VERIFY_TOKEN')
const META_CRM_TOKEN = Deno.env.get('META_CRM_WHATSAPP_TOKEN')
const META_APP_SECRET = Deno.env.get('META_APP_SECRET')
const META_API_VERSION = 'v21.0'
const MEDIA_BUCKET = 'whatsapp-media'

// WhatsApp Flow "Datos del viaje" (filtro de Paquetes): alternativa al mensaje de texto,
// con un formulario de verdad dentro de WhatsApp. Publicado en Meta (no en borrador):
// le llega a cualquier cliente, no solo a números de prueba. Al subir un cambio de
// contenido (assets) Meta lo vuelve a poner en borrador solo — hay que publicarlo de
// nuevo después de cada edición, o el cliente vuelve a ver el aviso de "solo prueba".
const FLOW_ID_PAQUETES = '2122264095351293'
const DESTINO_FLOW: Record<string, string> = {
  porto_de_galinhas: 'Porto de Galinhas', maragogi: 'Maragogi', pipa: 'Pipa',
  fernando_de_noronha: 'Fernando de Noronha', maceio: 'Maceió',
}
const HOSPEDAJE_FLOW: Record<string, string> = {
  resort_all_inclusive: 'Resort todo incluido (All Inclusive)', hotel_media_pension: 'Hotel con media pensión',
  posada_desayuno: 'Posada con desayuno incluido', depto_amoblado: 'Departamento amoblado cerca de la playa/centro',
}
const PRESUPUESTO_FLOW: Record<string, string> = {
  '1000_2000': '1.000 a 2.000 USD', '2000_2500': '2.000 a 2.500 USD', '2500_3000': '2.500 a 3.000 USD',
}
const PAIS_FLOW: Record<string, string> = {
  argentina: 'Argentina', uruguay: 'Uruguay', chile: 'Chile', paraguay: 'Paraguay', peru: 'Perú', venezuela: 'Venezuela',
}

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

// Devuelve la opción del menú elegida (una de OPCIONES_MENU) o null si no se entiende o es
// ambigua. Los números "1" a "4" solo valen si el menú ya se mostró. El menú tiene 4 opciones
// (Paquetes, Paseos, Traslados, Hospedajes) — WhatsApp no permite más de 3 botones de
// respuesta rápida, por eso se manda como lista (interactive.list_reply, no button_reply).
const OPCIONES_MENU: Record<string, RegExp> = {
  paquetes: /paquete/,
  paseos: /\bpaseo|excursion|\btours?\b/,
  traslados: /traslado|translado|transfer/,
  hospedajes: /hotel|hospedaje|alojamiento|pousada|posada|hostel/,
}
const NUMERO_OPCION: Record<string, string> = { '1': 'paquetes', '2': 'paseos', '3': 'traslados', '4': 'hospedajes' }

// deno-lint-ignore no-explicit-any
function interpretarGrupo(message: any, permitirNumeros: boolean): string | null {
  const idElegido = message?.interactive?.list_reply?.id ?? message?.interactive?.button_reply?.id
  if (idElegido && idElegido in OPCIONES_MENU) return idElegido
  const t = sinAcentos(String(message?.text?.body ?? message?.button?.text ?? '').toLowerCase()).trim()
  if (!t) return null
  if (permitirNumeros) {
    const m = /^([1-4])\W*$/.exec(t)
    if (m) return NUMERO_OPCION[m[1]]
  }
  const encontradas = Object.entries(OPCIONES_MENU).filter(([, re]) => re.test(t)).map(([id]) => id)
  return encontradas.length === 1 ? encontradas[0] : null
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

// Manda el formulario nativo en vez del mensaje de texto de siempre. El cliente lo
// completa sin salir de WhatsApp; la respuesta llega por el webhook como un mensaje
// interactivo (nfm_reply), no como texto — ver textoDesdeFlow más abajo.
async function enviarFlowDatosViaje(supabase: ReturnType<typeof createClient>, convId: string, phone: string) {
  const wamid = await enviarMeta({
    to: phone,
    type: 'interactive',
    interactive: {
      type: 'flow',
      body: { text: 'Perfecto! Para armarte una propuesta a tu medida, completá estos datos:' },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_id: FLOW_ID_PAQUETES,
          flow_cta: 'Completar datos del viaje',
          flow_action: 'navigate',
          flow_action_payload: { screen: 'DATOS_VIAJE' },
        },
      },
    },
  })
  await guardarMensajeBot(
    supabase, convId, phone,
    'Perfecto! Para armarte una propuesta a tu medida, completá estos datos: [formulario "Completar datos del viaje"]',
    wamid,
  )
}

// Arma una respuesta de flow (JSON con un valor por campo) como el mismo texto
// "Campo: valor" línea por línea que ya entiende el lector de datosViaje.ts, así el
// resto del filtro (pasoTrasRespuesta, extraerDatosViaje) no necesita saber que esto
// vino de un formulario y no de texto escrito a mano.
// El DatePicker devuelve "AAAA-MM-DD" (como lo pide Meta); se muestra como al equipo
// le resulta natural leerlo ("DD/MM/AAAA").
function fechaLegible(iso: string | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

// Campos individuales "edad_menor_1".."edad_menor_5" (uno por menor, el Flow
// solo muestra los que corresponden a "cantidad_menores") — se juntan en una
// sola linea "Edades: 8, 12" para que datosViaje.ts los siga leyendo igual
// que antes, sin tocar ese archivo.
const MAX_MENORES_FLOW = 5

function textoDesdeFlow(r: Record<string, string>): string {
  const cantidadMenores = r.hay_menores === 'si' ? (Number(r.cantidad_menores) || 0) : 0
  const edades = Array.from({ length: MAX_MENORES_FLOW }, (_, i) => r[`edad_menor_${i + 1}`]).filter(Boolean).slice(0, cantidadMenores)
  const lineas = [
    `Nombre: ${r.nombre ?? ''}`,
    `Destino: ${DESTINO_FLOW[r.destino] || r.destino || ''}`,
    `País: ${PAIS_FLOW[r.pais] || r.pais || ''}`,
    `Origen: ${r.origen ?? ''}`,
    `Adultos: ${r.adultos ?? ''}`,
    `Menores: ${cantidadMenores}`,
  ]
  if (edades.length) lineas.push(`Edades: ${edades.join(', ')}`)
  // Fernando de Noronha no tiene resorts all inclusive: el Flow muestra una
  // lista de hospedaje sin esa opción para ese destino, en un campo aparte
  // ("hospedaje_noronha") porque WhatsApp no permite deshabilitar una sola
  // opción de un Dropdown según otro campo, solo mostrar/ocultar el campo entero.
  const hospedaje = r.hospedaje || r.hospedaje_noronha
  lineas.push(`Hospedaje: ${HOSPEDAJE_FLOW[hospedaje] || hospedaje || ''}`)
  lineas.push(`Presupuesto: ${PRESUPUESTO_FLOW[r.presupuesto] || r.presupuesto || ''}`)
  const noches = r.noches ? ` · ${r.noches} noches` : ''
  lineas.push(`Fecha: ${fechaLegible(r.ida)} al ${fechaLegible(r.vuelta)}${noches}`)
  return lineas.join('\n')
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

// 4 opciones no entran en botones de respuesta rápida (WhatsApp permite 3 como máximo), por
// eso el menú se manda como lista (interactive.type 'list') — el cliente toca "Elegir" y ve
// las 4 filas. "Traslados" y "Hospedajes" no tienen equipo ni embudo propio: se tratan como
// Paseos y Paquetes respectivamente (ver GRUPO_REAL en ejecutarBot).
async function enviarMenu(supabase: ReturnType<typeof createClient>, convId: string, phone: string, intro: string) {
  const wamid = await enviarMeta({
    to: phone,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: intro },
      action: {
        button: 'Elegir',
        sections: [{
          title: '¿En qué te ayudamos?',
          rows: [
            { id: 'paquetes', title: 'Paquetes' },
            { id: 'paseos', title: 'Paseos' },
            { id: 'traslados', title: 'Traslados' },
            { id: 'hospedajes', title: 'Hospedajes' },
          ],
        }],
      },
    },
  })
  await guardarMensajeBot(supabase, convId, phone, `${intro}\n[Opciones: Paquetes / Paseos / Traslados / Hospedajes]`, wamid)
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
    await moverAFiltrado(supabase, phone)
    await derivarOCerrar(supabase, cfg, conv.id, phone, 'paquetes')
    return
  }
  if (cfg?.filtro_metodo === 'flow') {
    await enviarFlowDatosViaje(supabase, conv.id, phone)
  } else {
    await enviarTextoBot(supabase, conv.id, phone, mensajePreguntas(configFiltro(cfg), paso.faltan))
  }
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
  await moverAFiltrado(supabase, phone)
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
  const opcionElegida = grupoElegido(message, esperando, textosDeLaRafaga(hilo))
  // "Traslados" y "Hospedajes" son dos filas más del menú, pero no tienen equipo de reparto
  // ni embudo propio — entran al mismo circuito que Paseos y Paquetes respectivamente (mismo
  // criterio que ya se usa con el interés detectado por palabra clave, ver GRUPO_POR_INTERES
  // en el webhook). Un hospedaje sigue pidiendo los datos del filtro, igual que un paquete.
  const GRUPO_REAL: Record<string, string> = { traslados: 'paseos', hospedajes: 'paquetes' }
  const grupo = opcionElegida ? (GRUPO_REAL[opcionElegida] ?? opcionElegida) : null

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

// Meta reintenta cuando no recibe el 200 a tiempo: el mismo mensaje puede llegar dos veces.
// Con wa_message_id único la segunda entrega no crea otra fila ni vuelve a correr el bot.
// Devuelve null si el mensaje ya estaba. Si el upsert falla (por ejemplo, antes de correr la
// migración de la clave única), guarda igual la fila de respaldo para no perder el mensaje.
async function guardarEntrante(supabase: ReturnType<typeof createClient>, fila: Record<string, unknown>, respaldo = fila) {
  const { data, error } = await supabase.from('mensajes')
    .upsert(fila, { onConflict: 'wa_message_id', ignoreDuplicates: true })
    .select('created_at')
  if (!error) return data?.[0] ?? null
  console.error('webhook-whatsapp guardar entrante falló, se guarda sin dedupe:', error.message)
  const { data: plano } = await supabase.from('mensajes').insert(respaldo).select('created_at').single()
  return plano ?? { created_at: null }
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

  // Sin una firma válida de Meta no se procesa nada: la URL es pública y cualquiera
  // podría mandar mensajes falsos que el asistente responde por WhatsApp.
  const cuerpoCrudo = await req.text()
  if (!(await firmaMetaValida(META_APP_SECRET, cuerpoCrudo, req.headers.get('x-hub-signature-256')))) {
    console.error('webhook-whatsapp: firma de Meta inválida o META_APP_SECRET sin configurar')
    return new Response('Firma inválida', { status: 401 })
  }

  try {
    const body = JSON.parse(cuerpoCrudo)
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

    // Respuesta del formulario "Datos del viaje" (WhatsApp Flow): llega como un mensaje
    // interactivo con los campos en JSON, no como texto. Se convierte a "Campo: valor"
    // para que el resto del filtro (que ya sabe leer eso) no note la diferencia.
    let datosFlow: Record<string, string> | null = null
    if (message.interactive?.type === 'nfm_reply' && message.interactive.nfm_reply?.response_json) {
      try { datosFlow = JSON.parse(message.interactive.nfm_reply.response_json) } catch { /* sigue por el camino de siempre */ }
    }

    const texto: string = datosFlow ? textoDesdeFlow(datosFlow) : (
      message.text?.body ??
      message.button?.text ??
      message.interactive?.button_reply?.title ??
      message.interactive?.list_reply?.title ??
      media?.caption ??
      textoUbicacion ??
      (tipoMedia ? `${ETIQUETA_MEDIA[tipoMedia]}${nombreArchivo ? `: ${nombreArchivo}` : ''}` : `[Mensaje de tipo ${message.type}]`)
    )

    const nombre: string = value?.contacts?.[0]?.profile?.name || 'Sin nombre'

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (message.id) {
      const { data: previo } = await supabase.from('mensajes').select('id').eq('wa_message_id', message.id).limit(1)
      if (previo?.length) return new Response('ok', { status: 200 })
    }

    // El interés (tipo de servicio + destino) se detecta por palabras clave en
    // cada mensaje, más los sinónimos que se carguen a mano en "Entrenar al
    // asistente" (tabla asistente_sinonimos). Solo se completa lo que falta: lo
    // que ya tenía el lead, ya sea detectado antes o cargado a mano, no se pisa.
    const { data: sinonimos } = await supabase.from('asistente_sinonimos').select('tipo, valor, palabras')
    const interes = detectarInteresConExtras(texto, sinonimos || [])

    const { data: leadExistente } = await supabase
      .from('leads').select('id, estado, interes_tipo, interes_destino').eq('whatsapp', phone).maybeSingle()

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
      // Un lead perdido (por ejemplo, por 15 días sin actividad en Filtrado —
      // ver leads_perder_inactivos_filtrado en la base) que vuelve a escribir
      // es una consulta nueva: arranca de cero en el embudo de Paquetes.
      if (leadExistente.estado === 'perdido') cambios.estado = 'nuevo'
      if (Object.keys(cambios).length) await supabase.from('leads').update(cambios).eq('id', leadExistente.id)
    }

    // Un interés de Traslado o de Hospedaje (detectado por palabra clave, sin pasar por el
    // menú de Paquetes/Paseos) manda igual al embudo correspondiente -- pedido de Cristian,
    // 2026-10-09: traslado entra a Paseos, hospedaje entra a Paquetes. Usa el mismo mecanismo
    // y la misma guarda que el menú (enviarLeadAlEmbudoPorGrupo no mueve a un lead que ya
    // esté trabajado, solo a uno recién llegado), así que es seguro llamarlo en cada mensaje.
    const GRUPO_POR_INTERES: Record<string, string> = { traslado: 'paseos', hospedaje: 'paquetes' }
    if (interes.tipo && GRUPO_POR_INTERES[interes.tipo]) {
      await enviarLeadAlEmbudoPorGrupo(supabase, phone, GRUPO_POR_INTERES[interes.tipo])
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
      wa_message_id: message.id ?? null,
    }

    if (!tipoMedia) {
      const fila = await guardarEntrante(supabase, filaBase)
      if (!fila) return new Response('ok', { status: 200 })
      await correrBot(supabase, convId, phone, message, fila.created_at ?? null)
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

    const filaMedia = await guardarEntrante(supabase, {
      ...filaBase,
      tipo: tipoMedia,
      media_path: archivo?.path ?? null,
      media_mime: archivo?.mime ?? media?.mime_type ?? null,
      media_nombre: nombreArchivo,
    }, filaBase)
    if (!filaMedia) return new Response('ok', { status: 200 })

    await correrBot(supabase, convId, phone, message, filaMedia.created_at ?? null)
    return new Response('ok', { status: 200 })
  } catch (err) {
    // Devolvemos 200 igual aunque falle: si respondemos error, Meta reintenta
    // la entrega con reintentos/backoff y puede terminar duplicando el mensaje.
    console.error('webhook-whatsapp error:', err)
    return new Response('ok', { status: 200 })
  }
})
