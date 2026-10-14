import { createContext, useContext, useEffect, useState } from 'react'
import { translations } from '../lib/i18n.js'

const LanguageContext = createContext()

// Formato de fechas y números de cada idioma
const LOCALES = { es: 'es-AR', pt: 'pt-BR', en: 'en-US' }

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('dt_lang') || 'es' } catch (_) { return 'es' }
  })

  function changeLang(code) {
    setLang(code)
    try { localStorage.setItem('dt_lang', code) } catch (_) {}
  }

  useEffect(() => { document.documentElement.lang = lang }, [lang])

  function t(key) {
    return translations[lang]?.[key] || translations['es'][key] || key
  }

  return (
    <LanguageContext.Provider value={{ lang, changeLang, t, locale: LOCALES[lang] || LOCALES.es }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  return useContext(LanguageContext)
}

// Textos de una página o componente del sitio público, en los tres idiomas juntos:
//   const TEXTOS = { es: { titulo: 'Paseos' }, pt: { titulo: 'Passeios' }, en: { titulo: 'Tours' } }
//   const tx = useTextos(TEXTOS)  →  tx.titulo
// Lo que falte en portugués o inglés sale en español. Un texto puede ser una función
// cuando lleva datos adentro: tx.desde(precio).
export function useTextos(textos) {
  const { lang } = useLang()
  return lang === 'es' ? textos.es : { ...textos.es, ...textos[lang] }
}
