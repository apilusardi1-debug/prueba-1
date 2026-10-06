import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { firmarSesion, renovarSesion, verificarSesion } from '../_shared/sesionPanel.ts'

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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-panel-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Nunca se devuelve password_hash al cliente, ni siquiera en el listado
// de Accesos.
const CAMPOS_PUBLICOS = 'id, nombre, email, rol, activo, created_at'
const ROLES = ['superadmin', 'admin', 'operativo', 'ventas', 'lectura', 'logistica', 'chofer']
// Lo que un admin (no superadmin) puede dar o quitar: nunca admins ni superadmins.
const ROLES_QUE_ADMINISTRA_UN_ADMIN = ['operativo', 'ventas', 'lectura', 'logistica', 'chofer']
const TIPOS_CON_SECCIONES = ['operativo', 'ventas', 'lectura', 'logistica', 'chofer']
const CLAVES_PLANTILLA = ['operacion_guia', 'operacion_chofer']

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

// Usuario activo de la sesión del panel, con su id y su rol actual (lo lee de la base, no del token).
async function usuarioDeLaSesion(token: string | null): Promise<{ id: string; email: string; rol: string } | null> {
  const email = await verificarSesion(Deno.env.get('PANEL_SESSION_SECRET'), token)
  if (!email) return null
  const { data } = await supabase.from('usuarios_admin').select('id, rol, activo').eq('email', email).maybeSingle()
  return data?.activo ? { id: data.id, email, rol: data.rol } : null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { action, ...body } = await req.json()
    const token = req.headers.get('x-panel-token')

    if (action === 'login') {
      const email = String(body.email || '').trim().toLowerCase()
      const { data } = await supabase.from('usuarios_admin').select('*').eq('email', email).maybeSingle()
      if (data && data.activo && data.password_hash === body.password_hash) {
        const sesionToken = await firmarSesion(Deno.env.get('PANEL_SESSION_SECRET') ?? '', data.email, data.rol)
        return json({ ok: true, usuario: { email: data.email, nombre: data.nombre, rol: data.rol, token: sesionToken } })
      }
      return json({ ok: false })
    }

    // El navegador lo llama solo mientras el panel está abierto: si el usuario sigue activo,
    // le devuelve un token nuevo. Si lo dieron de baja o pasaron 7 días, responde 401.
    if (action === 'renovar') {
      const renovada = await renovarSesion(Deno.env.get('PANEL_SESSION_SECRET'), token)
      if (!renovada) return json({ ok: false }, 401)
      const { data } = await supabase.from('usuarios_admin').select('activo').eq('email', renovada.email).maybeSingle()
      if (!data?.activo) return json({ ok: false }, 401)
      return json({ ok: true, token: renovada.token })
    }

    const sesion = await usuarioDeLaSesion(token)
    if (!sesion) return json({ ok: false, error: 'Sesión del panel no válida. Volvé a entrar.' }, 401)

    if (action === 'list') {
      const { data, error } = await supabase.from('usuarios_admin').select(CAMPOS_PUBLICOS).order('nombre')
      return json({ ok: !error, usuarios: data || [], error: error?.message })
    }

    // Qué secciones ve cada tipo. Lo puede leer cualquier usuario activo (para armar el menú).
    if (action === 'permisos') {
      const { data, error } = await supabase.from('permisos_tipos').select('tipo, secciones')
      return json({ ok: !error, permisos: data || [], error: error?.message })
    }

    // Textos de los avisos internos de operación. Los lee cualquiera con sesión (Agenda los usa al cerrar).
    if (action === 'plantillas') {
      const { data, error } = await supabase.from('mensajes_plantillas').select('clave, texto, actualizado_at, actualizado_por')
      return json({ ok: !error, plantillas: data || [], error: error?.message })
    }

    if (action === 'plantilla_guardar') {
      if (sesion.rol !== 'admin' && sesion.rol !== 'superadmin') {
        return json({ ok: false, error: 'Solo admin o superadmin pueden editar los mensajes.' }, 403)
      }
      const clave = String(body.clave || '')
      if (!CLAVES_PLANTILLA.includes(clave)) return json({ ok: false, error: 'Mensaje inválido' }, 400)
      const texto = String(body.texto || '').trim()
      if (!texto || texto.length > 4000) return json({ ok: false, error: 'El mensaje tiene que tener texto (máximo 4000 caracteres).' }, 400)
      const { error } = await supabase.from('mensajes_plantillas')
        .upsert({ clave, texto, actualizado_at: new Date().toISOString(), actualizado_por: sesion.email }, { onConflict: 'clave' })
      return json({ ok: !error, error: error?.message })
    }

    if (action === 'permisos_guardar') {
      if (sesion.rol !== 'superadmin') return json({ ok: false, error: 'Solo un superadmin puede cambiar los permisos.' }, 403)
      const tipo = String(body.tipo || '')
      if (!TIPOS_CON_SECCIONES.includes(tipo)) return json({ ok: false, error: 'Tipo inválido' }, 400)
      const secciones = Array.isArray(body.secciones) ? body.secciones.map(String) : []
      const { error } = await supabase.from('permisos_tipos').update({ secciones }).eq('tipo', tipo)
      return json({ ok: !error, error: error?.message })
    }

    // Logística solo puede dar de alta cuentas de choferes; no edita ni borra nada.
    if (sesion.rol === 'logistica') {
      if (action === 'create' && body.rol === 'chofer') {
        const { nombre, email, password_hash, activo } = body
        const { data, error } = await supabase.from('usuarios_admin')
          .insert({ nombre, email: String(email || '').trim().toLowerCase(), password_hash, rol: 'chofer', activo: activo ?? true })
          .select(CAMPOS_PUBLICOS).single()
        return json({ ok: !error, usuario: data, error: error?.message })
      }
      return json({ ok: false, error: 'Logística solo puede crear cuentas de choferes.' }, 403)
    }

    // Desde acá, crear, editar y borrar usuarios: solo admin o superadmin.
    if (sesion.rol !== 'admin' && sesion.rol !== 'superadmin') {
      return json({ ok: false, error: 'Solo un admin puede cambiar los usuarios.' }, 403)
    }
    const esSuperadmin = sesion.rol === 'superadmin'

    if (action === 'create') {
      const { nombre, email, password_hash, rol, activo } = body
      if (!ROLES.includes(rol)) return json({ ok: false, error: 'Rol inválido' }, 400)
      if (!esSuperadmin && !ROLES_QUE_ADMINISTRA_UN_ADMIN.includes(rol)) {
        return json({ ok: false, error: 'Solo un superadmin puede crear admins.' }, 403)
      }
      const { data, error } = await supabase.from('usuarios_admin')
        .insert({ nombre, email: String(email || '').trim().toLowerCase(), password_hash, rol, activo: activo ?? true })
        .select(CAMPOS_PUBLICOS).single()
      return json({ ok: !error, usuario: data, error: error?.message })
    }

    if (action === 'update') {
      const { id, data: cambios = {} } = body
      const { data: objetivo } = await supabase.from('usuarios_admin').select('id, rol').eq('id', id).maybeSingle()
      if (!objetivo) return json({ ok: false, error: 'Usuario no encontrado' }, 404)
      if (!esSuperadmin) {
        if (objetivo.id === sesion.id) return json({ ok: false, error: 'No podés cambiar tu propio acceso.' }, 403)
        if (!ROLES_QUE_ADMINISTRA_UN_ADMIN.includes(objetivo.rol)) {
          return json({ ok: false, error: 'Solo un superadmin puede cambiar a un admin.' }, 403)
        }
        if (cambios.rol !== undefined && !ROLES_QUE_ADMINISTRA_UN_ADMIN.includes(cambios.rol)) {
          return json({ ok: false, error: 'Solo un superadmin puede dar el rol de admin.' }, 403)
        }
      }
      if (cambios.rol !== undefined && !ROLES.includes(cambios.rol)) return json({ ok: false, error: 'Rol inválido' }, 400)
      const { data, error } = await supabase.from('usuarios_admin').update(cambios).eq('id', id).select(CAMPOS_PUBLICOS).single()
      return json({ ok: !error, usuario: data, error: error?.message })
    }

    if (action === 'delete') {
      const { id } = body
      if (id === sesion.id) return json({ ok: false, error: 'No podés dar de baja tu propio usuario.' }, 403)
      const { data: objetivo } = await supabase.from('usuarios_admin').select('rol').eq('id', id).maybeSingle()
      if (!esSuperadmin && objetivo && !ROLES_QUE_ADMINISTRA_UN_ADMIN.includes(objetivo.rol)) {
        return json({ ok: false, error: 'Solo un superadmin puede borrar a un admin.' }, 403)
      }
      const { error } = await supabase.from('usuarios_admin').delete().eq('id', id)
      return json({ ok: !error, error: error?.message })
    }

    return json({ ok: false, error: 'Acción inválida' }, 400)
  } catch (err) {
    return json({ ok: false, error: err.message }, 500)
  }
})
