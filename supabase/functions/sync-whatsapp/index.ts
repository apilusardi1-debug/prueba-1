import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WUZAPI_URL = Deno.env.get('WUZAPI_URL')
const WUZAPI_TOKEN = Deno.env.get('WUZAPI_TOKEN')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Obtener contactos conocidos de WuzAPI
    const contactsRes = await fetch(`${WUZAPI_URL}/contacts/?token=${WUZAPI_TOKEN}`)
    const nombrePorPhone: Record<string, string> = {}

    if (contactsRes.ok) {
      const contactsData = await contactsRes.json()
      const contacts = contactsData?.data ?? contactsData
      if (Array.isArray(contacts)) {
        for (const c of contacts) {
          const jid: string = c.JID ?? c.jid ?? c.id ?? ''
          const nombre: string = c.Name ?? c.PushName ?? c.FullName ?? ''
          if (jid && nombre) {
            const phone = jid.split(':')[0].split('@')[0]
            if (phone) nombrePorPhone[phone] = nombre
          }
        }
      }
    }

    // Obtener todas las conversaciones existentes
    const { data: convs, error: convErr } = await supabase
      .from('conversaciones')
      .select('id, whatsapp, contacto_nombre')

    if (convErr) throw convErr

    let actualizadas = 0

    for (const conv of convs ?? []) {
      const nombreNuevo = nombrePorPhone[conv.whatsapp]
      if (nombreNuevo && nombreNuevo !== conv.contacto_nombre && nombreNuevo !== conv.whatsapp) {
        await supabase
          .from('conversaciones')
          .update({ contacto_nombre: nombreNuevo })
          .eq('id', conv.id)
        actualizadas++
      }
    }

    // Importar contactos de WuzAPI que no existan aún en conversaciones
    let syncedConversaciones = 0
    for (const [phone, nombre] of Object.entries(nombrePorPhone)) {
      if (phone.length < 7 || phone.length > 15) continue
      const yaExiste = (convs ?? []).some((c) => c.whatsapp === phone)
      if (yaExiste) continue

      await supabase.from('conversaciones').insert({
        whatsapp: phone,
        contacto_nombre: nombre,
        ultimo_mensaje_at: new Date().toISOString(),
        no_leidos: 0,
      })
      syncedConversaciones++
    }

    return new Response(
      JSON.stringify({
        ok: true,
        syncedConversaciones,
        actualizadas,
        totalContactos: Object.keys(nombrePorPhone).length,
      }),
      { headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  } catch (err) {
    console.error('sync-whatsapp error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
