// robots.txt (vercel.json reescribe /robots.txt acá): es una función y no un archivo fijo
// para que la dirección del sitemap salga de VITE_SITIO_URL, igual que el resto del sitio.
const SITIO = (process.env.VITE_SITIO_URL || 'https://prueba-1-rose.vercel.app').replace(/\/$/, '')

export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=86400')
  res.status(200).send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /login
Disallow: /guia/
Disallow: /chofer/
Disallow: /reservar/

Sitemap: ${SITIO}/sitemap.xml
`)
}
