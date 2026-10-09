import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verificarSesion } from '../_shared/sesionPanel.ts'

// Punto de acceso único para un grupo de catálogos internos chicos que hasta ahora se leían y
// escribían directo desde el navegador con la clave pública, sin pasar por ninguna sesión
// (plan de endurecer RLS tabla por tabla, ver CLAUDE.md — este es el primer grupo, el de menor
// riesgo: ninguna tiene datos de clientes ni de plata, y ninguna la usa la web pública).
//
// Por ahora el único control es "hay una sesión del panel vigente y el usuario sigue activo" —
// igual que ya podía hacer cualquiera logueado, no se le saca permiso a nadie que lo tuviera.
// Restringir por rol tabla por tabla queda para después, cuando se confirme quién tiene que poder
// editar cada una.
//
// Para sumar una tabla nueva a este mismo mecanismo alcanza con agregarla a TABLAS.
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

interface TablaCfg {
  pk: string
  // Un campo antepuesto con "-" ordena descendente (ej. "-created_at"), igual que la
  // convención habitual de APIs REST.
  orderBy: string | string[]
  select?: string // default '*' — para joins, como traslados trayendo el nombre del chofer
}

const TABLAS: Record<string, TablaCfg> = {
  conceptos_movimiento: { pk: 'id', orderBy: 'nombre' },
  embudo_etapas: { pk: 'clave', orderBy: 'orden' },
  embudo_automatizaciones: { pk: 'id', orderBy: 'created_at' },
  respuestas_rapidas: { pk: 'id', orderBy: 'titulo' },
  costos_excursion: { pk: 'id', orderBy: 'concepto' },
  // Lectura pública (policy de RLS aparte, sin pasar por acá): esta función solo
  // se usa para sus escrituras, que siguen siendo admin.
  agencia_videos: { pk: 'id', orderBy: 'orden' },
  site_config: { pk: 'id', orderBy: 'id' },
  traslados: { pk: 'id', orderBy: ['fecha', 'hora'], select: '*, choferes(nombre)' },
  propuestas: { pk: 'id', orderBy: '-created_at' },
}

async function emailDeLaSesion(token: string | null): Promise<string | null> {
  const email = await verificarSesion(Deno.env.get('PANEL_SESSION_SECRET'), token)
  if (!email) return null
  const { data } = await supabase.from('usuarios_admin').select('activo').eq('email', email).maybeSingle()
  return data?.activo ? email : null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { tabla, accion, id, data, filtros } = await req.json()
    const cfg = TABLAS[tabla]
    if (!cfg) return json({ ok: false, error: 'Tabla no habilitada en catalogo-interno' }, 400)

    const email = await emailDeLaSesion(req.headers.get('x-panel-token'))
    if (!email) return json({ ok: false, error: 'Sesión del panel no válida. Volvé a entrar.' }, 401)

    const ordenes = Array.isArray(cfg.orderBy) ? cfg.orderBy : [cfg.orderBy]

    if (accion === 'list') {
      let consulta = supabase.from(tabla).select(cfg.select || '*')
      for (const campo of ordenes) {
        const desc = campo.startsWith('-')
        consulta = consulta.order(desc ? campo.slice(1) : campo, { ascending: !desc })
      }
      if (filtros) for (const [campo, valor] of Object.entries(filtros)) consulta = consulta.eq(campo, valor)
      const { data: filas, error } = await consulta
      return json({ ok: !error, datos: filas || [], error: error?.message })
    }

    if (accion === 'create') {
      const { data: fila, error } = await supabase.from(tabla).insert(data).select(cfg.select || '*').single()
      return json({ ok: !error, dato: fila, error: error?.message })
    }

    if (accion === 'update') {
      if (!id) return json({ ok: false, error: 'Falta id' }, 400)
      const { data: fila, error } = await supabase.from(tabla).update(data).eq(cfg.pk, id).select(cfg.select || '*').single()
      return json({ ok: !error, dato: fila, error: error?.message })
    }

    if (accion === 'delete') {
      if (!id) return json({ ok: false, error: 'Falta id' }, 400)
      const { error } = await supabase.from(tabla).delete().eq(cfg.pk, id)
      return json({ ok: !error, error: error?.message })
    }

    return json({ ok: false, error: 'Acción inválida' }, 400)
  } catch (err) {
    return json({ ok: false, error: err.message }, 500)
  }
})
