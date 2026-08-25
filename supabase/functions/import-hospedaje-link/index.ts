import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Trae los datos de una cotizacion de Niara (hoteles, fotos, amenities,
// fechas, precio) a partir del link que se comparte con el cliente, para
// autocompletar el Generador de propuesta sin cargar todo a mano.
//
// Investigado en vivo (no documentado por Niara): la pagina de la cotizacion
// es una SPA que internamente llama a estas 3 APIs propias, todas JSON
// planas -- no hace falta un navegador headless para leerlas.
//   1. POST niara-auth.niara.tech/prod/generateAccessToken  { tenantId }
//      -> token de acceso anonimo, publico, sin login (role: "unauthenticated"),
//      valido ~4hs, scopeado a quien sea que abra el link compartido.
//   2. GET  innerapi-rock.niara.tech/booking/quotationTokens/{token}/quotation
//      -> items de la cotizacion (hotel_id, fechas, precio, meal, etc).
//   3. GET  dvzf45pftescl.cloudfront.net/hotels/{hotel_id}
//      -> ficha completa del hotel (nombre, rating, categoria, direccion,
//      hasta ~35 fotos, descripcion, amenities). No pidio auth en las pruebas.
//      Tambien trae guestRooms: la lista completa de tipos de habitacion
//      del hotel (Estandar, Superior, Familia Superior, Super Lujo Frente
//      al Mar, etc.), cada uno con su propia superficie/capacidad/camas/
//      vista/fotos/amenities -- independiente de la fecha cotizada.
//
// TENANT_ID es el id de cuenta de DreamsTour en Niara -- no es secreto (ya
// viaja en cada request del propio sitio de Niara al navegador del cliente),
// pero se aisla igual como constante por si cambia de cuenta en el futuro.
const TENANT_ID = 'us-east-1:86bf154a-7d6b-4a83-8436-2e60cf5edcb8'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function extraerToken(url: string): string | null {
  try {
    const partes = new URL(url).pathname.split('/').filter(Boolean)
    return partes.pop() || null
  } catch {
    return null
  }
}

async function generarAccessToken(): Promise<string> {
  const res = await fetch('https://niara-auth.niara.tech/prod/generateAccessToken', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tenantId: TENANT_ID }),
  })
  if (!res.ok) throw new Error(`No se pudo generar el token de Niara (${res.status})`)
  const data = await res.json()
  if (!data.access_token) throw new Error('Niara no devolvió access_token')
  return data.access_token
}

async function traerCotizacion(token: string, accessToken: string) {
  const res = await fetch(`https://innerapi-rock.niara.tech/booking/quotationTokens/${token}/quotation`, {
    headers: { authorization: accessToken, accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Link de cotización inválido o vencido (${res.status})`)
  return res.json()
}

async function traerHotel(hotelId: string) {
  // locale=es-MX (en vez de pt-BR): la propia API de Niara devuelve nombre,
  // descripcion, amenities y habitaciones ya en español -- evita depender
  // de la traduccion no oficial de Google Translate del lado del cliente.
  const res = await fetch(`https://dvzf45pftescl.cloudfront.net/hotels/${hotelId}?locale=es-MX&tenantId=${encodeURIComponent(TENANT_ID)}`, {
    headers: { accept: 'application/json' },
  })
  if (!res.ok) return null
  return res.json()
}

function elegirFotoPrincipal(imagenes: string[], fallback: string | null): string {
  // Algunas propiedades tienen como primera "foto" un banner promocional
  // (.png con precios/ofertas superpuestas) en vez de una foto real -- se
  // prefiere la primera .jpg/.jpeg de la lista.
  const jpg = (imagenes || []).find((u) => /\.(jpe?g)(\?|$)/i.test(u))
  return jpg || imagenes?.[0] || fallback || ''
}

// La ficha del hotel (traerHotel) ya trae guestRooms: la lista completa de
// tipos de habitación que ofrece (Estándar, Superior, Familia Superior,
// Super Lujo Frente al Mar, etc.), cada uno con su propia superficie,
// capacidad, camas, vista, fotos y amenities -- independiente de la fecha
// cotizada. Antes se descartaba y solo quedaba un precio/foto genérico por
// hotel.
function mapearHabitaciones(det: any): any[] {
  const rooms = det?.guestRooms || []
  return rooms.map((r: any) => {
    const medias = r.medias || []
    const imagenes: string[] = medias.flatMap((m: any) => (m.images || []).map((im: any) => im.url))
    const descripcion = medias
      .flatMap((m: any) => (m.texts || []).map((t: any) => t.Description))
      .filter(Boolean)
      .join(' ')
    const amenities: string[] = (r.amenities || []).map((a: any) => a.description).filter(Boolean)
    const camas = (r.bedTypes || []).map((b: any) => b.name).filter(Boolean).join(', ')
    const vista = (r.views || []).map((v: any) => v.name).filter(Boolean).join(', ')

    return {
      nombre: r.description || '',
      superficie: r.size || null,
      capacidad: r.maxOccupancy || 0,
      cantidad: r.quantity || 0,
      camas,
      vista,
      descripcion,
      imagen: imagenes[0] || '',
      galeria: imagenes.slice(1),
      amenities,
    }
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { url } = await req.json()
    const token = url ? extraerToken(url) : null
    if (!token) {
      return new Response(JSON.stringify({ error: 'No se encontró un token de cotización válido en ese link.' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const accessToken = await generarAccessToken()
    const { quotation } = await traerCotizacion(token, accessToken)
    const items = (quotation?.items || []).filter((it: any) => it.type === 'roomRate')

    if (items.length === 0) {
      return new Response(JSON.stringify({ error: 'La cotización no tiene hospedajes.' }), {
        status: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Un mismo hotel puede aparecer más de una vez (distintas fechas/tarifas)
    // -- se pide el detalle una sola vez por hotel_id.
    const hotelIds = [...new Set(items.map((it: any) => it.hotel_id))]
    const detalles = new Map<string, any>()
    await Promise.all(hotelIds.map(async (id) => {
      const d = await traerHotel(id as string)
      if (d) detalles.set(id as string, d)
    }))

    const hospedajes = items.map((it: any) => {
      const det = detalles.get(it.hotel_id)
      const imagenes: string[] = det?.images || []
      const amenities: string[] = (det?.amenities || []).map((a: any) => a.description).filter(Boolean)
      const tipo = det?.categoryName || null
      const ubicacion = det?.address?.cityName || it.hotel_cityName || null
      const estado = det?.address?.state || null
      const meal = it.meal_breakfast ? it.meal_name : null

      return {
        hotel_id: it.hotel_id,
        nombre: det?.name || it.hotel_name,
        tipo,
        destino: [ubicacion, estado].filter(Boolean).join(', '),
        direccion: det?.address?.street || it.hotel_address || '',
        estrellas: det?.rating || it.hotel_award || 0,
        descripcion: det?.texts?.[0]?.text || '',
        amenities,
        imagen: elegirFotoPrincipal(imagenes, it.hotel_extra_thumbnail),
        imagenes,
        habitaciones: mapearHabitaciones(det),
        noches: it.time_duration || null,
        precio: it.priceComposition_total_value ?? null,
        moneda: it.priceComposition_total_currency || 'BRL',
        pension: meal ? `${meal} incluido` : '',
      }
    })

    return new Response(JSON.stringify({ hospedajes }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('import-hospedaje-link error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Error al importar el link.' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
