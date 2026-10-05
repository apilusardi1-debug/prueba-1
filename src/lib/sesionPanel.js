// Token que firma usuarios-admin al entrar. Las funciones que mandan WhatsApp lo piden
// (send-whatsapp, ver _shared/sesionPanel.ts): sin él no envían nada.
export function cabeceraPanel() {
  try {
    const token = JSON.parse(localStorage.getItem('admin_session') || '{}').token
    return token ? { 'x-panel-token': token } : {}
  } catch {
    return {}
  }
}
