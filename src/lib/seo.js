import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useLang } from '../context/LanguageContext.jsx'

// Título, descripción, URL canónica y etiquetas para compartir de cada página pública.
// index.html trae los valores de la Home (lo que ven los buscadores y redes que no
// ejecutan JavaScript); al navegar, cada página los reemplaza con los suyos.

// Viene de VITE_SITIO_URL (ver vite.config.js): cambiar de dominio no requiere tocar código
export const SITIO_URL = import.meta.env.VITE_SITIO_URL
const MARCA = 'DreamTours'
export const DESCRIPCION_SITIO = 'Paquetes, hospedajes, paseos y traslados en Porto de Galinhas, Maragogi, Maceió, Pipa y Fernando de Noronha, con atención en español antes y durante todo tu viaje.'

// Lema y descripción de la marca en cada idioma del sitio (la versión en español es
// la que trae index.html para los buscadores)
const LEMA = { es: 'Tu viaje al Nordeste Brasilero', pt: 'Sua viagem ao Nordeste brasileiro', en: 'Your trip to Northeast Brazil' }
const DESCRIPCION = {
  es: DESCRIPCION_SITIO,
  pt: 'Pacotes, hospedagens, passeios e traslados em Porto de Galinhas, Maragogi, Maceió, Pipa e Fernando de Noronha, com atendimento em espanhol antes e durante toda a sua viagem.',
  en: 'Packages, accommodation, tours and transfers in Porto de Galinhas, Maragogi, Maceió, Pipa and Fernando de Noronha, with Spanish-speaking support before and throughout your trip.',
}

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
  const { lang } = useLang()
  useEffect(() => {
    const tituloCompleto = titulo ? `${titulo} | ${MARCA}` : `${MARCA} · ${LEMA[lang] || LEMA.es}`
    const desc = (descripcion || DESCRIPCION[lang] || DESCRIPCION_SITIO).replace(/\s+/g, ' ').trim().slice(0, 160)
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
  }, [titulo, descripcion, imagen, pathname, lang])
}
