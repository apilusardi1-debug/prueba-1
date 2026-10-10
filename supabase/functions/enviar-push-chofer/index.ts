import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Manda la notificación push a un chofer cuando se crea su aviso de operación (lo llama un
// trigger de la base, ver supabase/migrations/20261010120000_chofer_push.sql). Implementa el
// protocolo Web Push (VAPID + cifrado aes128gcm, RFC 8291/8292) a mano con Web Crypto nativo
// en vez de la librería npm "web-push": esa librería usa el módulo "https" de Node, que no
// corre tal cual en Deno/Edge Functions — esto evita ese riesgo por completo, sin depender de
// ningún paquete externo.
//
// IMPORTANTE: esta función se despliega con --no-verify-jwt (no exige sesión de nadie) porque
// la llama el trigger de la base, no una persona. Por eso NUNCA confía en el contenido del
// pedido para el texto del mensaje: vuelve a leer el aviso real de la base por su id antes de
// mandar nada, así que un pedido fabricado a mano como mucho hace reenviar un aviso que ya
// existe, nunca inventa un mensaje nuevo.

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = 'https://prueba-1-rose.vercel.app'

function b64urlABytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const base64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}
function bytesAB64url(bytes: Uint8Array): string {
  let raw = ''
  for (const b of bytes) raw += String.fromCharCode(b)
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function textoABytes(t: string): Uint8Array {
  return new TextEncoder().encode(t)
}
function concatBytes(...partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of partes) { out.set(p, offset); offset += p.length }
  return out
}

async function hmacSha256(clave: Uint8Array, datos: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', clave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const firma = await crypto.subtle.sign('HMAC', key, datos)
  return new Uint8Array(firma)
}

// HKDF-Expand de un solo paso: alcanza porque acá nunca se pide más de 32 bytes de salida.
async function hkdfExpand(prk: Uint8Array, info: Uint8Array, largo: number): Promise<Uint8Array> {
  const bloque = await hmacSha256(prk, concatBytes(info, new Uint8Array([1])))
  return bloque.slice(0, largo)
}

// Arma el JWT VAPID (ES256) que autoriza el envío ante el servicio de push del navegador.
async function firmarVapid(audiencia: string): Promise<string> {
  const dBytes = b64urlABytes(VAPID_PRIVATE_KEY)
  const pubBytes = b64urlABytes(VAPID_PUBLIC_KEY) // 65 bytes: 0x04 + X(32) + Y(32)
  const x = pubBytes.slice(1, 33)
  const y = pubBytes.slice(33, 65)
  const jwk = { kty: 'EC', crv: 'P-256', d: bytesAB64url(dBytes), x: bytesAB64url(x), y: bytesAB64url(y), ext: true }
  const clavePrivada = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])

  const header = bytesAB64url(textoABytes(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = bytesAB64url(textoABytes(JSON.stringify({
    aud: audiencia,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  })))
  const firmado = `${header}.${payload}`
  // Web Crypto firma ECDSA en formato "raw" (r||s, 64 bytes) — es exactamente lo que pide JWS ES256,
  // no hace falta convertir desde DER.
  const firma = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, clavePrivada, textoABytes(firmado))
  return `${firmado}.${bytesAB64url(new Uint8Array(firma))}`
}

// Cifra el mensaje para esta suscripción puntual (RFC 8291) y lo manda al servicio de push
// (FCM para Android/Chrome, el de Apple para iOS/Safari, etc. — la URL ya viene en la propia
// suscripción, acá no hay que elegir a mano a quién le toca cada uno).
async function mandarPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: Record<string, unknown>): Promise<Response> {
  const uaPublicBytes = b64urlABytes(sub.p256dh)
  const authSecret = b64urlABytes(sub.auth)

  const uaPublicKey = await crypto.subtle.importKey('raw', uaPublicBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const efimero = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const asPublicBytes = new Uint8Array(await crypto.subtle.exportKey('raw', efimero.publicKey))

  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaPublicKey }, efimero.privateKey, 256))

  const prkKey = await hmacSha256(authSecret, ecdhSecret)
  const keyInfo = concatBytes(textoABytes('WebPush: info\0'), uaPublicBytes, asPublicBytes)
  const ikm = await hkdfExpand(prkKey, keyInfo, 32)

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const prk = await hmacSha256(salt, ikm)
  const cek = await hkdfExpand(prk, textoABytes('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdfExpand(prk, textoABytes('Content-Encoding: nonce\0'), 12)

  const plano = concatBytes(textoABytes(JSON.stringify(payload)), new Uint8Array([2])) // 2 = único registro, sin relleno
  const claveAes = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt'])
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, claveAes, plano))

  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, cifrado.length, false)
  const cabecera = concatBytes(salt, rs, new Uint8Array([asPublicBytes.length]), asPublicBytes)
  const cuerpo = concatBytes(cabecera, cifrado)

  const audiencia = new URL(sub.endpoint).origin
  const jwt = await firmarVapid(audiencia)

  return fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
      'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
    },
    body: cuerpo,
  })
}

serve(async (req) => {
  try {
    const body = await req.json()
    const avisoId = body?.record?.id
    if (!avisoId) return new Response('ok', { status: 200 })

    // Se vuelve a leer el aviso real de la base (no se confía en el cuerpo del pedido, ver
    // comentario arriba) junto con los datos para armar el texto y el link.
    const { data: aviso } = await supabase
      .from('operaciones_avisos')
      .select('chofer_id, operaciones(fecha, excursiones(nombre))')
      .eq('id', avisoId)
      .maybeSingle()
    if (!aviso?.chofer_id) return new Response('ok', { status: 200 })

    const { data: chofer } = await supabase.from('choferes').select('token').eq('id', aviso.chofer_id).maybeSingle()
    if (!chofer?.token) return new Response('ok', { status: 200 })

    const { data: subs } = await supabase
      .from('chofer_push_subscripciones').select('id, endpoint, p256dh, auth').eq('chofer_id', aviso.chofer_id)
    if (!subs?.length) return new Response('ok', { status: 200 })

    // deno-lint-ignore no-explicit-any
    const excursionNombre = (aviso as any).operaciones?.excursiones?.nombre || 'uma operação'
    const payload = {
      titulo: 'Novo aviso de operação',
      cuerpo: excursionNombre,
      url: `/chofer/${chofer.token}`,
    }

    await Promise.all(subs.map(async (sub) => {
      try {
        const res = await mandarPush(sub, payload)
        // 404/410 = la suscripción ya no existe del lado del navegador (desinstaló, limpió datos, etc.)
        if (res.status === 404 || res.status === 410) {
          await supabase.from('chofer_push_subscripciones').delete().eq('id', sub.id)
        } else if (!res.ok) {
          console.error('enviar-push-chofer: push rechazado', res.status, await res.text())
        }
      } catch (err) {
        console.error('enviar-push-chofer: error mandando push', err)
      }
    }))

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('enviar-push-chofer error:', err)
    return new Response('ok', { status: 200 }) // nunca hace fallar al trigger que lo llamó
  }
})
