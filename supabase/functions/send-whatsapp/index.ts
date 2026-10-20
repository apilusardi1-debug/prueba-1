import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { renderTemplate } from '../_shared/plantillasWhatsapp.ts'
import { moverAEtapaPaquetes, moverAEtapaAnfitriona } from '../_shared/embudoEntrada.ts'
import { verificarSesion } from '../_shared/sesionPanel.ts'
import { usa360dialog, destinoMensajesCrm, plantillasAprobadas360 } from '../_shared/proveedorWhatsapp.ts'

const PANEL_SESSION_SECRET = Deno.env.get('PANEL_SESSION_SECRET')

// Número operativo (avisos automáticos a chofer/guía/cliente, solo plantillas)
const META_TOKEN = Deno.env.get('META_WHATSAPP_TOKEN')
const META_PHONE_NUMBER_ID = Deno.env.get('META_PHONE_NUMBER_ID')
// Número de CRM (leads/clientes, texto libre — respuestas del inbox)
const META_CRM_TOKEN = Deno.env.get('META_CRM_WHATSAPP_TOKEN')
const META_CRM_PHONE_NUMBER_ID = Deno.env.get('META_CRM_PHONE_NUMBER_ID')
const META_API_VERSION = 'v21.0'
// Formulario "Datos del viaje" (WhatsApp Flow) de la cuenta del CRM: el mismo que manda el
// asistente (webhook-whatsapp). Desde el CRM lo puede mandar una persona a mano.
const FLOW_ID_PAQUETES = Deno.env.get('FLOW_ID_PAQUETES')
const TEXTO_FLOW = 'Perfecto! Para armarte una propuesta a tu medida, completá estos datos:'
// Categoría de Meta de una plantilla del CRM -> cómo se cobra (tabla tarifas_mensaje)
const COBRO_CATEGORIA: Record<string, string> = { MARKETING: 'marketing', UTILITY: 'utilidad', AUTHENTICATION: 'autenticacion' }
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

// Sin tildes ni mayúsculas, para comparar el texto de un mensaje sin que un
// acento de más (o de menos) rompa la coincidencia.
function normalizarTexto(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
const FRASE_ESTADIA_CONFIRMADA = normalizarTexto('Tu reserva esta confirmada te esperamos en este paraiso')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-panel-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { phone, template, params, message, nombre, conversacion_id, media, accion, filename, usuario_id, plantilla, responde_a, emoji } = await req.json()
    // "Responder" del CRM: wa_message_id del mensaje citado (solo texto y archivos)
    const respondeA: string | null = typeof responde_a === 'string' && responde_a.startsWith('wamid.') ? responde_a : null
    const usuarioId: string | null = typeof usuario_id === 'string' && /^[0-9a-f-]{36}$/i.test(usuario_id) ? usuario_id : null

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Solo manda quien tiene una sesión del panel vigente y su usuario sigue activo: la clave
    // pública del proyecto no alcanza para mandar mensajes.
    const emailSesion = await verificarSesion(PANEL_SESSION_SECRET, req.headers.get('x-panel-token'))
    const { data: usuarioSesion } = emailSesion
      ? await supabase.from('usuarios_admin').select('activo').eq('email', emailSesion).maybeSingle()
      : { data: null }
    if (!usuarioSesion?.activo) {
      return new Response(JSON.stringify({ error: 'Sesión del panel no válida. Volvé a entrar.' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

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

    // Plantillas aprobadas del número del CRM, para elegir una en el chat cuando pasaron
    // las 24 hs (Meta no deja texto libre fuera de esa ventana).
    if (accion === 'plantillas') {
      const lista = await plantillasAprobadas360()
      return new Response(JSON.stringify({ plantillas: lista }), {
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    let phoneClean = phone.replace(/\D/g, '')
    // Argentina: 54 + número sin 9 (12 dígitos) → agregar 9 → 5492352560810
    if (phoneClean.startsWith('54') && !phoneClean.startsWith('549') && phoneClean.length === 12) {
      phoneClean = '549' + phoneClean.slice(2)
    }
    // Brasil: 55 + DDD + 8 dígitos de celular (que empiezan con 6 a 9) → falta el 9 de celular
    if (phoneClean.startsWith('55') && phoneClean.length === 12 && /^[6-9]/.test(phoneClean.slice(4))) {
      phoneClean = phoneClean.slice(0, 4) + '9' + phoneClean.slice(4)
    }

    // Reacción del CRM a un mensaje (accion "reaccion", con responde_a = wa_message_id del
    // mensaje y emoji; emoji vacío = sacarla). No es un mensaje nuevo: se guarda en el
    // mensaje reaccionado (reaccion_nuestra) y no toca la conversación.
    if (accion === 'reaccion') {
      if (!respondeA || typeof emoji !== 'string' || Array.from(emoji).length > 8) {
        return new Response(JSON.stringify({ error: 'Reacción inválida' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }
      const destino = destinoMensajesCrm(META_CRM_TOKEN, META_CRM_PHONE_NUMBER_ID)
      const res = await fetch(destino.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...destino.headers },
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: phoneClean, type: 'reaction', reaction: { message_id: respondeA, emoji } }),
      })
      const respuesta = await res.text()
      if (!res.ok) {
        console.error(`Reacción rechazada ${res.status}:`, respuesta)
        return new Response(JSON.stringify({ error: `Meta error ${res.status}`, detail: respuesta }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }
      await supabase.from('mensajes').update({ reaccion_nuestra: emoji || null }).eq('wa_message_id', respondeA)
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...CORS } })
    }

    // Dos casos: "template" = aviso automático del número operativo (chofer/
    // guía/cliente); "message" = respuesta de texto libre desde el inbox del
    // CRM (número de leads/clientes). Cada uno usa su propio número/token de
    // Meta — son apps y WABAs distintas.
    // Desde el chat del CRM también se puede mandar, a mano, el formulario "Datos del viaje"
    // (accion "formulario") o una plantilla aprobada del número del CRM ("plantilla", con
    // nombre, idioma, categoría, texto y valores de sus variables).
    const esFlow = accion === 'formulario'
    const esPlantillaCrm = !esFlow && !template && !!plantilla && typeof plantilla === 'object'
    const esMedia = !template && !esFlow && !esPlantillaCrm && !!media
    const esTexto = !template && !esMedia && !esFlow && !esPlantillaCrm && !!message
    const esCrm = esTexto || esMedia || esFlow || esPlantillaCrm
    if (esFlow && !FLOW_ID_PAQUETES) {
      return new Response(JSON.stringify({ error: 'Falta cargar el formulario (FLOW_ID_PAQUETES) en los secrets de Supabase.' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }
    const paramsPlantilla: string[] = esPlantillaCrm && Array.isArray(plantilla.params) ? plantilla.params.map((p: unknown) => String(p ?? '').trim()) : []
    if (esPlantillaCrm && (!/^[a-z0-9_]+$/.test(String(plantilla.name || '')) || !/^[a-zA-Z_]+$/.test(String(plantilla.language || '')) || paramsPlantilla.some((p) => !p))) {
      return new Response(JSON.stringify({ error: 'Plantilla inválida o con datos sin completar' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }
    const metaToken = esCrm ? META_CRM_TOKEN : META_TOKEN
    const metaPhoneNumberId = esCrm ? META_CRM_PHONE_NUMBER_ID : META_PHONE_NUMBER_ID

    // El número del CRM puede ir por 360dialog (ver _shared/proveedorWhatsapp.ts): en ese
    // caso no hacen falta el token ni el id de número de Meta.
    const crmPor360 = esCrm && usa360dialog
    if (!crmPor360 && (!metaToken || !metaPhoneNumberId)) {
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
      : esFlow
      ? {
          messaging_product: 'whatsapp',
          to: phoneClean,
          type: 'interactive',
          interactive: {
            type: 'flow',
            body: { text: TEXTO_FLOW },
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
        }
      : esPlantillaCrm
      ? {
          messaging_product: 'whatsapp',
          to: phoneClean,
          type: 'template',
          template: {
            name: plantilla.name,
            language: { code: plantilla.language },
            ...(paramsPlantilla.length ? {
              components: [{ type: 'body', parameters: paramsPlantilla.map((text) => ({ type: 'text', text })) }],
            } : {}),
          },
        }
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

    // deno-lint-ignore no-explicit-any
    if (respondeA && (esMedia || esTexto)) (metaBody as any).context = { message_id: respondeA }

    console.log(esMedia ? `Enviando ${media.tipo} a ${phoneClean} (CRM)` : esTexto ? `Enviando texto libre a ${phoneClean} (CRM)`
      : esFlow ? `Enviando formulario a ${phoneClean} (CRM)` : esPlantillaCrm ? `Enviando plantilla "${plantilla.name}" a ${phoneClean} (CRM)`
      : `Enviando plantilla "${template}" a ${phoneClean} (operativo)`)

    const metaController = new AbortController()
    const metaTimer = setTimeout(() => metaController.abort(), 15000)

    const destino = esCrm
      ? destinoMensajesCrm(metaToken, metaPhoneNumberId)
      : { url: `https://graph.facebook.com/${META_API_VERSION}/${metaPhoneNumberId}/messages`, headers: { Authorization: `Bearer ${metaToken}` } }
    const res = await fetch(destino.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...destino.headers },
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
      : esTexto ? message
      : esFlow ? `${TEXTO_FLOW} [formulario "Completar datos del viaje"]`
      : esPlantillaCrm ? String(plantilla.texto || plantilla.name).replace(/\{\{(\d+)\}\}/g, (_: string, n: string) => paramsPlantilla[Number(n) - 1] ?? '')
      : renderTemplate(template, params || [])

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
      // El id que devuelve Meta permite ubicar el mensaje cuando llegan los avisos
      // de entregado / leído / fallido al webhook.
      // deno-lint-ignore no-explicit-any
      const waMessageId: string | null = (data as any)?.messages?.[0]?.id ?? null
      await supabase.from('mensajes').insert({
        conversacion_id: convId,
        whatsapp: phoneClean,
        texto: mensajeLegible,
        direccion: 'saliente',
        wa_message_id: waMessageId,
        estado_envio: waMessageId ? 'enviado' : null,
        estado_envio_at: waMessageId ? new Date().toISOString() : null,
        // Respuesta libre dentro de la ventana de 24 hs = servicio (sin costo);
        // una plantilla se cobra según su categoría.
        cobro: esPlantillaCrm ? (COBRO_CATEGORIA[String(plantilla.category || '').toUpperCase()] || 'marketing')
          : template ? (COBRO_PLANTILLA[template] || 'utilidad') : 'servicio',
        // Qué número de Meta lo mandó: hace falta para el pozo de 1.000 gratis por mes de
        // CADA número (ver migración 20260925110000_costos_por_pais_whatsapp.sql)
        numero: esCrm ? 'crm' : 'operativo',
        enviado_por: esCrm ? usuarioId : null,
        ...(respondeA && (esMedia || esTexto) ? { respuesta_a_wamid: respondeA } : {}),
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
        .or('bot_estado.is.null,bot_estado.eq.esperando,bot_estado.eq.filtrando')
    }

    // Si la conversación la tiene asignada alguien que no respondió al último
    // mensaje del contacto, y ahora responde otro usuario del equipo, la
    // conversación pasa a quien respondió. Si el asignado ya respondió, no se toca.
    // Una conversación sin asignar (por ejemplo, un cliente que viene del historial de
    // Kommo y vuelve a escribir) queda asignada a quien la responde primero.
    if (esCrm && convId && usuarioId) {
      const { data: conv } = await supabase.from('conversaciones').select('asignado_a').eq('id', convId).maybeSingle()
      if (conv && !conv.asignado_a) {
        await supabase.from('conversaciones').update({ asignado_a: usuarioId }).eq('id', convId).is('asignado_a', null)
      } else if (conv?.asignado_a && conv.asignado_a !== usuarioId) {
        const { data: ultimoEntrante } = await supabase.from('mensajes')
          .select('created_at').eq('conversacion_id', convId).eq('direccion', 'entrante')
          .order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (ultimoEntrante) {
          const { data: respondioAsignado } = await supabase.from('mensajes')
            .select('id').eq('conversacion_id', convId).eq('direccion', 'saliente')
            .eq('enviado_por', conv.asignado_a).gt('created_at', ultimoEntrante.created_at).limit(1)
          if (!respondioAsignado?.length) {
            await supabase.from('conversaciones').update({ asignado_a: usuarioId }).eq('id', convId)
          }
        }
      }
    }

    // Un documento cuyo nombre empieza con "Propuesta" (así se llaman los PDF
    // del Generador de propuesta, y así hay que nombrar cualquier otro que se
    // suba a mano) mueve al lead a "Propuesta enviada" en el embudo de
    // Paquetes — un PDF con otro nombre (catálogo, voucher, etc) no lo mueve.
    // El detalle de lo que el cliente eligió y cuánto paga por cada servicio
    // sale de dos PDF distintos del Generador — "Detalle final" o "Detalles y
    // Servicios" (en la práctica el equipo manda cualquiera de los dos para
    // esto, confirmado 2026-10-01 con un caso real que "Detalle final" solo
    // no cubría) — cualquiera de los dos manda a "Envío de detalle". Mismo
    // destino al que ya manda el trigger de la base cuando la propuesta pasa
    // a "archivada" (ver migración 20261001100000_etapa_envio_detalle.sql)
    // — lo que pase primero, enviar el PDF o archivar la propuesta.
    //
    // Importante: para encontrar al lead hay que usar `phone` tal cual llegó
    // (lo mismo que guardan conversaciones.whatsapp y leads.whatsapp), no
    // `phoneClean` — ese ya tiene el 9 agregado para que Meta entregue el
    // mensaje, y en los números de Brasil que llegan sin el 9 (wa_id de Meta
    // inconsistente, ver CLAUDE.md) ese agregado hacía que el whatsapp ya no
    // matcheara con el del lead y la automatización no moviera nada, sin
    // avisar el error (caso real de Marcos, 2026-10-07: PDF enviado, el lead
    // se quedó en "Filtrado").
    if (esCrm && esMedia && media.tipo === 'document') {
      const nombreArchivo = String(media.nombre || '').trim()
      if (/^propuesta/i.test(nombreArchivo)) {
        await moverAEtapaPaquetes(supabase, phone, 'propuesta_enviada')
      } else if (/^detalle[ _-]*final/i.test(nombreArchivo) || /^detalles[ _-]*y[ _-]*servicios/i.test(nombreArchivo)) {
        await moverAEtapaPaquetes(supabase, phone, 'envio_detalle')
      } else if (/cierre/i.test(nombreArchivo)) {
        // Alcanza con que el nombre tenga la palabra "cierre" en cualquier parte (pedido
        // de Cristian, 2026-10-11 — antes exigía que empezara con "PDF de Cierre").
        // Se manda recién después de "Ya pagó, reserva confirmada" — el lead no se
        // queda parado acá: el trigger de la base lo redirige al instante a
        // Anfitriona y deja un comprobante de 24hs en el tablero (ver migración
        // 20261011100000_pdf_cierre_registro_y_anfitriona.sql).
        await moverAEtapaPaquetes(supabase, phone, 'pdf_enviado')
      }
    }

    // Un lead en "Anfitriona asignada" pasa a "En contacto con el cliente" con el primer
    // mensaje que le manda el equipo, diga lo que diga (pedido de Cristian, 2026-10-14;
    // antes hacía falta que el mensaje dijera "anfitriona"). Solo avanza: un lead que ya
    // está más adelante en el embudo de Anfitriona, o en otro embudo, no se toca.
    if (esCrm) {
      await moverAEtapaAnfitriona(supabase, phone, 'anfitriona_contacto')
    }

    // Cuando se le manda al lead el mensaje de reserva confirmada, pasa solo a
    // "Estadía confirmada".
    if (esCrm && normalizarTexto(mensajeLegible).includes(FRASE_ESTADIA_CONFIRMADA)) {
      await moverAEtapaAnfitriona(supabase, phone, 'anfitriona_confirmada')
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
