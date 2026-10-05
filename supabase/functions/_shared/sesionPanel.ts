// Sesión del panel: usuarios-admin la firma al entrar y la renueva mientras el panel está abierto;
// send-whatsapp la verifica antes de mandar nada. Formato: <payload en base64url>.<firma HMAC-SHA256 en base64url>.
// Cada token vale una hora. Mientras el panel esté abierto el navegador lo renueva solo; la sesión
// en sí dura como mucho 7 días desde que se entró, después hay que volver a entrar.

const DURACION_TOKEN_MS = 60 * 60 * 1000
const DURACION_SESION_MS = 7 * 24 * 60 * 60 * 1000
const enc = new TextEncoder()

type Datos = { email: string; rol: string; inicio: number; exp: number }

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

// Lee el token y comprueba la firma, sin mirar si venció.
async function leerFirmado(secreto: string | undefined, token: string | null): Promise<Datos | null> {
  if (!secreto || !token) return null
  const [payload, firma] = token.split('.')
  if (!payload || !firma) return null
  const valida = await crypto.subtle.verify('HMAC', await claveHmac(secreto), desde64url(firma), enc.encode(payload))
  if (!valida) return null
  try {
    const d = JSON.parse(new TextDecoder().decode(desde64url(payload)))
    if (typeof d.email !== 'string' || typeof d.exp !== 'number' || typeof d.inicio !== 'number') return null
    return { email: d.email, rol: String(d.rol ?? ''), inicio: d.inicio, exp: d.exp }
  } catch {
    return null
  }
}

export async function firmarSesion(secreto: string, email: string, rol: string, ahora = Date.now(), inicio = ahora): Promise<string> {
  if (!secreto) throw new Error('Falta PANEL_SESSION_SECRET en los secrets de Supabase')
  const payload = a64url(enc.encode(JSON.stringify({ email, rol, inicio, exp: ahora + DURACION_TOKEN_MS })))
  const firma = await crypto.subtle.sign('HMAC', await claveHmac(secreto), enc.encode(payload))
  return `${payload}.${a64url(new Uint8Array(firma))}`
}

// Devuelve el email si el token es válido y no venció; si no, null.
export async function verificarSesion(secreto: string | undefined, token: string | null, ahora = Date.now()): Promise<string | null> {
  const d = await leerFirmado(secreto, token)
  return d && d.exp >= ahora ? d.email : null
}

// Emite un token nuevo aunque el anterior ya haya vencido, siempre que la firma sea válida y la
// sesión no tenga más de 7 días desde que se entró. Quien llama tiene que comprobar que el usuario sigue activo.
export async function renovarSesion(secreto: string | undefined, token: string | null, ahora = Date.now()): Promise<{ token: string; email: string; rol: string } | null> {
  const d = await leerFirmado(secreto, token)
  if (!d || ahora - d.inicio > DURACION_SESION_MS) return null
  return { token: await firmarSesion(secreto!, d.email, d.rol, ahora, d.inicio), email: d.email, rol: d.rol }
}
