// Posteos y reels de Instagram en "Viví nuestros viajes" (Home), cargados a mano
// pegando el link en Admin > Videos. Se guardan en la misma tabla que los videos
// propios (agencia_videos.video_url): un link de instagram.com es un posteo, lo
// demás es un video subido. Instagram deja mostrar un posteo público en cualquier
// web con su página /embed/, sin conectar la cuenta.

// Acepta los links tal como los copia Instagram, con o sin el usuario adelante:
// instagram.com/p/CODIGO/, instagram.com/reel/CODIGO/?igsh=..., instagram.com/usuario/reel/CODIGO/
const LINK = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:[\w.]+\/)?(p|reels?|tv)\/([\w-]+)/i

export function leerLinkInstagram(url) {
  const m = LINK.exec(String(url ?? '').trim())
  if (!m) return null
  const tipo = m[1].toLowerCase() === 'p' ? 'p' : m[1].toLowerCase() === 'tv' ? 'tv' : 'reel'
  return { tipo, codigo: m[2] }
}

export const esLinkInstagram = (url) => !!leerLinkInstagram(url)

// El link "limpio" que se guarda (sin parámetros de rastreo como ?igsh=)
export function normalizarLinkInstagram(url) {
  const l = leerLinkInstagram(url)
  return l ? `https://www.instagram.com/${l.tipo}/${l.codigo}/` : null
}

export function urlEmbedInstagram(url) {
  const l = leerLinkInstagram(url)
  return l ? `https://www.instagram.com/${l.tipo}/${l.codigo}/embed/` : null
}
