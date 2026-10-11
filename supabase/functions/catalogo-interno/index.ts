import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verificarSesion } from '../_shared/sesionPanel.ts'

// Punto de acceso único para un grupo de tablas que hasta ahora se leían y escribían directo
// desde el navegador con la clave pública, sin pasar por ninguna sesión (plan de endurecer RLS
// tabla por tabla, ver CLAUDE.md). Algunas (`hospedajes`, `agencia_videos`, `site_config`,
// `excursiones`) tienen además una lectura pública por RLS aparte, sin pasar por acá — la web
// las necesita sin sesión. `reservas` tiene además un INSERT público por RLS (el formulario de
// reserva del sitio), también aparte de esta función.
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
  onConflict?: string // default: pk — para 'upsert' en una columna distinta a la clave (ej. whatsapp)
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
  // Lectura pública aparte (RLS): la usan las páginas de hoteles del sitio.
  hospedajes: { pk: 'id', orderBy: 'nombre' },
  hospedaje_habitaciones: { pk: 'id', orderBy: 'nombre' },
  // Sin lectura pública — a propósito, tiene el contacto del dueño (ver el
  // comentario de propietariosApi en src/lib/supabase.js).
  hospedajes_propietarios: { pk: 'id', orderBy: 'id' },
  anfitriona_hospedajes: { pk: 'id', orderBy: 'created_at' },
  anfitriona_saldos: { pk: 'id', orderBy: 'created_at' },
  // Lectura pública aparte (RLS): la usa el catálogo del sitio. El UPDATE de
  // cupos_disponibles que dispara una reserva pública no pasa por acá, es la función
  // ajustar_cupos_excursion (ver migración del trío excursiones/reservas/clientes).
  excursiones: { pk: 'id', orderBy: 'nombre' },
  // INSERT público aparte (RLS, solo insertar): lo usa el formulario de reserva del sitio.
  // Leer/editar/borrar una reserva sigue siendo solo admin, acá.
  reservas: { pk: 'id', orderBy: 'fecha', select: '*, excursiones(nombre, categoria, cupos), choferes(id, nombre, whatsapp), guias(id, nombre, whatsapp)' },
  clientes: { pk: 'id', orderBy: 'nombre', onConflict: 'whatsapp' },
  // Solo lectura desde el frontend (lo escribe el trigger de la base, ver
  // migración 20261011100000) -- comprobante de "se mandó el PDF de cierre",
  // se muestra como tarjeta fantasma 24hs en el tablero de Paquetes.
  leads_pdf_cierre_registro: { pk: 'id', orderBy: '-creado_at' },
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
    const { tabla, accion, id, data, filtros, o } = await req.json()
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
      // Cada filtro es "campo: valor" (igual a) o "campo: {op, valor}" para otra comparación
      // (ej. { fecha: { op: 'gte', valor: hoy } }) — alcanza con eq/neq/gt/gte/lt/lte, lo único
      // que necesitó algún llamador hasta ahora.
      if (filtros) for (const [campo, cond] of Object.entries(filtros)) {
        if (cond && typeof cond === 'object' && 'op' in (cond as Record<string, unknown>)) {
          const { op, valor } = cond as { op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'; valor: unknown }
          // deno-lint-ignore no-explicit-any
          consulta = (consulta as any)[op](campo, valor)
        } else {
          consulta = consulta.eq(campo, cond)
        }
      }
      // "o" es un string crudo de supabase-js .or(), ej. "cliente_id.eq.X,cliente_whatsapp.eq.Y"
      // (reservas de un cliente: por id o por el whatsapp de reservas viejas sin vincular).
      if (o) consulta = consulta.or(o)
      const { data: filas, error } = await consulta
      return json({ ok: !error, datos: filas || [], error: error?.message })
    }

    if (accion === 'create') {
      // Un array inserta varias filas de una (ej. las habitaciones de un hospedaje nuevo);
      // un objeto solo, como siempre, devuelve esa única fila.
      const consulta = supabase.from(tabla).insert(data).select(cfg.select || '*')
      const { data: fila, error } = Array.isArray(data) ? await consulta : await consulta.single()
      return json({ ok: !error, dato: fila, error: error?.message })
    }

    if (accion === 'upsert') {
      const { data: fila, error } = await supabase.from(tabla)
        .upsert(data, { onConflict: cfg.onConflict || cfg.pk }).select(cfg.select || '*').single()
      return json({ ok: !error, dato: fila, error: error?.message })
    }

    if (accion === 'update') {
      if (!id) return json({ ok: false, error: 'Falta id' }, 400)
      const { data: fila, error } = await supabase.from(tabla).update(data).eq(cfg.pk, id).select(cfg.select || '*').single()
      return json({ ok: !error, dato: fila, error: error?.message })
    }

    if (accion === 'delete') {
      // Por id (lo normal) o por filtros (ej. borrar todas las habitaciones de un hospedaje).
      if (id) {
        const { error } = await supabase.from(tabla).delete().eq(cfg.pk, id)
        return json({ ok: !error, error: error?.message })
      }
      if (filtros) {
        let consulta = supabase.from(tabla).delete()
        for (const [campo, valor] of Object.entries(filtros)) consulta = consulta.eq(campo, valor)
        const { error } = await consulta
        return json({ ok: !error, error: error?.message })
      }
      return json({ ok: false, error: 'Falta id o filtros' }, 400)
    }

    return json({ ok: false, error: 'Acción inválida' }, 400)
  } catch (err) {
    return json({ ok: false, error: err.message }, 500)
  }
})
