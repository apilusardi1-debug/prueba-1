// Manifest de instalación del panel de chofer, generado por chofer (no se puede usar un solo
// manifest.json fijo porque cada uno tiene que "abrir" su propio link personal /chofer/:token
// al tocar el ícono instalado, no una página genérica). Vive en /api porque tiene que servirse
// del mismo origen que el sitio (prueba-1-rose.vercel.app) — un manifest de otro origen (por
// ejemplo de una Edge Function de Supabase) no es confiable para instalar la app.
export default function handler(req, res) {
  const token = String(req.query.token || '').trim()
  if (!token) {
    res.status(400).json({ error: 'Falta el token' })
    return
  }

  const ruta = `/chofer/${token}`
  const manifest = {
    name: 'DreamTours Motorista',
    short_name: 'DT Motorista',
    description: 'Avisos de operação e confirmação de recebido, para motoristas da DreamTours.',
    start_url: ruta,
    scope: ruta,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: '/icon-chofer-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-chofer-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-chofer-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-chofer-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }

  res.setHeader('Content-Type', 'application/manifest+json')
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json(manifest)
}
