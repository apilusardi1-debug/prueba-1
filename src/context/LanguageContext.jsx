import { createContext, useContext, useState } from 'react'
import { translations } from '../lib/i18n.js'

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('dt_lang') || 'es')

  function changeLang(code) {
    setLang(code)
    localStorage.setItem('dt_lang', code)
  }

  function t(key) {
    return translations[lang]?.[key] || translations['es'][key] || key
  }

  return (
    <LanguageContext.Provider value={{ lang, changeLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  return useContext(LanguageContext)
}
