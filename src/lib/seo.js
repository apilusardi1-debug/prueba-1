import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Título, descripción, URL canónica y etiquetas para compartir de cada página pública.
// index.html trae los valores de la Home (lo que ven los buscadores y redes que no
// ejecutan JavaScript); al navegar, cada página los reemplaza con los suyos.

export const SITIO_URL = 'https://prueba-1-rose.vercel.app'
const MARCA = 'DreamTours'
export const DESCRIPCION_SITIO = 'Paquetes, hospedajes, paseos y traslados en Porto de Galinhas, Maragogi, Maceió, Pipa y Fernando de Noronha, con atención en español antes y durante todo tu viaje.'

function setMeta(atributo, clave, valor) {
  let el = document.head.querySelector(`meta[${atributo}="${clave}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(atributo, clave)
    document.head.appendChild(el)
  }
  el.setAttribute('content', valor)
}

function setCanonica(url) {
  let el = document.head.querySelector('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', url)
}

// titulo: nombre de la página ("Paseos"); sin título queda solo la marca con su lema.
// imagen: ruta o URL de la foto para compartir (opcional).
export function useSeo({ titulo, descripcion, imagen } = {}) {
  const { pathname } = useLocation()
  useEffect(() => {
    const tituloCompleto = titulo ? `${titulo} | ${MARCA}` : `${MARCA} · Tu viaje al Nordeste Brasilero`
    const desc = (descripcion || DESCRIPCION_SITIO).replace(/\s+/g, ' ').trim().slice(0, 160)
    const url = SITIO_URL + (pathname === '/' ? '/' : pathname.replace(/\/$/, ''))
    const img = imagen ? (imagen.startsWith('http') ? imagen : SITIO_URL + imagen) : `${SITIO_URL}/hero-poster.jpg`

    document.title = tituloCompleto
    setMeta('name', 'description', desc)
    setMeta('property', 'og:title', tituloCompleto)
    setMeta('property', 'og:description', desc)
    setMeta('property', 'og:url', url)
    setMeta('property', 'og:image', img)
    setMeta('name', 'twitter:title', tituloCompleto)
    setMeta('name', 'twitter:description', desc)
    setMeta('name', 'twitter:image', img)
    setCanonica(url)
  }, [titulo, descripcion, imagen, pathname])
}
