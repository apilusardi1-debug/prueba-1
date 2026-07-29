import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Único punto de acceso a la tabla usuarios_admin. La tabla tiene RLS
// activado sin políticas (bloqueada para anon/authenticated) — solo esta
// función, usando la service_role key, puede leerla o escribirla. El
// panel (Login.jsx, Configuración → Accesos) ya no consulta la tabla
// directo desde el navegador.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Nunca se devuelve password_hash al cliente, ni siquiera en el listado
// de Accesos.
const CAMPOS_PUBLICOS = 'id, nombre, email, rol, activo, created_at'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { action, ...body } = await req.json()

    if (action === 'login') {
      const email = String(body.email || '').trim().toLowerCase()
      const { data } = await supabase.from('usuarios_admin').select('*').eq('email', email).maybeSingle()
      if (data && data.activo && data.password_hash === body.password_hash) {
        return json({ ok: true, usuario: { email: data.email, nombre: data.nombre, rol: data.rol } })
      }
      return json({ ok: false })
    }

    if (action === 'list') {
      const { data, error } = await supabase.from('usuarios_admin').select(CAMPOS_PUBLICOS).order('nombre')
      return json({ ok: !error, usuarios: data || [], error: error?.message })
    }

    if (action === 'create') {
      const { nombre, email, password_hash, rol, activo } = body
      const { data, error } = await supabase.from('usuarios_admin')
        .insert({ nombre, email: String(email || '').trim().toLowerCase(), password_hash, rol, activo: activo ?? true })
        .select(CAMPOS_PUBLICOS).single()
      return json({ ok: !error, usuario: data, error: error?.message })
    }

    if (action === 'update') {
      const { id, data: cambios } = body
      const { data, error } = await supabase.from('usuarios_admin').update(cambios).eq('id', id).select(CAMPOS_PUBLICOS).single()
      return json({ ok: !error, usuario: data, error: error?.message })
    }

    if (action === 'delete') {
      const { id } = body
      const { error } = await supabase.from('usuarios_admin').delete().eq('id', id)
      return json({ ok: !error, error: error?.message })
    }

    return json({ ok: false, error: 'Acción inválida' }, 400)
  } catch (err) {
    return json({ ok: false, error: err.message }, 500)
  }
})
