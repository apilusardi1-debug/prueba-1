import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Dirección pública del sitio: UN solo lugar para cambiarla cuando se pase a un dominio propio
// (variable VITE_SITIO_URL en Vercel; sin ella, la de Vercel de siempre). La usan index.html
// (__SITIO_URL__), src/lib/seo.js y los /api de robots.txt y sitemap.xml.
export const SITIO_URL_POR_DEFECTO = 'https://prueba-1-rose.vercel.app'

export default defineConfig(({ mode }) => {
  const sitio = (loadEnv(mode, process.cwd(), '').VITE_SITIO_URL || SITIO_URL_POR_DEFECTO).replace(/\/$/, '')
  return {
    plugins: [
      react(),
      { name: 'sitio-url', transformIndexHtml: (html) => html.replaceAll('__SITIO_URL__', sitio) },
    ],
    define: { 'import.meta.env.VITE_SITIO_URL': JSON.stringify(sitio) },
  }
})
