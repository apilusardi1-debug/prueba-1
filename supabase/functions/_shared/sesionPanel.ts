// Sesión del panel: usuarios-admin la firma al entrar y send-whatsapp la verifica antes de
// mandar nada. Sin esto, cualquiera con la clave pública del proyecto podía mandar WhatsApp
// desde el número del CRM. Formato: <payload en base64url>.<firma HMAC-SHA256 en base64url>.

const DURACION_MS = 12 * 60 * 60 * 1000
const enc = new TextEncoder()

function a64url(bytes: Uint8Array): string {
  let texto = ''
  for (const b of bytes) texto += String.fromCharCode(b)
  return btoa(texto).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function desde64url(texto: string): Uint8Array {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(texto.length / 4) * 4, '=')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

async function claveHmac(secreto: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function firmarSesion(secreto: string, email: string, rol: string, ahora = Date.now()): Promise<string> {
  if (!secreto) throw new Error('Falta PANEL_SESSION_SECRET en los secrets de Supabase')
  const payload = a64url(enc.encode(JSON.stringify({ email, rol, exp: ahora + DURACION_MS })))
  const firma = await crypto.subtle.sign('HMAC', await claveHmac(secreto), enc.encode(payload))
  return `${payload}.${a64url(new Uint8Array(firma))}`
}

// Devuelve el email de la sesión si la firma es válida y no venció; si no, null.
export async function verificarSesion(secreto: string | undefined, token: string | null, ahora = Date.now()): Promise<string | null> {
  if (!secreto || !token) return null
  const [payload, firma] = token.split('.')
  if (!payload || !firma) return null
  const valida = await crypto.subtle.verify('HMAC', await claveHmac(secreto), desde64url(firma), enc.encode(payload))
  if (!valida) return null
  try {
    const datos = JSON.parse(new TextDecoder().decode(desde64url(payload)))
    if (typeof datos.email !== 'string' || typeof datos.exp !== 'number' || datos.exp < ahora) return null
    return datos.email
  } catch {
    return null
  }
}
