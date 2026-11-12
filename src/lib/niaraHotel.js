// Importar desde Niara con el link de la FICHA de un hotel (el que se copia del buscador de
// Niara), además del link de una cotización:
//   https://dreamstours.niara.tech/hotels4/HOTEL_OMNI_2449#...&hotelIds[]=HOTEL_OMNI_2449&...
// La ficha completa sale de la misma API pública que usa la Edge Function
// import-hospedaje-link para las cotizaciones (cloudfront, sin login, con CORS abierto), así
// que se lee directo desde el navegador y devuelve los hospedajes con la misma forma que esa
// función (nombre, tipo, destino, fotos, amenities, habitaciones...). Un link de hotel no trae
// fechas ni precio: noches/precio quedan vacíos.

// Mismo id de cuenta que la Edge Function (no es secreto: viaja en cada request de Niara).
const TENANT_ID = 'us-east-1:86bf154a-7d6b-4a83-8436-2e60cf5edcb8'

// Ids de hotel del link (HOTEL_OMNI_2449). [] si no es un link de hotel de Niara.
export function hotelIdsDeLink(url) {
  let u
  try { u = new URL(url.trim()) } catch { return [] }
  if (!/niara\.tech$/i.test(u.hostname)) return []
  const ids = new Set()
  const enPath = u.pathname.match(/\/hotels\d*\/([A-Z0-9_]+)/i)
  if (enPath) ids.add(enPath[1])
  // hotelIds[]=... viene en el hash (#adults=1&...&hotelIds[]=HOTEL_OMNI_2449)
  const params = new URLSearchParams(u.hash.replace(/^#/, ''))
  for (const id of params.getAll('hotelIds[]')) if (id) ids.add(id)
  return [...ids]
}

async function traerHotel(hotelId) {
  const res = await fetch(`https://dvzf45pftescl.cloudfront.net/hotels/${encodeURIComponent(hotelId)}?locale=es-MX&tenantId=${encodeURIComponent(TENANT_ID)}`)
  if (!res.ok) return null
  return res.json()
}

// Igual que elegirFotoPrincipal de la Edge Function: la primera .jpg, porque algunas
// propiedades ponen primero un banner de promoción en .png.
function fotoPrincipal(imagenes) {
  return imagenes.find(u => /\.(jpe?g)(\?|$)/i.test(u)) || imagenes[0] || ''
}

function mapearHabitaciones(det) {
  return (det?.guestRooms || []).map(r => {
    const medias = r.medias || []
    const imagenes = medias.flatMap(m => (m.images || []).map(im => im.url))
    return {
      nombre: r.description || '',
      superficie: r.size || null,
      capacidad: r.maxOccupancy || 0,
      cantidad: r.quantity || 0,
      camas: (r.bedTypes || []).map(b => b.name).filter(Boolean).join(', '),
      vista: (r.views || []).map(v => v.name).filter(Boolean).join(', '),
      descripcion: medias.flatMap(m => (m.texts || []).map(t => t.Description)).filter(Boolean).join(' '),
      imagen: imagenes[0] || '',
      galeria: imagenes.slice(1),
      amenities: (r.amenities || []).map(a => a.description).filter(Boolean),
    }
  })
}

export async function traerHotelesNiara(ids) {
  const fichas = await Promise.all(ids.map(id => traerHotel(id).catch(() => null)))
  return fichas
    .map((det, i) => {
      if (!det) return null
      const imagenes = det.images || []
      const ciudad = det.address?.cityName || ''
      return {
        hotel_id: ids[i],
        nombre: det.name || '',
        tipo: det.categoryName || null,
        destino: [ciudad, det.address?.state].filter(Boolean).join(', '),
        direccion: det.address?.street || '',
        estrellas: det.rating || 0,
        descripcion: det.texts?.[0]?.text || '',
        amenities: (det.amenities || []).map(a => a.description).filter(Boolean),
        imagen: fotoPrincipal(imagenes),
        imagenes,
        habitaciones: mapearHabitaciones(det),
        noches: null,
        precio: null,
        moneda: 'BRL',
        pension: '',
      }
    })
    .filter(Boolean)
}
