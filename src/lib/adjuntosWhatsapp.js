// Reglas de los archivos que se mandan por WhatsApp (chat del CRM y respuestas
// rápidas con adjunto): tipo según Meta, tamaño máximo y formato de tamaño.
export const LIMITE_ADJUNTO_MB = { image: 5, video: 16, audio: 16, document: 50 }
export const NOMBRE_TIPO_ADJUNTO = { image: 'imágenes', video: 'videos', audio: 'audios', document: 'documentos' }
export const AUDIOS_WHATSAPP = ['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg']

export function tipoAdjunto(file) {
  if (file.type === 'image/jpeg' || file.type === 'image/png') return 'image'
  if (file.type === 'video/mp4' || file.type === 'video/3gpp') return 'video'
  // Empieza con "audio/" cubre también "audio/ogg; codecs=opus" (notas de voz
  // grabadas en el chat, ver iniciarGrabacion en WhatsApp.jsx) — AUDIOS_WHATSAPP
  // sigue sirviendo para los mimes exactos que llegan de un archivo elegido a mano.
  if (AUDIOS_WHATSAPP.includes(file.type) || file.type.startsWith('audio/')) return 'audio'
  return 'document'
}

export function formatoTamano(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}
