// sitemap.xml del sitio público (vercel.json reescribe /sitemap.xml acá). Las páginas fijas
// van a mano; los paseos y alojamientos se leen de la base, así el mapa se actualiza solo
// cuando se cargan o se desactivan. Solo lee tablas con lectura pública (clave anon).
import { destinos } from '../src/data/mockData.js'

const SITIO = (process.env.VITE_SITIO_URL || 'https://prueba-1-rose.vercel.app').replace(/\/$/, '')
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://przvftnhwwistmcbkeon.supabase.co'
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY

const FIJAS = ['/', '/paquetes', '/excursiones', '/destinos', '/hoteles', '/traslados', '/marea', '/nosotros', '/privacidad']

async function leer(tabla, filtros) {
  if (!SUPABASE_KEY) return []
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?select=id&${filtros}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    })
    return r.ok ? await r.json() : []
  } catch (_) {
    return []
  }
}

export default async function handler(req, res) {
  const [paseos, hospedajes] = await Promise.all([
    leer('excursiones', 'activa=eq.true&categoria=eq.excursiones'),
    leer('hospedajes', 'activa=eq.true'),
  ])
  const rutas = [
    ...FIJAS,
    ...destinos.map(d => `/destinos/${d.id}`),
    ...paseos.map(p => `/excursiones/${p.id}`),
    ...hospedajes.map(h => `/hoteles/${h.id}`),
  ]
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    rutas.map(r => `  <url><loc>${SITIO}${r}</loc></url>`).join('\n')
  }\n</urlset>\n`
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  res.status(200).send(xml)
}
