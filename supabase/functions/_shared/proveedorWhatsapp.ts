// Por dónde sale y entra el número del CRM: directo por Meta (Cloud API) o a través de
// 360dialog, el proveedor que mantiene la coexistencia con la app WhatsApp Business del
// celular. El interruptor es el secret D360_API_KEY: si está cargado, el número del CRM
// va por 360dialog; si se borra, vuelve a Meta directo sin tocar el código.
//
// 360dialog habla el mismo formato que Meta (mismo cuerpo al enviar, mismo "entry/changes/
// value" al recibir). Cambian tres cosas: la dirección, la credencial (cabecera
// D360-API-KEY, una clave por número) y cómo se comprueba que un aviso viene de ellos (no
// firman con nuestro App Secret: mandan la cabecera Authorization que se les configura al
// dar de alta el webhook).
//
// Secrets:
//   D360_API_KEY       clave del número en 360dialog
//   D360_BASE_URL      opcional; por defecto producción. Para el entorno de prueba:
//                      https://waba-sandbox.360dialog.io/v1
//   D360_WEBHOOK_AUTH  "usuario:clave" que 360dialog manda como Basic Auth en cada aviso

const D360_API_KEY = Deno.env.get('D360_API_KEY')
const D360_BASE_URL = (Deno.env.get('D360_BASE_URL') ?? 'https://waba-v2.360dialog.io').replace(/\/+$/, '')
const D360_WEBHOOK_AUTH = Deno.env.get('D360_WEBHOOK_AUTH')
const META_API_VERSION = 'v21.0'

export const usa360dialog = !!D360_API_KEY

// A dónde se le pega para mandar un mensaje del número del CRM, y con qué credencial
export function destinoMensajesCrm(metaToken: string | undefined, metaPhoneNumberId: string | undefined): { url: string; headers: Record<string, string> } {
  if (usa360dialog) {
    return { url: `${D360_BASE_URL}/messages`, headers: { 'D360-API-KEY': D360_API_KEY! } }
  }
  return {
    url: `https://graph.facebook.com/${META_API_VERSION}/${metaPhoneNumberId}/messages`,
    headers: { Authorization: `Bearer ${metaToken}` },
  }
}

// Baja un archivo que mandó el contacto. En el aviso llega solo un id: primero se pide la
// dirección temporal y después el archivo. Con 360dialog esa dirección apunta al servidor
// de Meta, pero hay que pedirla a través de ellos (mismo camino y parámetros, con su clave).
export async function descargarMediaCrm(mediaId: string, metaToken: string | undefined): Promise<{ bytes: Uint8Array; mime: string }> {
  const headers: Record<string, string> = usa360dialog ? { 'D360-API-KEY': D360_API_KEY! } : { Authorization: `Bearer ${metaToken}` }
  const base = usa360dialog ? D360_BASE_URL : `https://graph.facebook.com/${META_API_VERSION}`
  const infoRes = await fetch(`${base}/${mediaId}`, { headers })
  if (!infoRes.ok) throw new Error(`media info ${infoRes.status}`)
  const info = await infoRes.json()
  let urlArchivo = String(info.url || '')
  if (usa360dialog) {
    const u = new URL(urlArchivo)
    urlArchivo = `${new URL(D360_BASE_URL).origin}${u.pathname}${u.search}`
  }
  const fileRes = await fetch(urlArchivo, { headers })
  if (!fileRes.ok) throw new Error(`media download ${fileRes.status}`)
  const bytes = new Uint8Array(await fileRes.arrayBuffer())
  const mime = String(info.mime_type || fileRes.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim()
  return { bytes, mime }
}

// ¿El aviso trae la credencial que se le configuró a 360dialog para este webhook?
export function autorizacion360Valida(cabecera: string | null): boolean {
  if (!D360_WEBHOOK_AUTH || !cabecera) return false
  const esperada = `Basic ${btoa(D360_WEBHOOK_AUTH)}`
  if (cabecera.length !== esperada.length) return false
  let distinto = 0
  for (let i = 0; i < esperada.length; i++) distinto |= cabecera.charCodeAt(i) ^ esperada.charCodeAt(i)
  return distinto === 0
}
