import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

// Valores por defecto — se usan cuando Supabase no está conectado todavía
export const CONFIG_DEFAULTS = {
  hero_titulo:    'El Nordeste Brasilero te espera',
  hero_subtitulo: 'Paquetes con vuelos, hoteles y excursiones desde Argentina. Porto de Galinhas, Maragogi, Noronha y más.',
  hero_cta:       'Ver paquetes',
  hero_imagen:    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=80',
  color_primario: '#b07420',
  color_acento:   '#d9a83a',
  whatsapp:       '5491100000000',
  instagram_url:  'https://instagram.com/dreamstour',
}

const SiteConfigContext = createContext(CONFIG_DEFAULTS)

export function SiteConfigProvider({ children }) {
  const [config, setConfig] = useState(CONFIG_DEFAULTS)
  const [loading, setLoading] = useState(true)

  // Inyecta CSS variables en :root cuando cambian los colores
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--cp', config.color_primario)
    root.style.setProperty('--ca', config.color_acento)
    // Derivados útiles
    root.style.setProperty('--cp-dark', darken(config.color_primario))
  }, [config.color_primario, config.color_acento])

  // Carga la config desde Supabase al montar
  useEffect(() => {
    async function loadConfig() {
      if (!supabase) { setLoading(false); return }
      try {
        const { data, error } = await supabase
          .from('site_config')
          .select('*')
          .eq('id', 1)
          .single()

        if (!error && data) {
          setConfig(prev => ({
            ...prev,
            ...Object.fromEntries(
              Object.entries(data).filter(([key, v]) => key !== 'id' && v !== null && v !== undefined)
            ),
          }))
        }
      } catch (_) {
        // Supabase no configurado — se usan los defaults
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
  }, [])

  // Guarda un campo (o varios) en Supabase y actualiza el estado local
  async function saveConfig(updates) {
    setConfig(prev => ({ ...prev, ...updates }))
    if (!supabase) return { ok: false, error: 'Supabase no configurado' }
    try {
      const { error } = await supabase
        .from('site_config')
        .upsert({ id: 1, ...updates, updated_at: new Date().toISOString() })
      if (error) throw error
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }

  return (
    <SiteConfigContext.Provider value={{ config, saveConfig, loading }}>
      {children}
    </SiteConfigContext.Provider>
  )
}

export function useSiteConfig() {
  return useContext(SiteConfigContext)
}

// Oscurece un color hex ~15%
function darken(hex) {
  try {
    const n = parseInt(hex.replace('#', ''), 16)
    const r = Math.max(0, (n >> 16) - 30)
    const g = Math.max(0, ((n >> 8) & 0xff) - 20)
    const b = Math.max(0, (n & 0xff) - 10)
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
  } catch {
    return hex
  }
}
