// Token que firma usuarios-admin al entrar y renueva mientras el panel está abierto. Las funciones
// que mandan WhatsApp lo piden (send-whatsapp, ver _shared/sesionPanel.ts): sin él no envían nada.
export function cabeceraPanel() {
  try {
    const token = JSON.parse(localStorage.getItem('admin_session') || '{}').token
    return token ? { 'x-panel-token': token } : {}
  } catch {
    return {}
  }
}

// Mira la fecha de vencimiento del token (sin verificar la firma, eso lo hace el servidor).
export function tokenPorVencer(margenMs = 5 * 60 * 1000) {
  try {
    const token = JSON.parse(localStorage.getItem('admin_session') || '{}').token
    const parte = token?.split('.')[0]
    if (!parte) return true
    const b64 = parte.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parte.length / 4) * 4, '=')
    const { exp } = JSON.parse(atob(b64))
    return exp - Date.now() < margenMs
  } catch {
    return true
  }
}
