import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verificarSesion } from '../_shared/sesionPanel.ts'

// Historial de quién asignó cada chat del CRM a quién y cuándo. Solo lo lee un superadmin: la tabla
// asignaciones_historial no tiene acceso desde el navegador (RLS sin políticas), solo pasa por acá.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-panel-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const email = await verificarSesion(Deno.env.get('PANEL_SESSION_SECRET'), req.headers.get('x-panel-token'))
    if (!email) return json({ ok: false, error: 'Sesión del panel no válida. Volvé a entrar.' }, 401)

    // El rol se lee de la base (no del token): un cambio de rol vale al instante
    const { data: yo } = await supabase.from('usuarios_admin').select('rol, activo').eq('email', email).maybeSingle()
    if (!yo?.activo || yo.rol !== 'superadmin') return json({ ok: false, error: 'Solo el superadmin puede ver este historial.' }, 403)

    const { desde, hasta, limite } = await req.json().catch(() => ({}))
    let consulta = supabase.from('asignaciones_historial').select('*').order('created_at', { ascending: false })
    if (desde) consulta = consulta.gte('created_at', desde)
    if (hasta) consulta = consulta.lte('created_at', hasta)
    consulta = consulta.limit(Math.min(Number(limite) || 2000, 5000))
    const { data: filas, error } = await consulta
    if (error) return json({ ok: false, error: error.message }, 500)

    const { data: usuarios } = await supabase.from('usuarios_admin').select('id, nombre, email')
    return json({ ok: true, filas: filas || [], usuarios: usuarios || [] })
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500)
  }
})
