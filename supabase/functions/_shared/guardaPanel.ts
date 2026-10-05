import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verificarSesion } from './sesionPanel.ts'

// Solo quien tiene una sesión del panel vigente (y su usuario sigue activo) puede usar estas funciones.
export async function sesionPanelValida(req: Request): Promise<boolean> {
  const email = await verificarSesion(Deno.env.get('PANEL_SESSION_SECRET'), req.headers.get('x-panel-token'))
  if (!email) return false
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data } = await supabase.from('usuarios_admin').select('activo').eq('email', email).maybeSingle()
  return !!data?.activo
}
