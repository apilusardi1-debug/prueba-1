// Meta firma cada aviso que manda al webhook con el App Secret (cabecera X-Hub-Signature-256,
// HMAC-SHA256 del cuerpo crudo). Sin esta comprobación cualquiera que conozca la URL puede
// mandar mensajes falsos, y el asistente les responde por Meta.

const enc = new TextEncoder()

function hexABytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-f]{64}$/i.test(hex)) return null
  return Uint8Array.from(hex.match(/../g)!.map((h) => parseInt(h, 16)))
}

export async function firmaMetaValida(secreto: string | undefined, cuerpoCrudo: string, cabecera: string | null): Promise<boolean> {
  if (!secreto || !cabecera?.startsWith('sha256=')) return false
  const firma = hexABytes(cabecera.slice('sha256='.length))
  if (!firma) return false
  const clave = await crypto.subtle.importKey('raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  return crypto.subtle.verify('HMAC', clave, firma, enc.encode(cuerpoCrudo))
}
