import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Descarga una imagen server-side y la devuelve como data URI (base64).
// Necesario para el PDF de propuestas: html2canvas no puede leer los
// pixeles de imagenes de otros dominios sin headers CORS permisivos (ej:
// el CDN de Niara), aunque la imagen cargue bien visualmente en el
// navegador. Al descargarla acá (server-to-server, sin restriccion de
// CORS) y devolverla como data URI, el <img> deja de depender del
// dominio original y html2canvas la puede "fotografiar" sin problema.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { url } = await req.json()
    if (!url) {
      return new Response(JSON.stringify({ error: 'Falta la url.' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch(url)
    if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status})`)

    const mimeType = res.headers.get('content-type') || 'image/jpeg'
    const bytes = new Uint8Array(await res.arrayBuffer())
    const dataUri = `data:${mimeType};base64,${uint8ToBase64(bytes)}`

    return new Response(JSON.stringify({ dataUri }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('proxy-imagen error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Error al descargar la imagen.' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
